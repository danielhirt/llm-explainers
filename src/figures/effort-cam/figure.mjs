// Fig: reasoning effort as a cam tracer. Three profile templates stand in a magazine, one per
// task; each template's top edge is that task's quality curve. A gantry runs along the token
// scale on two rails, driven by a lead screw and a handwheel, and its roller follower rides the
// selected template. The dial gauge on the gantry reads quality. Moving the gantry right is
// spending thinking tokens; the follower stops rising where the curve flattens.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { TASKS, LEVELS, MAX_TOKENS, TOKENS_PER_SECOND, OUTPUT_RATE, quality } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 400;

const PER_K = 8; // world units per 1,000 tokens
const XMAX = (MAX_TOKENS / 1000) * PER_K; // 256
const Q_SCALE = 0.56; // world units per quality point
const xOf = (tokens) => (tokens / 1000) * PER_K;
const tokensAt = (x) => (Math.max(0, Math.min(XMAX, x)) / PER_K) * 1000;

const PLATE = { x: -40, y: -78, w: 346, d: 144, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const RAIL_BACK = { x: -14, y: -68, w: 288, d: 6, r: 1 };
const RAIL_FRONT = { x: -14, y: 41, w: 288, d: 6, r: 1 };
const RAIL_H = 4;

// The template magazine slides along y so the chosen template sits on the follower line.
const LINE_Y = -6;
const SLOT = 16;
const T = 3; // template thickness
const MAG_Z = [4, 10];
const magOffset = (index) => LINE_Y - (index - 1) * SLOT; // magazine centre y for a selected template
const MAG_REST = magOffset(1);
const TPL_X = [-4, XMAX + 4];

// Gantry, built at x = 0.
const BEAM_Z = [86, 94];
const BUSH = { r: 3.6, z: [76, 86] };
const DIAL = { r: 13, z: [97, 104] };
const ROLLER_R = 3;
const ROD_R = 1.2;
const LIFT = 70; // follower lift height (roller centre) while the magazine moves

// Lead screw along x, in front of the magazine, with a handwheel at the right end.
const SCREW = { y: 33, z: 14, r: 2.2, x: [-24, 278] };
const WHEEL = { x: [280, 284], r: 9 };
const TURNS_PER_K = 0.5;

const RULER = { x: -4, y: 52, w: 264, d: 7, r: 1 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-6, -66, DIAL.z[1]], [XMAX + 6, -66, DIAL.z[1]], [0, LINE_Y, DIAL.z[1] + 2], [WHEEL.x[1] + 9, SCREW.y, SCREW.z + WHEEL.r]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 57 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 10) / 10;
const poly = (points) => `M${points.map(([x, y]) => `${fix(x)} ${fix(y)}`).join("L")}Z`;
const { sinA, cosA } = k.cameraOf(P);
const [VX, VY] = k.towardViewer(P);
const shadeOf = (nx, ny) => Math.min(3, Math.max(0, Math.floor(((nx * -sinA + ny * cosA + 1) / 2) * 4)));
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// The top edge of a task's template, in world z.
const topOf = (task) => (x) => MAG_Z[1] + Q_SCALE * quality(task, tokensAt(x));

// A plate standing on edge in the x–z plane, its top edge a curve. Convex (the region under a
// concave curve), so the hull is the outline; the front (+y) face, the right end and the top
// ribbon are the visible faces at this camera.
function profilePlate(top, x0, x1, yc, zb, samples = 72) {
  const xs = Array.from({ length: samples + 1 }, (_, index) => x0 + ((x1 - x0) * index) / samples);
  const yF = yc + T / 2;
  const yB = yc - T / 2;
  const front = xs.map((x) => at([x, yF, top(x)]));
  const back = xs.map((x) => at([x, yB, top(x)]));
  const f0 = at([x0, yF, zb]);
  const f1 = at([x1, yF, zb]);
  const b0 = at([x0, yB, zb]);
  const b1 = at([x1, yB, zb]);
  const hull = G.hullOf([...front, ...back, f0, f1, b0, b1]);
  const shades = ["", "", "", ""];
  shades[shadeOf(0, 1)] += poly([f0, ...front, f1]);
  shades[shadeOf(1, 0)] += poly([f1, front[front.length - 1], back[back.length - 1], b1]);
  return {
    fill: poly(hull),
    outline: poly(hull),
    crease: k.pathOf(front) + k.pathOf([front[front.length - 1], back[back.length - 1]]),
    top: poly([...front, ...[...back].reverse()]),
    shades,
  };
}

