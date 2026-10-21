// Fig: decoding as a roulette wheel. A sealed cabinet at the back (the frozen checkpoint) pushes
// up one column per candidate, as tall as its logit. The wheel has one pocket per candidate,
// as wide as its probability at the set temperature. Top-k and top-p slide shutters over the
// pockets they remove; greedy drops a brake pin that stops the ball over the widest pocket.
// The ball's draw picks the token; its slug slides onto the composing stick (the context) and
// a card slides into the cache rack (one key and value entry per position).
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { PROMPT, STEPS, TAU, TOP_K, TOP_P, MODES, ADJECTIVES, NOUNS, LIFT, ENDINGS, candidatesFor, softmax, keptOf, drawOf, pickOf, stepOf } from "./model.mjs";

const WIDTH = 660;
const HEIGHT = 470;
const TURN = Math.PI * 2;
const DEG = Math.PI / 180;

// World layout, in units of about 1 px. The wheel sits at the origin.
const D = {
  base: { x: -140, y: -152, w: 266, d: 276, r: 9 },
  baseH: 9,
  footH: 5,
  plinth: { x: -88, y: -88, w: 176, d: 176, r: 7 },
  plinthH: 16,
  body: 82, // bowl outside radius
  rimZ: 32,
  rim: 73, // rim inside radius
  ledge: { r: 64, z: 28 },
  apron: { r: 57, z: 25 },
  ring: { r: 50, z: 25 }, // number ring from 50 to 57
  floor: { r: 34, z: 23.5 }, // pockets from 34 to 50
  hub: { r: 34, z: 25 },
  spindle: { r: 4.5, z: 31 },
  cap: { r: 7, z: 33.5 },
  fret: 1,
  shutter: [24.1, 24.8],
  ball: { r: 2.8, track: 70.2, seat: 42 },
  brake: { angle: 290 * DEG, post: 77.5, arm: [66.8, 80.6], block: [36, 41.5], pin: [28.2, 34.6] },
  rest: 200 * DEG,
  // The cabinet: the frozen checkpoint, with one logit column per candidate on top.
  cab: { x: -84, y: -134, w: 168, d: 28, r: 2 },
  cabH: 36,
  board: { x: -84, y: -139, w: 168, d: 5, r: 1 },
  boardH: 86,
  rodY: -120,
  rodX: (index) => -66.5 + 19 * index,
  perLogit: 10,
  // The composing stick (context) and the cache rack, along the front.
  stick: { x: -122, y: 102, w: 128, d: 14, r: 1 },
  fence: { x: -122, y: 100, w: 124, d: 2.4, r: 0.6 },
  head: { x: -128, y: 100, w: 6, d: 16, r: 1 },
  slug: { y: 103, d: 11, z0: 2.4, z1: 9, gap: 0.5, start: -121.6 },
  caster: { x: 2, y: 97, w: 22, d: 20, r: 2 },
  casterH: 18,
  rack: { x: 30, y: 102, w: 66, d: 14, r: 1 },
  card: { y: 108.4, d: 1.2, w: 6, z0: 3, z1: 16, pitch: 7.6, first: 33.5 },
  writer: { x: 96, y: 97, w: 20, d: 20, r: 2 },
  writerH: 20,
  knob: { x: -58, y: 88, z: 8, dial: 6.8, r: 4.4 },
};

const P = k.fitProjection(
  [
    ...k.boxCorners(D.base, -D.baseH - D.footH, 0),
    ...k.boxCorners(D.board, 0, D.boardH),
    [0, 0, D.cap.z],
  ],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 52, elevation: 38 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const fix = (n) => Math.round(n * 10) / 10;
const poly = (points) => `M${points.map(([x, y]) => `${fix(x)} ${fix(y)}`).join("L")}Z`;
const { sinA, cosA } = k.cameraOf(P);
const VIEW = Math.atan2(sinA, cosA); // plan angle that faces the viewer

// ---- shared with the page (written with k. and G. so both run the same code) ----

// A point on a circle round the wheel axis.
function wheelAt(r, angle, z) {
  return [r * Math.cos(angle), r * Math.sin(angle), z];
}

// The ball's centre height at a radius: on the ledge, down the apron, over the ring, into a pocket.
function ballZ(r) {
  const R = D.ball.r;
  if (r >= D.ledge.r) return D.ledge.z + R;
  if (r >= D.apron.r) return D.apron.z + R + ((D.ledge.z - D.apron.z) * (r - D.apron.r)) / (D.ledge.r - D.apron.r);
  const top = D.ring.z + R;
  const low = D.floor.z + R;
  const t = Math.min(1, Math.max(0, (D.ring.r - r) / (D.ring.r - D.ball.seat)));
  return top + (low - top) * t * t * (3 - 2 * t);
}

// The live rotor below the number ring: shutters, then frets, far to near.
function rotorLow(theta, bounds, shut) {
  const items = [];
  const half = D.fret / 2;
  // Pocket floors alternate in tone, so each pocket reads as one segment.
  const floors = ["", ""];
  for (let index = 0; index < 8; index++) {
    const a0 = theta + TURN * bounds[index];
    const a1 = theta + TURN * bounds[index + 1];
    if (a1 - a0 < 1e-4) continue;
    const n = Math.max(2, Math.ceil((a1 - a0) / 0.04));
    const outer = [];
    const inner = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      outer.push(k.iso(wheelAt(D.ring.r, a, D.floor.z), P));
      inner.push(k.iso(wheelAt(D.floor.r, a, D.floor.z), P));
    }
    floors[index % 2] += k.pathOf(outer.concat(inner.reverse()), true);
  }
  const floor = '<path class="iso-shade" data-shade="0" d="' + floors[0] + '"/><path class="iso-shade" data-shade="2" d="' + floors[1] + '"/>';
  for (let index = 0; index < 8; index++) {
    const s = shut[index];
    if (s < 0.002) continue;
    const a0 = theta + TURN * bounds[index];
    const a1 = theta + TURN * bounds[index + 1];
    const inner = D.ring.r - (D.ring.r - D.floor.r) * s;
    const g0 = half / inner + 0.002;
    const g1 = half / D.ring.r + 0.002;
    if (a1 - a0 < 2 * g0 + 0.004) continue;
    const ring = [];
    const n = Math.max(3, Math.ceil((a1 - a0) / 0.05));
    for (let i = 0; i <= n; i++) {
      const a = a0 + g1 + ((a1 - a0 - 2 * g1) * i) / n;
      ring.push([D.ring.r * Math.cos(a), D.ring.r * Math.sin(a)]);
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + g0 + ((a1 - a0 - 2 * g0) * i) / n;
      ring.push([inner * Math.cos(a), inner * Math.sin(a)]);
    }
    const mid = (a0 + a1) / 2;
    const r = (inner + D.ring.r) / 2;
    const paths = k.extrude(ring, D.shutter[0], D.shutter[1] - D.shutter[0], P, { convex: false });
    const span = Math.min(1.6 / inner, (a1 - a0) / 2 - g0 - 0.01);
    const grip = span > 0.004 ? k.pathOf([wheelAt(inner + 1.2, mid - span, D.shutter[1]), wheelAt(inner + 1.2, mid + span, D.shutter[1]), wheelAt(inner + 2.2, mid + span, D.shutter[1]), wheelAt(inner + 2.2, mid - span, D.shutter[1])].map((q) => k.iso(q, P)), true) : "";
    items.push({ key: k.depthOf(wheelAt(r, mid, 24), P) - 50, svg: k.solidSvg(paths, { tone: "mid", className: "sp-shutter", inner: grip ? k.lineSvg(grip, { tone: "lo" }) : "" }) });
  }
  for (let index = 0; index < 8; index++) {
    const a = theta + TURN * bounds[index];
    const c = Math.cos(a);
    const s = Math.sin(a);
    const tx = -s;
    const ty = c;
    const ring = [
      [D.floor.r * c - tx * half, D.floor.r * s - ty * half],
      [D.ring.r * c - tx * half, D.ring.r * s - ty * half],
      [D.ring.r * c + tx * half, D.ring.r * s + ty * half],
      [D.floor.r * c + tx * half, D.floor.r * s + ty * half],
    ];
    const paths = k.extrude(ring, D.floor.z, D.ring.z - D.floor.z, P);
    items.push({ key: k.depthOf(wheelAt((D.floor.r + D.ring.r) / 2, a, 24), P), svg: k.solidSvg(paths, { tone: "hi", crease: "lo" }) });
  }
  return floor + items.sort((x, y) => x.key - y.key).map((item) => item.svg).join("");
}

// The live marks on the number ring: a percent scale from the zero mark, and one mark per fret.
function rotorRing(theta, bounds) {
  const minor = [];
  const major = [];
  for (let index = 1; index < 100; index++) {
    const a = theta + (TURN * index) / 100;
    const big = index % 10 === 0;
    const r1 = D.apron.r - (big ? 2.6 : 1.2);
    (big ? major : minor).push(k.segment(wheelAt(D.apron.r, a, D.ring.z), wheelAt(r1, a, D.ring.z), P));
  }
  const marks = [];
  for (let index = 1; index < 8; index++) {
    const a = theta + TURN * bounds[index];
    marks.push(k.segment(wheelAt(D.ring.r, a, D.ring.z), wheelAt(D.apron.r, a, D.ring.z), P));
  }
  const zero = k.segment(wheelAt(D.ring.r, theta, D.ring.z), wheelAt(D.apron.r, theta, D.ring.z), P);
  return k.lineSvg(minor.join(""), { tone: "lo" }) + k.lineSvg(major.join(""), { tone: "mid" }) + k.lineSvg(marks.join(""), { tone: "mid" }) + k.lineSvg(zero, { tone: "hi" });
}

// The logit columns: a rod and a cap per candidate, far to near.
function rodsSvg(heights) {
  return heights
    .map((h, index) => ({ h, x: D.rodX(index) }))
    .sort((a, b) => a.x - b.x)
    .map(({ h, x }) => {
      const top = D.cabH + Math.max(0.6, h);
      return k.solidSvg(k.cylinder(x, D.rodY, 2.2, D.cabH, top - D.cabH, P, 20), { tone: "hi", crease: "none" }) + k.solidSvg(k.cylinder(x, D.rodY, 3.2, top, 1.4, P, 24, 0.3), { tone: "hi" });
    })
    .join("");
}

// The temperature knob's pointer: a line across the knob face, with a dot at the reading end.
function pointerAt(tau) {
  const share = (tau - TAU.min) / (TAU.max - TAU.min);
  const angle = (-135 + 270 * share) * DEG;
  const face = D.knob.y + 3.6;
  const end = (r, a) => k.iso([D.knob.x + r * Math.sin(a), face, D.knob.z + r * Math.cos(a)], P);
  const r = D.knob.r - 0.2;
  return { d: k.pathOf([end(r, angle + Math.PI), end(r, angle)]), dot: end(r - 1.3, angle) };
}

// A type slug: a small block with its token on the top face.
function slugSvg(text, x0, generated) {
  const w = slugWidth(text);
  const plan = { x: x0, y: D.slug.y, w, d: D.slug.d, r: 0.8 };
  const solid = k.solidSvg(k.slabOf(plan, D.slug.z0, D.slug.z1 - D.slug.z0, P, 3, 0.4), { tone: generated ? "hi" : "mid" });
  const label = k.faceTextSvg(k.topMatrix([x0 + w / 2, D.slug.y + D.slug.d / 2 + 1.5], D.slug.z1, P, "x"), text, { size: 4.2, tone: generated ? "hi" : "mid", anchor: "middle" });
  return solid + label;
}
function slugWidth(text) {
  return 3.8 + 2.6 * Math.max(1, text.length);
}

// A cache card: a thin plate standing in the rack, with key and value punches on its face.
function cardSvg(x0) {
  const c = D.card;
  const plan = { x: x0, y: c.y, w: c.w, d: c.d, r: 0.3 };
  const holes = [];
  for (const z of [12.6, 9.6, 6.6]) for (const dx of [1.6, 3, 4.4]) holes.push(k.iso([x0 + dx, c.y + c.d, z], P));
  return k.solidSvg(k.slabOf(plan, c.z0, c.z1 - c.z0, P, 2, 0.2), { tone: "mid" }) + k.dotsSvg(holes, { size: 0.42, tone: "mid" });
}

// ---- static art (Node only) ----

function ellipse(r, z, from = 0, to = TURN, n = 160) {
  const count = Math.max(8, Math.ceil((n * Math.abs(to - from)) / TURN));
  return Array.from({ length: count + 1 }, (_, index) => at(wheelAt(r, from + ((to - from) * index) / count, z)));
}
const ring = (r, z) => k.pathOf(ellipse(r, z).slice(0, -1), true);
const annulus = (r0, z0, r1, z1) => `${k.pathOf(ellipse(r0, z0).slice(0, -1), true)}${k.pathOf(ellipse(r1, z1).slice(0, -1).reverse(), true)}`;