// The near half of a horizontal circle, limb to limb, as screen points.
function nearArc(cx, cy, r, z, n = 40) {
  const from = Math.atan2(VY, VX) - Math.PI / 2;
  return Array.from({ length: n + 1 }, (_, index) => {
    const t = from + (Math.PI * index) / n;
    return at([cx + r * Math.cos(t), cy + r * Math.sin(t), z]);
  });
}
// Everything below a ring's near arc: the part of a rod you can see below a bushing.
function below(cx, cy, r, z) {
  const arc = nearArc(cx, cy, r, z);
  const a = arc[0];
  const b = arc[arc.length - 1];
  const s = Math.sign(b[0] - a[0]);
  return poly([[a[0] - s * 40, a[1]], ...arc, [b[0] + s * 40, b[1]], [b[0] + s * 40, 2000], [a[0] - s * 40, 2000]]);
}

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler strip: one minor tick per 1,000 tokens, a major every 4,000, the zero mark in hi.
  out.push(S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(1, XMAX, PER_K, 4, RULER.y + 0.01, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([0, RULER.y + 0.01], [0, RULER.y + 4.8], 0.6, P), { tone: "hi" }));
  out.push(D([at([RULER.x + 1.6, RULER.y + 5.6, 0.6]), at([RULER.x + RULER.w - 1.6, RULER.y + 5.6, 0.6])], { size: 0.42 }));
  // Level pins on the strip at low, medium, high, and max.
  for (const level of LEVELS) {
    const x = xOf(level.tokens);
    out.push(S(k.cylinder(x, RULER.y + 5.2, 1.3, 0.6, 3.4, P, 16, 0.3), { tone: "mid" }));
  }
  // Label plate at the front right.
  const label = { x: 268, y: 46, w: 30, d: 13, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[272, 50.5, 22], [272, 53.5, 16], [272, 56.2, 19]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 2.2, label.y + label.d / 2, 0.8])], { size: 0.42 }));
  return out.join("");
}

function rail(plan) {
  const out = [S(k.slabOf(plan, 0, RAIL_H, P, 3, 0.4), { tone: "mid" })];
  out.push(L(k.lineOnTop([plan.x, plan.y + plan.d / 2], [plan.x + plan.w, plan.y + plan.d / 2], RAIL_H, P), { tone: "faint" }));
  out.push(D([plan.x + 8, plan.x + 96, plan.x + 192, plan.x + plan.w - 8].map((x) => at([x, plan.y + plan.d / 2, RAIL_H])), { size: 0.4 }));
  return out.join("");
}

function stops(plan) {
  return [plan.x - 5, plan.x + plan.w]
    .map((x) => S(k.slabOf({ x, y: plan.y - 2, w: 5, d: plan.d + 4, r: 1.2 }, 0, 8, P, 3, 0.5), { tone: "mid" }) + D([at([x + 2.5, plan.y + plan.d / 2, 8])], { size: 0.45 }))
    .join("");
}

function crossRails() {
  return [24, 224]
    .map((x) => {
      const plan = { x, y: -48, w: 8, d: 84, r: 1 };
      return S(k.slabOf(plan, 0, MAG_Z[0], P, 3, 0.3), { tone: "lo" }) + D([at([x + 4, -45, MAG_Z[0]]), at([x + 4, 33, MAG_Z[0]])], { size: 0.4 });
    })
    .join("");
}