// A vertical band of a cylinder round the wheel axis, seen from inside (far half) or outside (near half).
function band(r, z0, z1, inside) {
  const from = inside ? VIEW + Math.PI / 2 : VIEW - Math.PI / 2;
  const to = from + Math.PI;
  const shades = ["", "", "", ""];
  const steps = 96;
  for (let index = 0; index < steps; index++) {
    const a0 = from + (Math.PI * index) / steps;
    const a1 = from + (Math.PI * (index + 1)) / steps;
    const mid = (a0 + a1) / 2;
    const n = inside ? [-Math.cos(mid), -Math.sin(mid)] : [Math.cos(mid), Math.sin(mid)];
    const lit = (n[0] * -sinA + n[1] * cosA + 1) / 2;
    const shade = Math.min(3, Math.max(0, Math.floor(lit * 4)));
    shades[shade] += poly([at(wheelAt(r, a0, z1)), at(wheelAt(r, a1, z1)), at(wheelAt(r, a1 + 0.002, z0)), at(wheelAt(r, a0 - 0.002, z0))]);
  }
  const top = ellipse(r, z1, from, to, 96);
  const bottom = ellipse(r, z0, from, to, 96);
  const outline = k.pathOf([top[0], ...bottom, top[top.length - 1]]);
  return { shades, outline };
}
const bandSvg = ({ shades, outline }, tone = "lo") => shades.map((d, shade) => (d ? `<path class="iso-shade" data-shade="${shade}" d="${d}"/>` : "")).join("") + L(outline, { tone });

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(D.base, -D.baseH - D.footH, D.baseH, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(D.base, 22))) out.push(S(k.cylinder(x, y, 7, -D.baseH - D.footH, D.footH, P, 28, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(D.base, -D.baseH, D.baseH, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(D.base, -D.baseH + 3.4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(D.base, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(D.base, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Label plate at the left end of the front edge.
  const label = { x: 92, y: -146, w: 30, d: 8, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.2), 0.8, P, 3), { tone: "faint" }));
  out.push(L([[96, -143.4, 18], [96, -141, 12]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 1.9, label.y + 3.5, 0.8]), at([label.x + label.w - 1.9, label.y + 3.5, 0.8])], { size: 0.4 }));
  return out.join("");
}

// The cabinet (frozen checkpoint), the scale board and the token windows.
function cabinet(id) {
  const out = [];
  const b = D.board;
  const scale = [];
  for (let n = 0; n <= 4; n++) {
    const z = D.cabH + n * D.perLogit;
    scale.push(k.sideSeam(b, z, P, 3));
  }
  out.push(S(k.slabOf(b, 0, D.boardH, P, 3, 0.6), { tone: "mid", inner: L(scale.slice(1).join(""), { tone: "faint" }) + L(scale[0], { tone: "lo" }) }));
  out.push(Dots([b.x + 4, b.x + b.w - 4].map((x) => at([x, b.y + b.d, D.boardH - 4])), { size: 0.45 }));
  const c = D.cab;
  out.push(S(k.slabOf(c, 0, D.cabH, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(c, 12, P, 4), { tone: "faint" }) }));
  out.push(Dots([c.x + 4, c.x + c.w - 4].flatMap((x) => [at([x, c.y + 4, D.cabH]), at([x, c.y + c.d - 4, D.cabH])]), { size: 0.45 }));
  // Glands: one ring per column on the top face.
  out.push(L(Array.from({ length: 8 }, (_, index) => k.ring(D.rodX(index), D.rodY, 3.6, D.cabH, P, 24)).join(""), { tone: "lo" }));
  // Seal: two screws joined by a wire through a lead seal. The checkpoint does not change.
  const seal = [c.x + c.w - 14, c.y + 6];
  out.push(L(k.onTop([[seal[0] - 6, seal[1]], [seal[0] - 1.6, seal[1]]], D.cabH, P) + k.onTop([[seal[0] + 1.6, seal[1]], [seal[0] + 6, seal[1]]], D.cabH, P), { tone: "mid" }));
  out.push(S(k.cylinder(seal[0], seal[1], 1.6, D.cabH, 0.9, P, 18), { tone: "mid" }));
  out.push(Dots([at([seal[0] - 6, seal[1], D.cabH]), at([seal[0] + 6, seal[1], D.cabH])], { size: 0.6, tone: "hi" }));
  // Token windows on the front face, one under each column.
  const windows = [];
  for (let index = 0; index < 8; index++) {
    const m = k.sideMatrix([D.rodX(index), c.y + c.d], 31, P, "left");
    windows.push(`<g transform="${m}"><path class="iso-line" data-tone="lo" d="M-8 0h16v9h-16Z"/><text class="iso-face-text" data-tone="hi" x="0" y="6.3" font-size="4.6" text-anchor="middle" data-window="${index}"></text></g>`);
  }
  out.push(`<g class="${id}-windows">${windows.join("")}</g>`);
  return out.join("");
}

function plinth() {
  const p = D.plinth;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(p, 2), 0, 1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(p, 0, D.plinthH, P, 6, 1), { tone: "mid", inner: L(k.sideSeam(p, 4, P, 6), { tone: "faint" }) }));
  const screws = k.corners(p, 7);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, D.plinthH, P, 14)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, D.plinthH])), { size: 0.45 }));
  return out.join("");
}