// The magazine base, built at its rest offset (centre y = MAG_REST).
function magazine() {
  const plan = { x: -10, y: MAG_REST - 22, w: XMAX + 20, d: 44, r: 3 };
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 4), MAG_Z[0], 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(plan, MAG_Z[0], MAG_Z[1] - MAG_Z[0], P, 6, 0.6), { tone: "mid" }));
  for (let index = 0; index < 3; index++) {
    const y = MAG_REST + (index - 1) * SLOT;
    out.push(L(k.planOutline({ x: TPL_X[0] - 2, y: y - T / 2 - 1.2, w: TPL_X[1] - TPL_X[0] + 4, d: T + 2.4, r: 0.8 }, MAG_Z[1], P, 3), { tone: "faint" }));
  }
  out.push(D([plan.x + 3.5, plan.x + plan.w - 3.5].flatMap((x) => [at([x, plan.y + 3.5, MAG_Z[1]]), at([x, plan.y + plan.d - 3.5, MAG_Z[1]])]), { size: 0.45 }));
  // Index knob at the right end: turning it shuttles the magazine.
  const knob = [XMAX + 6, MAG_REST + 15];
  out.push(S(k.cylinder(knob[0], knob[1], 3.4, MAG_Z[1], 4.4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 3.4, MAG_Z[1], MAG_Z[1] + 4.4, 22, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([knob[0] - 1.6, knob[1]], [knob[0] + 2.6, knob[1]], MAG_Z[1] + 4.4, P), { tone: "hi", free: "end" }));
  return out.join("");
}

// One template, built at its rest offset in the magazine.
function template(task, index) {
  const yc = MAG_REST + (index - 1) * SLOT;
  const top = topOf(task);
  const yF = yc + T / 2;
  const datum = LEVELS.map((level) => {
    const x = xOf(level.tokens);
    return k.segment([x, yF, MAG_Z[1]], [x, yF, top(x)], P);
  }).join("");
  const pins = [12, XMAX - 12].map((x) => k.sideRing([x, yF, MAG_Z[1] + 4.6], 1.5, "y", P, 18)).join("");
  // Scribed grid: quality 25, 50 and 75 run from the left end to the curve or the right end,
  // and a line every 4,000 tokens runs from the base edge to the curve.
  const rows = [25, 50, 75]
    .map((q) => {
      const z = MAG_Z[1] + Q_SCALE * q;
      if (top(TPL_X[0]) <= z) return "";
      let x1 = TPL_X[1];
      for (let x = TPL_X[0]; x <= TPL_X[1]; x += 0.25) if (top(x) <= z) { x1 = x; break; }
      // A row that reaches the right end wraps onto the end face and ends on the back edge.
      const wrap = x1 === TPL_X[1] ? [[TPL_X[1], yc - T / 2, z]] : [];
      return k.pathOf([[TPL_X[0], yF, z], [x1, yF, z], ...wrap].map(at));
    })
    .join("");
  const columns = [4, 12, 20, 24, 28]
    .map((kTokens) => {
      const x = xOf(kTokens * 1000);
      return k.segment([x, yF, MAG_Z[1]], [x, yF, top(x)], P);
    })
    .join("");
  const tag = k.sideMatrix([22, yF], MAG_Z[1] + 13, P, "left");
  const tagLines = `<g transform="${tag}"><path class="iso-line" data-tone="lo" d="M0 0h20v7h-20Z"/><path class="iso-line" data-tone="faint" data-free="" d="M2.4 2.6h11M2.4 4.8h7.4"/></g>`;
  const inner = L(datum, { tone: "lo" }) + `<g class="ec-grid">${L(rows + columns, { tone: "faint" })}</g>` + L(pins, { tone: "lo" }) + tagLines;
  return S(profilePlate(top, TPL_X[0], TPL_X[1], yc, MAG_Z[1]), { tone: "hi", inner }) + D([12, XMAX - 12].map((x) => at([x, yF, MAG_Z[1] + 4.6])), { size: 0.5, tone: "mid" });
}

// Static screw, bearing blocks and handwheel rim. The handle is drawn live.
const SCREW_F = G.frameAlong([SCREW.x[0], SCREW.y, SCREW.z], [1, 0, 0]);
const WHEEL_F = G.frameAlong([WHEEL.x[0], SCREW.y, SCREW.z], [1, 0, 0]);
const WHEEL_FACE = WHEEL.x[1] - WHEEL.x[0];
function screw() {
  const out = [];
  for (const x of [-30, 270]) {
    const block = { x, y: SCREW.y - 6, w: 8, d: 12, r: 1 };
    out.push(S(k.slabOf(block, 0, SCREW.z + 6, P, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 4, SCREW.y - 3.6, SCREW.z + 6]), at([x + 4, SCREW.y + 3.6, SCREW.z + 6])], { size: 0.45 }));
  }
  const length = SCREW.x[1] - SCREW.x[0];
  const threads = [];
  for (let s = 2; s < length - 1; s += 2.4) threads.push(G.arcOf(SCREW_F, s, SCREW.r, P));
  out.push(S(G.disc(0, length, SCREW.r, SCREW_F, P), { tone: "mid", inner: L(threads.join(""), { tone: "faint" }) }));
  // Handwheel: a disc with a knurled rim and a hub.
  const ribs = G.ribsOf(WHEEL_F, 0, WHEEL_FACE, WHEEL.r, 64, P, { fade: [0.08, 0.5] });
  out.push(S(G.disc(0, WHEEL_FACE, WHEEL.r, WHEEL_F, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
  out.push(L(G.circleOf(WHEEL_F, WHEEL_FACE, WHEEL.r - 2.2, P), { tone: "faint" }));
  out.push(S(G.disc(WHEEL_FACE, WHEEL_FACE + 1.6, 3, WHEEL_F, P), { tone: "mid" }));
  out.push(D([at([WHEEL.x[1] + 1.6, SCREW.y, SCREW.z])], { size: 0.55, tone: "hi" }));
  return out.join("");
}

// The handle pin and knob on the wheel face, at a turn angle. The page runs this same function.
function handleAt(turn) {
  const angle = turn * Math.PI * 2;
  const r = WHEEL.r - 3.4;
  const centre = [WHEEL.x[1], SCREW.y + r * Math.cos(angle), SCREW.z + r * Math.sin(angle)];
  const F = G.frameAlong(centre, [1, 0, 0]);
  return k.solidSvg(G.disc(0, 4.2, 0.9, F, P), { tone: "mid" }) + k.solidSvg(G.disc(4.2, 9, 2, F, P), { tone: "hi" });
}

// Gantry pieces, built at x = 0.
function gantryBack() {
  const out = [];
  out.push(S(k.slabOf({ x: -10, y: -70, w: 20, d: 10, r: 1.5 }, RAIL_H, 6, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -6, y: -69, w: 12, d: 8, r: 1 }, RAIL_H + 6, BEAM_Z[0] - RAIL_H - 6, P, 3, 0.5), { tone: "mid" }));
  return out.join("");
}

function gantryFront() {
  const out = [];
  out.push(S(k.slabOf({ x: -10, y: 39, w: 20, d: 10, r: 1.5 }, RAIL_H, 6, P, 4, 0.5), { tone: "mid" }));
  out.push(D([at([-7, 47, RAIL_H + 6]), at([7, 47, RAIL_H + 6])], { size: 0.45 }));
  // Nut block round the lead screw.
  out.push(S(k.slabOf({ x: -7, y: SCREW.y - 5, w: 14, d: 13, r: 1 }, SCREW.z - 6, 12.4, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([-4.4, SCREW.y + 5.5, SCREW.z + 6.4]), at([4.4, SCREW.y + 5.5, SCREW.z + 6.4])], { size: 0.42 }));
  out.push(S(k.slabOf({ x: -6, y: 40, w: 12, d: 8, r: 1 }, RAIL_H + 6, BEAM_Z[0] - RAIL_H - 6, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam({ x: -6, y: 40, w: 12, d: 8, r: 1 }, 40, P, 3), { tone: "faint" }) }));
  // Counter on the post: five windows on its front face.
  const box = { x: -7.4, y: 48, w: 14.8, d: 4.6, r: 0.8 };
  out.push(S(k.slabOf(box, 50, 11, P, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

const COUNTER = { y: 52.6, x0: -6.2, z: 59, w: 2.2, h: 3.4, gap: 0.3 };
const counterMatrix = k.sideMatrix([0, COUNTER.y], COUNTER.z, P, "left");
function counterFace() {
  const cells = Array.from({ length: 5 }, (_, index) => {
    const x = COUNTER.x0 + index * (COUNTER.w + COUNTER.gap);
    return `M${fix(x)} 0h${COUNTER.w}v${COUNTER.h}h${-COUNTER.w}Z`;
  }).join("");
  const digits = Array.from({ length: 5 }, (_, index) => `<text class="iso-face-text" data-tone="hi" x="${fix(COUNTER.x0 + index * (COUNTER.w + COUNTER.gap) + COUNTER.w / 2)}" y="${fix(COUNTER.h - 0.75)}" font-size="2.6" text-anchor="middle" data-digit="${index}">0</text>`).join("");
  return `<g transform="${counterMatrix}"><path class="iso-line" data-tone="lo" d="${cells}"/>${digits}</g>`;
}

function gantryTop() {
  const out = [];
  out.push(S(k.cylinder(0, LINE_Y, BUSH.r, BUSH.z[0], BUSH.z[1] - BUSH.z[0], P, 24, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -7, y: -70, w: 14, d: 120, r: 2 }, BEAM_Z[0], BEAM_Z[1] - BEAM_Z[0], P, 4, 0.8), { tone: "mid" }));
  out.push(D([-64, -40, 28, 44].map((y) => at([0, y, BEAM_Z[1]])), { size: 0.45 }));
  out.push(L(k.lineOnTop([-7, -30], [7, -30], BEAM_Z[1], P) + k.lineOnTop([-7, 18], [7, 18], BEAM_Z[1], P), { tone: "faint" }));
  // Dial gauge, face up, on a short stem.
  const [x, y] = [0, LINE_Y];
  out.push(S(k.cylinder(x, y, 3, BEAM_Z[1], DIAL.z[0] - BEAM_Z[1], P, 20), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x + DIAL.r - 1, y: y - 2.2, w: 4.4, d: 4.4, r: 1 }, DIAL.z[0] + 1.6, 4, P, 3), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, DIAL.r, DIAL.z[0], DIAL.z[1] - DIAL.z[0], P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, DIAL.r, DIAL.z[1] - 2.8, DIAL.z[1], 72, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(x, y, DIAL.r, DIAL.z[1] - 2.8, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, DIAL.r - 2, DIAL.z[1], P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, DIAL.r - 2.6, 50, 5, DIAL.z[1], [1.1, 2.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.4, DIAL.z[1], P, 16), { tone: "mid" }));
  return out.join("");
}

const needleAt = (q) => {
  const angle = (q / 100) * Math.PI * 2;
  const [x, y] = [0, LINE_Y];
  const r = DIAL.r - 3.4;
  return k.lineOnTop([x - Math.sin(angle) * 2.6, y + Math.cos(angle) * 2.6], [x + Math.sin(angle) * r, y - Math.cos(angle) * r], DIAL.z[1] + 0.2, P);
};

// The follower: rod, fork and roller, built with the roller centre at REST_C.
const REST_C = 40;
function follower() {
  const out = [];
  const forkTop = REST_C + 5;
  out.push(S(k.cylinder(0, LINE_Y, ROD_R, forkTop + 2.2, 70, P, 16), { tone: "hi", lit: true, crease: "none" }));
  out.push(S(k.cylinder(0, LINE_Y, 2.2, forkTop, 2.2, P, 18, 0.3), { tone: "hi", lit: true }));
  for (const dy of [-3.4, 2.2]) out.push(S(k.slabOf({ x: -1.6, y: LINE_Y + dy, w: 3.2, d: 1.2, r: 0.3 }, REST_C - 0.6, forkTop - REST_C + 0.6, P, 2), { tone: "hi", lit: true }));
  const F = G.frameAlong([0, LINE_Y - 2.2, REST_C], [0, 1, 0]);
  out.push(S(G.disc(0, 4.4, ROLLER_R, F, P), { tone: "hi", lit: true, inner: L(G.circleOf(F, 4.4, ROLLER_R - 1, P), { tone: "faint" }) }));
  out.push(S(G.disc(4.4, 5.6, 0.9, F, P), { tone: "hi", lit: true }));
  return out.join("");
}

const ROD_CLIP = below(0, LINE_Y, BUSH.r, BUSH.z[0]);

export function build({ fig = "Fig 1", id = "effort-cam" } = {}) {
  const initial = 1;
  const templates = TASKS.map((task, index) => `<g data-part="tpl" data-index="${index}"${index === initial ? " data-on" : ""}>${template(task, index)}</g>`);
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A cam tracer on a base plate. Three profile templates stand on edge in a sliding magazine, one per task: a mechanical rename, a mid-size feature and a concurrency bug. Each template's top edge is that task's quality curve. A gantry runs along a token scale from 0 to 32,000 thinking tokens, driven by a lead screw and a handwheel, and its roller follower rides the chosen template while a dial gauge reads the quality.",
    body: [
      `<defs><clipPath id="${id}-rod"><path d="${ROD_CLIP}"/></clipPath></defs>`,
      base(),
      rail(RAIL_BACK),
      stops(RAIL_BACK),
      `<g data-part="gantry-back">${gantryBack()}</g>`,
      crossRails(),
      `<g data-part="magazine">${magazine()}</g>`,
      `<g data-part="templates">${templates.join("")}<g data-part="follower-slot"><g data-part="gantry-mid"><g clip-path="url(#${id}-rod)"><g data-part="follower">${follower()}</g></g></g></g></g>`,
      screw(),
      `<g data-part="handle">${handleAt(1 * TURNS_PER_K * 8)}</g>`,
      rail(RAIL_FRONT),
      stops(RAIL_FRONT),
      `<g data-part="gantry-front">${gantryFront()}${counterFace()}</g>`,
      `<g data-part="gantry-top">${gantryTop()}<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(quality(TASKS[initial], 8000))}" style="stroke-width:1.1"/></g>`,
    ],
  });

  const stage = stageHtml({
    svg,
    label: "Cam tracer. Left and right arrow keys move the gantry by 1,000 thinking tokens, Shift for 4,000. Keys 1, 2 and 3 choose the task.",
    role: "slider",
    attrs: `aria-valuemin="0" aria-valuemax="${MAX_TOKENS}" aria-valuenow="8000"`,
  });

  const controls = `<div class="fig-controls" role="group" aria-label="Task">${TASKS.map((task, index) => `<button class="btn" type="button" data-task="${index}" aria-pressed="${index === initial}">${task.label}</button>`).join("")}</div>
<div class="fig-row"><label class="label" for="${id}-budget">Budget</label><input class="range" id="${id}-budget" type="range" min="0" max="${MAX_TOKENS}" step="500" value="8000"><output for="${id}-budget" data-out="tokens">8,000</output></div>
<dl class="fig-meter"><div><dt>Quality</dt><dd data-out="quality">77%</dd></div><div><dt>Next 1k adds</dt><dd data-out="gain">+1.5 pts</dd></div><div><dt>Added wait</dt><dd data-out="wait">≈89 s</dd></div><div><dt>Cost per request</dt><dd data-out="cost">$0.20</dd></div></dl>`;

  const html = plate({
    id,
    fig,
    title: "Quality vs. thinking budget",
    hint: "Drag across, or use ← →",
    readout: "mid-size feature · 8,000 tokens · 77%",
    keys: [
      { mark: "lit", label: "Roller follower and gauge: the quality reading" },
      { mark: "raised", label: "Templates: one quality curve per task" },
      { mark: "flat", label: "Pins on the scale: low, medium, high, and max" },
    ],
    caption: `Each template's top edge is a quality curve. The gantry spends thinking tokens as it moves right, and the follower stops rising where the curve flattens. The curves are teaching examples. Cost uses the site's example output rate of $${OUTPUT_RATE} per million tokens, and wait assumes ${TOKENS_PER_SECOND} tokens a second.`,
    stage,
    controls,
  });

  const script = `
const TASKS = ${JSON.stringify(TASKS)};
const LEVELS = ${JSON.stringify(LEVELS)};
const P = ${JSON.stringify(P)};
const MAX_TOKENS = ${MAX_TOKENS}, PER_K = ${PER_K}, XMAX = ${XMAX}, Q_SCALE = ${Q_SCALE}, MAG_TOP = ${MAG_Z[1]};
const TPL_X = ${JSON.stringify(TPL_X)}, LINE_Y = ${LINE_Y}, SLOT = ${SLOT}, MAG_REST = ${MAG_REST}, REST_C = ${REST_C}, LIFT = ${LIFT}, ROLLER_R = ${ROLLER_R};
const DIAL = ${JSON.stringify(DIAL)}, WHEEL = ${JSON.stringify(WHEEL)}, SCREW = ${JSON.stringify(SCREW)}, TURNS_PER_K = ${TURNS_PER_K};
const TOKENS_PER_SECOND = ${TOKENS_PER_SECOND}, OUTPUT_RATE = ${OUTPUT_RATE};
const quality = ${quality.toString()};
const magOffset = (index) => LINE_Y - (index - 1) * SLOT;
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const gantry = ["gantry-back", "gantry-mid", "gantry-front", "gantry-top"].map(part);
const follower = part("follower");
const magazine = part("magazine");
const templates = [...svg.querySelectorAll('[data-part="tpl"]')];
const slot = part("follower-slot");
const holder = part("templates");
const needle = part("needle");
const handle = part("handle");
const digits = [...svg.querySelectorAll("[data-digit]")];
const buttons = [...root.querySelectorAll("[data-task]")];
const range = root.querySelector('input[type="range"]');
const out = (name) => root.querySelector('[data-out="' + name + '"]');
const say = readoutOf(root);
const plain = (n) => Math.round(n).toLocaleString("en-US");
const needleAt = ${needleAt.toString()};
const top = (task, x) => MAG_TOP + Q_SCALE * quality(task, (Math.max(0, Math.min(XMAX, x)) / PER_K) * 1000);
// The roller rests on the highest point of the edge within its radius.
const restOn = (task, x) => {
  let best = -Infinity;
  for (let i = -8; i <= 8; i++) {
    const dx = (i / 8) * ROLLER_R;
    best = Math.max(best, top(task, x + dx) + Math.sqrt(ROLLER_R * ROLLER_R - dx * dx));
  }
  return best;
};
const HIGHEST = Math.max(...TASKS.map((task) => top(task, XMAX))) + ROLLER_R + 3;
const state = { task: 1, shown: 1, x: 64, target: 64, mag: magOffset(1), magTarget: magOffset(1), roll: { at: restOn(TASKS[1], 64), rate: 0 }, phase: "rest" };
let touring = !STILL.matches, clock = -1.4, idleTimer = 0, order = "", TOUR_FROM = 1;
${handleAt.toString()}
let lastTurn = null;
function drawHandle(turn) {
  const rounded = Math.round(turn * 720) / 720;
  if (rounded === lastTurn) return;
  lastTurn = rounded;
  handle.innerHTML = handleAt(rounded);
}
function place() {
  const g = translateAlong(P, [state.x, 0, 0]);
  gantry.forEach((node) => node.setAttribute("transform", g));
  follower.setAttribute("transform", translateAlong(P, [0, 0, state.roll.at - REST_C]));
  const m = translateAlong(P, [0, state.mag - MAG_REST, 0]);
  magazine.setAttribute("transform", m);
  templates.forEach((node) => node.setAttribute("transform", m));
  // Painter's order: the follower sits between the templates behind its line and those in front.
  const ys = templates.map((node, index) => state.mag + (index - 1) * SLOT);
  const behind = ys.filter((y) => y <= LINE_Y + 0.01).length;
  const key = String(behind);
  if (key !== order) {
    order = key;
    const fragment = document.createDocumentFragment();
    templates.forEach((node, index) => { if (index < behind) fragment.appendChild(node); });
    fragment.appendChild(slot);
    templates.forEach((node, index) => { if (index >= behind) fragment.appendChild(node); });
    holder.appendChild(fragment);
  }
  drawHandle((state.x / PER_K) * TURNS_PER_K);
}
function reading() {
  const task = TASKS[state.shown];
  const tokens = (state.x / PER_K) * 1000;
  const q = (state.roll.at - ROLLER_R - MAG_TOP) / Q_SCALE;
  return { task, tokens, q };
}
function draw() {
  place();
  const { task, tokens, q } = reading();
  const settled = state.phase === "rest";
  const shownQ = settled ? quality(task, tokens) : q;
  needle.setAttribute("d", needleAt(Math.max(0, q)));
  const count = String(Math.round(tokens / 100) * 100).padStart(5, "0");
  digits.forEach((node, index) => { if (node.textContent !== count[index]) node.textContent = count[index]; });
  const gain = quality(task, tokens + 1000) - quality(task, tokens);
  const secs = tokens / TOKENS_PER_SECOND;
  out("tokens").textContent = plain(Math.round(tokens / 100) * 100);
  out("quality").textContent = settled ? shownQ.toFixed(0) + "%" : "…";
  out("gain").textContent = "+" + gain.toFixed(gain < 0.1 ? 2 : 1) + " pts";
  out("wait").textContent = secs < 90 ? "≈" + secs.toFixed(0) + " s" : "≈" + (secs / 60).toFixed(1) + " min";
  out("cost").textContent = "$" + ((tokens / 1e6) * OUTPUT_RATE).toFixed(2);
  say(settled ? task.label.toLowerCase() + " · " + plain(Math.round(tokens / 100) * 100) + " tokens · " + shownQ.toFixed(0) + "%" : "changing template · " + TASKS[state.task].label.toLowerCase());
}
function describe() {
  const task = TASKS[state.task];
  const tokens = (state.target / PER_K) * 1000;
  stage.setAttribute("aria-valuenow", String(Math.round(tokens)));
  stage.setAttribute("aria-valuetext", task.label + ": " + plain(tokens) + " thinking tokens, quality " + quality(task, tokens).toFixed(0) + " percent");
}
const loop = figureLoop(stage, (dt, calm) => {
  if (touring) {
    clock += dt;
  }
  if (touring && clock >= 0) {
    const beat = Math.floor(clock / 2.6);
    const level = LEVELS[beat % LEVELS.length];
    state.target = (level.tokens / 1000) * PER_K;
    const task = (TOUR_FROM + Math.floor(beat / LEVELS.length)) % TASKS.length;
    if (task !== state.task) choose(task, false);
    if (range.value !== String(level.tokens)) { range.value = String(level.tokens); describe(); }
  }
  state.x = follow(state.x, state.target, dt, 0.32, calm);
  let want = restOn(TASKS[state.shown], state.x);
  if (state.phase === "lift") {
    want = HIGHEST + 4;
    if (calm || state.roll.at > HIGHEST) { state.phase = "shuttle"; state.magTarget = magOffset(state.task); }
  }
  if (state.phase === "shuttle") {
    want = HIGHEST + 4;
    state.mag = follow(state.mag, state.magTarget, dt, 0.22, calm);
    if (state.mag === state.magTarget) { state.phase = "drop"; state.shown = state.task; templates.forEach((node, index) => node.toggleAttribute("data-on", index === state.task)); }
  }
  if (state.phase === "drop") want = restOn(TASKS[state.shown], state.x);
  const still = springTo(state.roll, want, dt, state.phase === "rest" ? 520 : 260, state.phase === "rest" ? 34 : 30, calm);
  if (state.phase === "drop" && still) state.phase = "rest";
  draw();
  return touring || state.x !== state.target || !still || state.phase !== "rest";
});
function choose(index, manual) {
  if (index === state.task) return;
  state.task = index;
  state.phase = "lift";
  buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  if (manual) describe();
  loop.kick();
}
function steer() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !STILL.matches; clock = -1.4; TOUR_FROM = state.task; loop.kick(); }, 6000);
  loop.kick();
}
function setTokens(tokens) {
  state.target = (Math.max(0, Math.min(MAX_TOKENS, tokens)) / 1000) * PER_K;
  range.value = String(Math.round(tokens / 500) * 500);
  describe();
  steer();
}
buttons.forEach((button) => button.addEventListener("click", () => { steer(); choose(Number(button.dataset.task), true); }));
range.addEventListener("input", () => setTokens(Number(range.value)));
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, ((event.clientX - box.left) / box.width - 0.2) / 0.62));
  setTokens(share * MAX_TOKENS);
});
stage.addEventListener("pointerdown", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, ((event.clientX - box.left) / box.width - 0.2) / 0.62));
  setTokens(share * MAX_TOKENS);
});
stage.addEventListener("keydown", (event) => {
  const tokens = (state.target / PER_K) * 1000;
  const step = event.shiftKey ? 4000 : 1000;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") setTokens(tokens + step);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") setTokens(tokens - step);
  else if (event.key === "Home") setTokens(0);
  else if (event.key === "End") setTokens(MAX_TOKENS);
  else if (["1", "2", "3"].includes(event.key)) { steer(); choose(Number(event.key) - 1, true); }
  else return;
  event.preventDefault();
});
if (STILL.matches) touring = false;
describe();
draw();
`;

  const css = `
[data-fig="${id}"] [data-part="tpl"]:not([data-on]) .iso-edge{stroke:var(--anatomy-mid)}
[data-fig="${id}"] [data-part="tpl"]:not([data-on]) .iso-top{fill:var(--anatomy-shade-3)}
[data-fig="${id}"] [data-part="tpl"]:not([data-on]) .ec-grid{opacity:0}
[data-fig="${id}"] .ec-grid{transition:opacity .4s}
`;
  return { html, css, script, needs: ["lathe"] };
}