// The temperature dial on the plinth face: a scale plate, a knurled knob and the τ mark.
function knob() {
  const q = D.knob;
  const F = G.frameOf([q.x, q.y, q.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const out = [];
  out.push(S(G.disc(0, 0.6, q.dial, F, P), { tone: "mid" }));
  const minor = [];
  const major = [];
  for (let index = 0; index <= 18; index++) {
    const tau = TAU.min + index * 0.1;
    const angle = (-135 + (270 * index) / 18) * DEG;
    const big = Math.abs(tau * 2 - Math.round(tau * 2)) < 1e-6 || index === 0;
    const r1 = q.dial - (big ? 1.8 : 1);
    const p0 = [q.x + q.dial * Math.sin(angle), q.y + 0.6, q.z + q.dial * Math.cos(angle)];
    const p1 = [q.x + r1 * Math.sin(angle), q.y + 0.6, q.z + r1 * Math.cos(angle)];
    (big ? major : minor).push(k.segment(p0, p1, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  const ribs = G.ribsOf(F, 0.6, 3.6, q.r, 28, P, { fade: [0.1, 0.55], seams: true });
  out.push(S(G.disc(0.6, 3.6, q.r, F, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
  out.push(k.faceTextSvg(k.sideMatrix([q.x + q.dial + 3.2, q.y], q.z - 3.4, P, "left"), "τ", { size: 5, tone: "mid" }));
  return out.join("");
}

// The bowl body and everything inside it, clipped to the rim's inside edge.
function bowl(id) {
  const out = [];
  const R = D;
  out.push(S(k.cylinder(0, 0, R.body, D.plinthH, R.rimZ - D.plinthH, P, 120, 0.9), { tone: "mid", inner: L(k.sideArc(0, 0, R.body, D.plinthH + 5, P, 64), { tone: "faint" }) }));
  // Rim details: a turned groove and eight screws.
  out.push(L(ring((R.body + R.rim) / 2, R.rimZ), { tone: "faint" }));
  out.push(Dots(Array.from({ length: 8 }, (_, index) => at(wheelAt((R.body + R.rim) / 2, (index + 0.5) * (TURN / 8), R.rimZ))), { size: 0.5 }));
  const inside = [];
  inside.push(`<path class="iso-fill" d="${ring(R.rim, R.rimZ)}"/>`);
  inside.push(bandSvg(band(R.rim, R.ledge.z, R.rimZ, true)));
  inside.push(`<path class="iso-top" fill-rule="evenodd" d="${annulus(R.rim, R.ledge.z, R.ledge.r, R.ledge.z)}"/>`);
  inside.push(`<path class="iso-shade" data-shade="3" fill-rule="evenodd" d="${annulus(R.ledge.r, R.ledge.z, R.apron.r, R.apron.z)}"/>`);
  inside.push(L(ring(R.ledge.r, R.ledge.z), { tone: "faint" }));
  // Rotor: pocket floor, pocket walls, live shutters and frets, the number ring, the hub.
  inside.push(bandSvg(band(R.ring.r, R.floor.z, R.ring.z, true), "faint"));
  inside.push(bandSvg(band(R.hub.r, R.floor.z, R.hub.z, false), "faint"));
  inside.push(`<g data-part="rotor-low"></g>`);
  inside.push(`<path class="iso-top" fill-rule="evenodd" d="${annulus(R.apron.r, R.ring.z, R.ring.r, R.ring.z)}"/>`);
  inside.push(`<g data-part="rotor-ring"></g>`);
  inside.push(L(ring(R.apron.r, R.apron.z), { tone: "lo" }));
  inside.push(L(ring(R.ring.r, R.ring.z), { tone: "lo" }));
  inside.push(`<path class="iso-top" d="${ring(R.hub.r, R.hub.z)}"/>`);
  inside.push(L(ring(R.hub.r, R.hub.z), { tone: "lo" }) + L(ring(R.hub.r - 7, R.hub.z), { tone: "faint" }));
  inside.push(S(k.cylinder(0, 0, R.spindle.r, R.hub.z, R.spindle.z - R.hub.z, P, 24), { tone: "mid" }));
  inside.push(S(k.cylinder(0, 0, R.cap.r, R.spindle.z, R.cap.z - R.spindle.z, P, 32, 0.4), { tone: "mid" }));
  inside.push(Dots([at([0, 0, R.cap.z])], { size: 0.6, tone: "mid" }));
  inside.push(`<g data-part="ball">${S(G.sphereOf([0, 0, 0], R.ball.r, P), { tone: "hi", lit: true })}</g>`);
  out.push(`<defs><clipPath id="${id}-bowl"><path d="${ring(R.rim, R.rimZ)}"/></clipPath></defs><g clip-path="url(#${id}-bowl)">${inside.join("")}</g>`);
  out.push(L(ring(R.rim, R.rimZ), { tone: "mid" }));
  return out.join("");
}

// The brake: a post on the rim, an arm, a solenoid block and the pin that drops into the ledge.
function brake() {
  const b = D.brake;
  const u = [Math.cos(b.angle), Math.sin(b.angle)];
  const t = [-u[1], u[0]];
  const along = (r, w) => [r * u[0] + w * t[0], r * u[1] + w * t[1]];
  const box = (r0, r1, w) => [along(r0, -w), along(r1, -w), along(r1, w), along(r0, w)];
  const out = [];
  const post = along(b.post, 0);
  out.push(S(k.cylinder(post[0], post[1], 3.4, D.rimZ, 1, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(post[0], post[1], 2.2, D.rimZ + 1, b.block[1] - D.rimZ - 1, P, 20), { tone: "mid" }));
  const pin = along(D.ball.track, 0);
  out.push(`<g data-part="pin">${S(k.cylinder(pin[0], pin[1], 1, b.pin[1], b.block[1] - b.pin[1], P, 16), { tone: "hi", crease: "none" })}</g>`);
  out.push(S(k.extrude(box(D.ball.track - 3, D.ball.track + 3, 2.6), b.block[0], b.block[1] - b.block[0], P), { tone: "mid" }));
  out.push(S(k.extrude(box(b.arm[0], b.arm[1], 1.8), b.block[1], 2.4, P), { tone: "mid" }));
  out.push(Dots([at([...along(D.ball.track, 0), b.block[1] + 2.4]), at([...post, b.block[1] + 2.4])], { size: 0.45 }));
  return out.join("");
}

function front(id) {
  const out = [];
  const front = D.stick.y + D.stick.d;
  const minor = [];
  const major = [];
  for (let x = D.stick.x + 4, index = 0; x <= D.stick.x + D.stick.w - 3; x += 4, index++) (index % 5 === 0 ? major : minor).push(k.segment([x, front, 2.4], [x, front - (index % 5 === 0 ? 1.8 : 1), 2.4], P));
  out.push(S(k.slabOf(D.stick, 0, 2.4, P, 3, 0.4), { tone: "mid", inner: L(minor.join(""), { tone: "lo" }) + L(major.join(""), { tone: "mid" }) }));
  out.push(S(k.slabOf(D.fence, 0, 8, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(D.head, 0, 11, P, 3, 0.5), { tone: "mid" }));
  out.push(Dots([at([D.head.x + 3, D.head.y + 4, 11]), at([D.head.x + 3, D.head.y + D.head.d - 4, 11])], { size: 0.45 }));
  out.push(`<g data-part="slugs"></g>`);
  out.push(S(k.slabOf(D.caster, 0, D.casterH, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(D.caster, 6, P, 4) + k.sideSeam(D.caster, D.casterH - 3, P, 4), { tone: "faint" }) }));
  out.push(Dots(k.corners(D.caster, 3.2).map(([x, y]) => at([x, y, D.casterH])), { size: 0.45 }));
  const port = [D.caster.x + D.caster.w / 2, D.caster.y + D.caster.d / 2];
  out.push(S(k.cylinder(port[0], port[1], 5, D.casterH, 2.2, P, 32, 0.4), { tone: "mid" }));
  out.push(L(k.ring(port[0], port[1], 3.2, D.casterH + 2.2, P, 28), { tone: "lo" }));
  out.push(S(k.slabOf(D.rack, 0, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.lineOnTop([D.rack.x, D.card.y + D.card.d / 2], [D.rack.x + D.rack.w, D.card.y + D.card.d / 2], 3, P), { tone: "lo" }));
  out.push(`<g data-part="cards"></g>`);
  out.push(S(k.slabOf(D.writer, 0, D.writerH, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(D.writer, 6, P, 4) + k.sideSeam(D.writer, D.writerH - 3, P, 4), { tone: "faint" }) }));
  out.push(Dots(k.corners(D.writer, 3.2).map(([x, y]) => at([x, y, D.writerH])), { size: 0.45 }));
  const head = { x: D.writer.x + 5, y: D.writer.y + 5, w: 10, d: 10, r: 1.5 };
  out.push(S(k.slabOf(head, D.writerH, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(head, 2.2), D.writerH + 3, P, 3), { tone: "lo" }));
  return out.join("");
}

export function build({ fig = "Fig 1", id = "sampler" } = {}) {
  const tau = TAU.start;
  const mode = "top-p";
  const first = stepOf([], tau, mode);
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A decoding machine on a base plate. At the back, a sealed cabinet is the frozen checkpoint. Eight columns rise from its top, one for each candidate token. Each column is as tall as its logit. In the middle, a roulette wheel has eight pockets. Each pocket is as wide as the probability of its candidate at the set temperature. Top-k and top-p close shutters over the pockets that they remove. For greedy decoding, a brake pin stops the ball above the widest pocket. At the front, the slug of the chosen token slides onto a composing stick that holds the context. A card slides into the cache rack, one card for each position.",
    body: [base(), cabinet(id), `<g data-part="rods"></g>`, plinth(), bowl(id), brake(), knob(), `<g data-part="pointer"></g>`, front(id)],
  });

  const stage = stageHtml({
    svg,
    label: "Decoding wheel. Space or Enter generates the next token. Left and right arrow keys change the temperature by 0.1. Keys 1, 2 and 3 choose greedy, top-k or top-p. R resets the context.",
    role: "slider",
    attrs: `aria-valuemin="${TAU.min}" aria-valuemax="${TAU.max}" aria-valuenow="${tau}" aria-valuetext="Temperature ${tau}, top-p, ${first.open} of 8 pockets open"`,
  });

  const cells = first.candidates
    .map((c, index) => `<div class="sp-cell" data-cell="${index}"><b data-token></b><span><i>z</i><em data-z></em></span><span><i>p</i><em data-p></em></span><span><i>draw</i><em data-q></em></span></div>`)
    .join("");
  const controls = `<div class="fig-controls"><button class="btn btn-primary" type="button" data-act="generate">Generate next token</button><button class="btn" type="button" data-act="reset">Reset</button><span class="spacer"></span><span class="sp-modes" role="group" aria-label="Decoding rule">${MODES.map((m) => `<button class="btn" type="button" data-mode="${m.key}" aria-pressed="${m.key === mode}">${m.label}</button>`).join("")}</span></div>
<div class="fig-row"><label class="label" for="${id}-tau">Temperature <span class="sp-tau">τ</span></label><input class="range" id="${id}-tau" type="range" min="${TAU.min}" max="${TAU.max}" step="${TAU.step}" value="${tau}"><output for="${id}-tau" data-out="tau">${tau.toFixed(1)}</output></div>
<p class="sp-context"><span class="label">Context</span><span data-out="context"></span></p>
<p class="label sp-head">Candidates for the next token</p>
<div class="sp-cells" role="group" aria-label="Candidates for the next token">${cells}</div>
<p class="sr-only" aria-live="polite" data-live></p>`;

  const html = plate({
    id,
    fig,
    title: "Pick the next token",
    hint: "Generate, then change τ",
    readout: `τ ${tau.toFixed(1)} · top-p · ${first.open} of 8 open`,
    keys: [
      { mark: "lit", label: "Ball: the one random draw" },
      { mark: "raised", label: "Pockets: as wide as each probability" },
      { mark: "flat", label: "Shutters: pockets the rule removes" },
      { mark: "edge", label: "Columns: one logit per candidate" },
    ],
    caption:
      "Candidate values are illustrative. The model computes every logit with one matrix multiplication. The figure shows eight candidates. In the table, z is the logit. The p value is exp(z/τ) divided by the sum of exp(z/τ) for the eight candidates. The draw value is the chance after the rule. Greedy takes the largest p. Top-k and top-p remove candidates, then divide each remaining p by their sum. The KV cache is temporary request state. The checkpoint stays frozen.",
    stage,
    controls,
  });

  const DATA = { D: { ...D, rodX: undefined }, P, PROMPT, STEPS, TAU, TOP_K, TOP_P, VIEW, ADJECTIVES, NOUNS, LIFT, ENDINGS };
  const script = `
const DATA = ${JSON.stringify(DATA)};
const D = DATA.D;
D.rodX = ${D.rodX.toString()};
const { P, PROMPT, STEPS, TAU, TOP_K, TOP_P, VIEW, ADJECTIVES, NOUNS, LIFT, ENDINGS } = DATA;
const TURN = Math.PI * 2, DEG = Math.PI / 180;
${candidatesFor.toString()}
${softmax.toString()}
${keptOf.toString()}
${drawOf.toString()}
${pickOf.toString()}
${stepOf.toString()}
${wheelAt.toString()}
${ballZ.toString()}
${rotorLow.toString()}
${rotorRing.toString()}
${rodsSvg.toString()}
${pointerAt.toString()}
${slugSvg.toString()}
${slugWidth.toString()}
${cardSvg.toString()}
${LIVE}
`;

  const css = `
[data-fig="${id}"] .sp-modes{display:inline-flex;flex-wrap:wrap;gap:8px}
[data-fig="${id}"] .sp-context{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px;margin:14px 0 0;color:var(--anatomy-strong);font:14px/1.5 var(--anatomy-mono)}
[data-fig="${id}"] .sp-context [data-new]{box-shadow:inset 0 -1px 0 var(--anatomy-strong)}
[data-fig="${id}"] .sp-head{margin:14px 0 0}
[data-fig="${id}"] .sp-cells{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:1px;margin:10px 0 0;background:var(--anatomy-faint);box-shadow:0 0 0 1px var(--anatomy-faint)}
[data-fig="${id}"] .sp-cell{display:grid;gap:2px;padding:8px 8px 9px;background:var(--anatomy-card);font:12px/1.35 var(--anatomy-mono);font-variant-numeric:tabular-nums;color:var(--anatomy-text);transition:opacity .25s,box-shadow .25s}
[data-fig="${id}"] .sp-cell b{color:var(--anatomy-strong);font-weight:600;white-space:pre;font-size:13px}
[data-fig="${id}"] .sp-cell span{display:flex;justify-content:space-between;gap:6px}
[data-fig="${id}"] .sp-cell i{font-style:normal;color:var(--anatomy-muted)}
[data-fig="${id}"] .sp-cell em{font-style:normal;color:var(--anatomy-strong)}
[data-fig="${id}"] .sp-cell[data-shut] b,[data-fig="${id}"] .sp-cell[data-shut] em{color:var(--anatomy-muted);font-weight:400}
[data-fig="${id}"] .sp-cell[data-picked]{box-shadow:inset 0 0 0 1.5px var(--anatomy-strong);opacity:1}
[data-fig="${id}"] .btn:disabled{opacity:.45}
[data-fig="${id}"] .sp-tau{text-transform:none;letter-spacing:0}
[data-fig="${id}"] .sp-shutter>.iso-top{fill:var(--anatomy-face)}
[data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-fill,[data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="0"]{fill:var(--anatomy-text);stroke:var(--anatomy-text)}
[data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="1"]{fill:var(--anatomy-hi);stroke:var(--anatomy-hi)}
[data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="2"]{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}
[data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="3"]{fill:var(--anatomy-lit);stroke:var(--anatomy-lit)}
.iso[data-theme="light"] [data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-fill,.iso[data-theme="light"] [data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="0"]{fill:var(--anatomy-hi);stroke:var(--anatomy-hi)}
.iso[data-theme="light"] [data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="1"]{fill:var(--anatomy-dot);stroke:var(--anatomy-dot)}
.iso[data-theme="light"] [data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="2"]{fill:var(--anatomy-text);stroke:var(--anatomy-text)}
.iso[data-theme="light"] [data-fig="${id}"] [data-part="ball"] .iso-solid>.iso-shade[data-shade="3"]{fill:var(--anatomy-mid);stroke:var(--anatomy-mid)}
[data-fig="${id}"] [data-window]{transition:opacity .2s}
@media (max-width:640px){[data-fig="${id}"] .sp-cells{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:560px){[data-fig="${id}"] .iso-stage{overflow:hidden;margin:0 -10px}[data-fig="${id}"] .iso-stage .iso-svg{width:118%;max-width:none;margin-left:-9%}}
@media (prefers-reduced-motion:reduce){[data-fig="${id}"] .sp-cell,[data-fig="${id}"] [data-window]{transition:none}}
`;
  return { html: html.replace("change τ</span>", 'change <span class="sp-tau">τ</span></span>'), css, script, needs: ["lathe"] };
}

// The page's live code. Runs with root = the <figure>, the kit as k, the lathe as G and the
// site runtime (STILL, figureLoop, readoutOf, follow, springTo).
const LIVE = String.raw`
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const nodes = {
  low: part("rotor-low"), ring: part("rotor-ring"), rods: part("rods"), ball: part("ball"), pin: part("pin"),
  pointer: part("pointer"), slugs: part("slugs"), cards: part("cards"),
};
const windows = [...svg.querySelectorAll("[data-window]")];
const genButton = root.querySelector('[data-act="generate"]');
const resetButton = root.querySelector('[data-act="reset"]');
const modeButtons = [...root.querySelectorAll("[data-mode]")];
const range = root.querySelector('input[type="range"]');
const tauOut = root.querySelector('[data-out="tau"]');
const contextOut = root.querySelector('[data-out="context"]');
const cells = [...root.querySelectorAll("[data-cell]")];
const liveRegion = root.querySelector("[data-live]");
const say = readoutOf(root);
const SVGNS = "http://www.w3.org/2000/svg";

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out3 = (t) => 1 - Math.pow(1 - t, 3);
const out4 = (t) => 1 - Math.pow(1 - t, 4);
const smooth = (t) => t * t * (3 - 2 * t);
const quote = (token) => "'" + token + "'";
// On screen, a leading space shows as ␣, as in the other figures; screen readers get quotes.
const spaced = (token) => token.replace(/^ /, "\u2423");
const wrap = (a) => ((a % TURN) + TURN) % TURN;
const cumulative = (p) => p.reduce((list, value) => (list.push(list[list.length - 1] + value), list), [0]);
const BRAKE_STOP = D.brake.angle - (D.ball.r + 1.2) / D.ball.track;

const S = {
  picked: [],
  tau: TAU.start,
  mode: "top-p",
  tauShown: TAU.start,
  zFrom: null,
  zTo: null,
  mix: 1,
  shut: new Array(8).fill(0),
  rotor: 0,
  ball: { r: D.ball.track, a: D.rest },
  pin: 0,
  phase: "idle",
  plan: null,
  last: null,
  fresh: false,
  slugs: [],
  cards: [],
  fades: [],
  shownTokens: null,
};

const stepNow = () => stepOf(S.picked, S.tau, S.mode);
const zShown = () => S.zFrom.map((z, i) => z + (S.zTo[i] - z) * smooth(S.mix));
const pShown = () => softmax(zShown(), S.tauShown);
const indexAngle = (p) => D.brake.angle - Math.PI * p[0];

// ---- drawing ----
let lastRotor = "", lastRods = "", lastPointer = "";
function draw() {
  const p = pShown();
  const bounds = cumulative(p);
  const rotorKey = S.rotor.toFixed(4) + bounds.map((b) => b.toFixed(4)).join() + S.shut.map((s) => s.toFixed(3)).join();
  if (rotorKey !== lastRotor) {
    lastRotor = rotorKey;
    nodes.low.innerHTML = rotorLow(S.rotor, bounds, S.shut);
    nodes.ring.innerHTML = rotorRing(S.rotor, bounds);
  }
  const heights = zShown().map((z) => z * D.perLogit);
  const rodsKey = heights.map((h) => h.toFixed(2)).join();
  if (rodsKey !== lastRods) {
    lastRods = rodsKey;
    nodes.rods.innerHTML = rodsSvg(heights);
  }
  const pointerKey = S.tauShown.toFixed(3);
  if (pointerKey !== lastPointer) {
    lastPointer = pointerKey;
    const pointer = pointerAt(S.tauShown);
    nodes.pointer.innerHTML = k.lineSvg(pointer.d, { tone: "hi" }) + k.dotsSvg([pointer.dot], { size: 0.6, tone: "hi" });
  }
  const ballAt = wheelAt(S.ball.r, S.ball.a, ballZ(S.ball.r));
  nodes.ball.setAttribute("transform", k.translateAlong(P, ballAt));
  nodes.pin.setAttribute("transform", k.translateAlong(P, [0, 0, (D.brake.pin[0] - D.brake.pin[1]) * S.pin]));
  // Window labels cross-fade at the middle of a rescore.
  const tokens = (S.mix < 0.5 && S.fromTokens ? S.fromTokens : stepNow().candidates.map((c) => c.token)).map((t) => t.trim() || t);
  const fade = S.mix < 1 ? Math.abs(S.mix - 0.5) * 2 : 1;
  windows.forEach((node, index) => {
    if (node.textContent !== tokens[index]) node.textContent = tokens[index];
    const value = fade.toFixed(2);
    if (node.getAttribute("opacity") !== value) node.setAttribute("opacity", value);
  });
  for (const item of S.slugs.concat(S.cards)) {
    const offset = item.dx ? k.translateAlong(P, [item.dx, 0, 0]) : "";
    if ((item.node.getAttribute("transform") || "") !== offset) offset ? item.node.setAttribute("transform", offset) : item.node.removeAttribute("transform");
  }
}

function groupOf(markup) {
  const node = document.createElementNS(SVGNS, "g");
  node.innerHTML = markup;
  return node;
}
function addSlug(token, generated) {
  const text = token.trim() || token;
  const x = S.slugs.reduce((sum, slug) => sum + slug.w + D.slug.gap, D.slug.start);
  const slug = { token, w: slugWidth(text), x, generated, node: groupOf(slugSvg(text, x, generated)) };
  nodes.slugs.appendChild(slug.node);
  S.slugs.push(slug);
  return slug;
}
function addCard(generated) {
  const x = D.card.first + S.cards.length * D.card.pitch;
  const card = { x, generated, node: groupOf(cardSvg(x)) };
  nodes.cards.appendChild(card.node);
  S.cards.push(card);
  return card;
}

// ---- words ----
function table() {
  const step = stepNow();
  const shown = Math.min(S.picked.length, STEPS - 1);
  const picked = S.fresh && S.last && S.last.depth === shown && (S.phase !== "idle" || S.picked.length >= STEPS) ? S.last.index : -1;
  cells.forEach((cell, index) => {
    const c = step.candidates[index];
    const set = (name, text) => {
      const node = cell.querySelector("[data-" + name + "]");
      if (node.textContent !== text) node.textContent = text;
    };
    set("token", spaced(c.token));
    set("z", c.z.toFixed(1));
    set("p", step.p[index].toFixed(2));
    set("q", step.q[index].toFixed(2));
    cell.toggleAttribute("data-shut", !step.kept[index]);
    cell.toggleAttribute("data-picked", index === picked);
  });
}
function context() {
  const tokens = PROMPT.concat(S.picked);
  const fresh = S.picked.length ? tokens.length - 1 : -1;
  contextOut.innerHTML = tokens.map((t, i) => '<span' + (i === fresh ? " data-new" : "") + ">" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span>").join("").replace(/<span( data-new)?> /g, " <span$1>");
}
function readout() {
  const head = "τ " + S.tau.toFixed(1) + " · " + S.mode;
  if (S.phase === "draw" && !(S.plan && S.plan.landed)) return say(head + " · drawing");
  if (S.fresh && S.last) return say(head + " · picked " + spaced(S.last.token) + " at " + S.last.value.toFixed(2));
  if (S.picked.length >= STEPS) return say(head + " · stick full");
  const step = stepNow();
  if (S.mode === "greedy") return say(head + " · takes " + spaced(step.candidates[0].token));
  return say(head + " · " + step.open + " of 8 open");
}
function describe() {
  const step = stepNow();
  stage.setAttribute("aria-valuenow", S.tau.toFixed(1));
  const rule = S.mode === "greedy" ? "greedy, the brake takes " + quote(step.candidates[0].token) : S.mode + ", " + step.open + " of 8 pockets open";
  stage.setAttribute("aria-valuetext", "Temperature " + S.tau.toFixed(1) + ", " + rule);
}
function controlsBusy(busy) {
  const full = S.picked.length >= STEPS;
  genButton.disabled = busy || full;
  genButton.textContent = full ? "Stick full" : "Generate next token";
  resetButton.disabled = busy || S.picked.length === 0;
  range.disabled = busy;
  modeButtons.forEach((button) => (button.disabled = busy));
}

// ---- actions ----
function setTau(value) {
  const tau = Math.round(Math.min(TAU.max, Math.max(TAU.min, value)) * 10) / 10;
  if (tau === S.tau) return;
  S.tau = tau;
  S.fresh = false;
  range.value = String(tau);
  tauOut.textContent = tau.toFixed(1);
  table();
  describe();
  readout();
  loop.kick();
}
function setMode(mode) {
  if (mode === S.mode) return;
  S.mode = mode;
  S.fresh = false;
  modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  table();
  describe();
  readout();
  loop.kick();
}
function rescore() {
  S.zFrom = zShown();
  S.fromTokens = windows.map((node) => node.textContent);
  S.zTo = stepNow().candidates.map((c) => c.z);
  S.mix = 0;
}
function generate(u) {
  if (S.phase !== "idle" || S.picked.length >= STEPS) return;
  const step = stepNow();
  const index = pickOf(step.q, u);
  const token = step.candidates[index].token;
  const value = S.mode === "greedy" ? step.p[index] : step.q[index];
  S.fresh = false;
  S.phase = "draw";
  const plan = { t: 0, index, token, value, landed: false, appended: false };
  const p = pShown();
  const bounds = cumulative(p);
  const alpha = TURN * (bounds[index] + bounds[index + 1]) / 2;
  if (S.mode === "greedy") {
    let run = wrap(BRAKE_STOP - S.ball.a);
    if (run < 0.8) run += TURN;
    Object.assign(plan, { kind: "brake", a0: S.ball.a, run, tRun: 0.8 + 1.1 * (run / TURN), tDrop: 0.75 });
    plan.land = plan.tRun + plan.tDrop;
  } else {
    const beta0 = S.ball.a - S.rotor;
    let extra = alpha - beta0;
    extra += TURN * Math.ceil((2.6 * TURN - extra) / TURN);
    Object.assign(plan, { kind: "spin", theta0: S.rotor, spin: TURN * 1.15, beta0, extra: extra - alpha + beta0, land: 3.55, rotorEnd: 4.1 });
  }
  plan.end = plan.land + 2.7;
  S.plan = plan;
  controlsBusy(true);
  readout();
  if (STILL.matches) finishInstantly();
  loop.kick();
}
function finishInstantly() {
  const plan = S.plan;
  land(plan);
  append(plan, true);
}
function land(plan) {
  plan.landed = true;
  S.last = { token: plan.token, value: plan.value, index: plan.index, depth: S.picked.length };
  S.fresh = true;
  table();
  readout();
  liveRegion.textContent = "Picked " + quote(plan.token) + " at " + plan.value.toFixed(2) + ".";
}
function append(plan, instant) {
  plan.appended = true;
  const slug = addSlug(plan.token, true);
  const card = addCard(true);
  slug.dx = instant ? 0 : D.caster.x + 1 - slug.x;
  card.dx = instant ? 0 : D.writer.x + 2 - card.x;
  plan.slug = slug;
  plan.card = card;
  if (instant) settle(plan);
}
function settle(plan) {
  S.picked.push(plan.token);
  context();
  if (S.picked.length < STEPS) {
    rescore();
    if (STILL.matches) S.mix = 1;
    S.ball.r = STILL.matches ? D.ball.track : S.ball.r;
    plan.returning = true;
  }
  S.phase = "idle";
  S.plan = STILL.matches ? null : plan;
  plan.settled = true;
  controlsBusy(false);
  table();
  describe();
  readout();
  liveRegion.textContent = "Picked " + quote(plan.token) + ". Context: " + PROMPT.concat(S.picked).join("") + ".";
}
function reset() {
  if (S.phase !== "idle" || !S.picked.length) return;
  for (const item of S.slugs.concat(S.cards)) if (item.generated) S.fades.push({ item, t: 0 });
  S.slugs = S.slugs.filter((slug) => !slug.generated);
  S.cards = S.cards.filter((card) => !card.generated);
  S.picked = [];
  S.fresh = false;
  S.last = null;
  rescore();
  if (STILL.matches) S.mix = 1;
  if (S.ball.r < D.ball.track) S.plan = { returning: true, settled: true, t: 0, end: 0.9, retFrom: S.ball.r };
  context();
  controlsBusy(false);
  table();
  describe();
  readout();
  liveRegion.textContent = "Reset. The context is the prompt again.";
  loop.kick();
}

// ---- motion ----
// A launch eases in over 0.3 s: w(t) = t²/0.6, then t − 0.15, so speed never jumps.
const warp = (t) => (t < 0.3 ? (t * t) / 0.6 : t - 0.15);
function runPlan(plan, dt, calm) {
  plan.t += dt;
  const t = plan.t;
  if (plan.kind === "spin" && !plan.settled) {
    const w = warp(t);
    S.rotor = plan.theta0 - plan.spin * out3(clamp01(w / plan.rotorEnd));
    const bounds = cumulative(pShown());
    const alpha = TURN * (bounds[plan.index] + bounds[plan.index + 1]) / 2;
    const s = clamp01(w / (plan.land - 0.15));
    const beta = plan.beta0 + (alpha + plan.extra - plan.beta0) * out4(s);
    S.ball.a = S.rotor + beta;
    S.ball.r = dropRadius(s, 0.56, 0.86, w - (plan.land - 0.15) * 0.86);
  } else if (plan.kind === "brake" && !plan.settled) {
    S.rotor = follow(S.rotor, S.rotor + ((((indexAngle(pShown()) - S.rotor) % TURN) + TURN + Math.PI) % TURN) - Math.PI, dt, 0.3, calm);
    if (t < plan.tRun) {
      S.ball.a = plan.a0 + plan.run * inOut(t / plan.tRun);
      S.ball.r = D.ball.track;
    } else {
      const s = clamp01((t - plan.tRun) / plan.tDrop);
      S.ball.a = BRAKE_STOP + (D.brake.angle - BRAKE_STOP) * smooth(s);
      S.ball.r = dropRadius(s, 0, 1, t - plan.tRun - plan.tDrop);
    }
  }
  if (!plan.landed && t >= plan.land) land(plan);
  if (plan.landed && !plan.appended && t >= plan.land + 0.3) append(plan, false);
  for (const [item, start] of [[plan.slug, plan.land + 0.3], [plan.card, plan.land + 0.55]]) {
    if (!item || plan.settled) continue;
    const from = item === plan.slug ? D.caster.x + 1 - item.x : D.writer.x + 2 - item.x;
    item.dx = from * (1 - inOut(clamp01((t - start) / 1.0)));
  }
  if (plan.appended && !plan.settled && t >= plan.land + 1.7) {
    plan.slug.dx = 0;
    plan.card.dx = 0;
    settle(plan);
    plan.retAt = t;
    plan.retFrom = S.ball.r;
  }
  if (plan.returning && plan.settled) {
    const start = plan.retAt === undefined ? 0 : plan.retAt;
    const s = clamp01((t - start) / 0.8);
    const from = plan.retFrom === undefined ? D.ball.seat : plan.retFrom;
    S.ball.r = from + (D.ball.track - from) * smooth(s);
    if (s >= 1) S.plan = null;
  } else if (plan.settled) S.plan = null;
}
// Radius while the ball drops: down the apron, over the ring, into the pocket, then a damped bounce.
function dropRadius(s, s0, s1, after) {
  const r0 = D.ball.track;
  const seat = D.ball.seat;
  if (s <= s0) return r0;
  if (s < s1) {
    const u = (s - s0) / (s1 - s0);
    return r0 + (seat - 1.6 - r0) * u * u;
  }
  return seat - 1.6 * Math.exp(-after / 0.2) * Math.cos(after * 13);
}

let touring = !STILL.matches;
let idleTimer = 0;
const TOUR = [
  ["wait", 1.4], ["gen", 0.62], ["wait", 1.4], ["gen", 0.4], ["wait", 1.2], ["tau", 1.6], ["wait", 1.4], ["gen", 0.83], ["wait", 2.2], ["reset"], ["wait", 1],
  ["mode", "greedy"], ["wait", 1.4], ["gen", 0.5], ["wait", 1.2], ["tau", 0.4], ["wait", 1.2], ["gen", 0.5], ["wait", 1.4],
  ["mode", "top-k"], ["tau", 1.2], ["wait", 1.4], ["gen", 0.71], ["wait", 2.2], ["reset"], ["wait", 1], ["mode", "top-p"], ["tau", 0.8], ["wait", 1.6],
];
const tour = { index: 0, wait: 0, glide: null };
function tourStep(dt) {
  if (tour.glide) {
    tour.glide.t += dt;
    const s = clamp01(tour.glide.t / tour.glide.length);
    setTau(tour.glide.from + (tour.glide.to - tour.glide.from) * inOut(s));
    if (s >= 1) tour.glide = null;
    return;
  }
  if (tour.wait > 0) {
    tour.wait -= dt;
    return;
  }
  if (S.phase !== "idle" || S.plan) return;
  const [action, value] = TOUR[tour.index];
  tour.index = (tour.index + 1) % TOUR.length;
  if (action === "wait") tour.wait = value;
  else if (action === "gen") generate(value);
  else if (action === "tau") tour.glide = { from: S.tau, to: value, t: 0, length: Math.abs(value - S.tau) * 1.4 + 0.3 };
  else if (action === "mode") setMode(value);
  else if (action === "reset") reset();
}

const loop = figureLoop(stage, (dt, calm) => {
  if (touring && !calm) tourStep(dt);
  let moving = false;
  const nextTau = follow(S.tauShown, S.tau, dt, 0.22, calm);
  if (nextTau !== S.tauShown) moving = true;
  S.tauShown = nextTau;
  if (S.mix < 1) {
    S.mix = calm ? 1 : Math.min(1, S.mix + dt / 0.9);
    moving = true;
  }
  const p = pShown();
  // Top-k and top-p close shutters. Greedy leaves every pocket open and drops the brake pin instead.
  const kept = S.mode === "greedy" ? p.map(() => true) : keptOf(p, S.mode);
  S.shut = S.shut.map((value, index) => {
    const next = follow(value, kept[index] ? 0 : 1, dt, 0.16, calm);
    if (next !== value) moving = true;
    return next;
  });
  const pin = follow(S.pin, S.mode === "greedy" ? 1 : 0, dt, 0.14, calm);
  if (pin !== S.pin) moving = true;
  S.pin = pin;
  if (S.plan) {
    runPlan(S.plan, dt, calm);
    moving = true;
  } else if (S.mode === "greedy") {
    const target = S.rotor + ((((indexAngle(p) - S.rotor) % TURN) + TURN + Math.PI) % TURN) - Math.PI;
    const next = follow(S.rotor, target, dt, 0.3, calm);
    if (next !== S.rotor) moving = true;
    S.rotor = next;
  }
  for (const fade of S.fades) {
    fade.t += dt;
    const s = calm ? 1 : clamp01(fade.t / 0.45);
    fade.item.node.setAttribute("opacity", (1 - s).toFixed(2));
    fade.item.node.setAttribute("transform", k.translateAlong(P, [0, 0, 6 * smooth(s)]));
    if (s >= 1) fade.item.node.remove();
    moving = true;
  }
  S.fades = S.fades.filter((fade) => fade.item.node.isConnected);
  draw();
  return moving || touring;
});

function steer() {
  touring = false;
  tour.glide = null;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !STILL.matches;
    tour.wait = 1;
    loop.kick();
  }, 6000);
  loop.kick();
}
genButton.addEventListener("click", () => { steer(); generate(Math.random()); });
resetButton.addEventListener("click", () => { steer(); reset(); });
modeButtons.forEach((button) => button.addEventListener("click", () => { steer(); setMode(button.dataset.mode); }));
range.addEventListener("input", () => { steer(); setTau(Number(range.value)); });
stage.addEventListener("pointerdown", () => steer());
stage.addEventListener("keydown", (event) => {
  const busy = S.phase !== "idle";
  if (event.key === " " || event.key === "Enter") { steer(); generate(Math.random()); }
  else if (busy && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "1", "2", "3", "r", "R"].includes(event.key)) {}
  else if (event.key === "ArrowRight" || event.key === "ArrowUp") { steer(); setTau(S.tau + 0.1); }
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") { steer(); setTau(S.tau - 0.1); }
  else if (event.key === "Home") { steer(); setTau(TAU.min); }
  else if (event.key === "End") { steer(); setTau(TAU.max); }
  else if (event.key === "1" || event.key === "2" || event.key === "3") { steer(); setMode(["greedy", "top-k", "top-p"][Number(event.key) - 1]); }
  else if (event.key === "r" || event.key === "R") { steer(); reset(); }
  else return;
  event.preventDefault();
});

// ---- start ----
(function start() {
  const step = stepNow();
  S.zFrom = step.candidates.map((c) => c.z);
  S.zTo = S.zFrom.slice();
  S.shut = step.kept.map((keep) => (keep ? 0 : 1));
  S.rotor = VIEW - Math.PI * step.p[0];
  PROMPT.forEach((token) => { addSlug(token, false); addCard(false); });
  if (STILL.matches) touring = false;
  context();
  table();
  describe();
  readout();
  controlsBusy(false);
  draw();
})();
`;
