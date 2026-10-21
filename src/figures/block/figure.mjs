// Fig: one decoder block as a four-lane production line. Each lane is a conveyor that carries one
// token's state block (the residual stream). Station 1 reads every block with a gauge (RMSNorm),
// and patch cords carry each reading to the switchboard (attention): a lane's reader strip takes
// cords only from its own lane and earlier lanes, and a stop plate covers the jacks of later lanes.
// Cord thickness is the weight. The adder head under each strip lays the update on the block.
// Station 2 reads the blocks again, and one press with one shared die (the MLP) stamps a second
// update on every lane in the same stroke. The blocks never leave their lanes.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { TOKENS, WEIGHTS, MODES, CORDS, rowSum, strongestOf, readsText } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 470;
const AZIMUTH = 62;
const ELEVATION = 40;

// World: x across the lanes (reading order, left to right), y along the line (the flow runs
// toward −y, away from the viewer), z up. Units are about one pixel of the real machine.
const LANE_X = [0, 32, 64, 96];
const BELT = { half: 8, r: 1.6, y0: -78, y1: 110 };
const BELT_TOP = BELT.r * 2;
const BLOCK = { half: 7, depth: 6, h: 11.4 };
const PLATE_T = 2.4;
const TOP_X = BELT_TOP + BLOCK.h; // 14.6: the block alone
const TOP_A = TOP_X + PLATE_T; // 17.0: with the attention update
const TOP_M = TOP_A + PLATE_T; // 19.4: with the MLP update
const Y = { in: 100, A: 86, B: 52, C: -8, D: -44, out: -70 };
const STROKE = 6;

const BASE = { x: -36, y: -86, w: 168, d: 213, r: 8 };
const BASE_H = 9;
const FOOT_H = 5;
const FRAME_A = { y0: 48, y1: 90, top: 52 };
const FRAME_D = { y0: -58, y1: -4, top: 56 };
const CHEEK_X = [-28, 116];
const CHEEK_W = 8;
const BAR = { x: -20, w: 136 };
const PANEL = { z0: 30, z1: 50 };
const STRIP = { half: 9.5, z0: 38, z1: 46, jack: 42, pitch: 4.4, t: 2.4 };
const PLUG = { r: 1.3, l: 2.4 };
// A gauge row stands at height zb: bar zb..zb+4, box zb..zb+8, sleeve below, plunger tip at zb − 6.
// The second row stands one plate higher, because its blocks already carry the attention update.
const GAUGE = { half: 6, d: 4.5, h: 8, dialR: 3.2, plug: 1.1, plugH: 2.2, pitch: 3.0 };
const ROW = { A: 18, C: 18 + PLATE_T };
const CROWN = { z0: 56, z1: 64 };
const RAM = { z0: 38, z1: 46 };
const PUNCH_FACE = TOP_M + STROKE; // 27.4 at rest
const WHEEL = { x: 124, y: Y.D + 13, z: 40, r: 12, t: 4, pin: 8 };
const RODS_X = [16, 80];

const STRIP_FACE = Y.B + 2 + STRIP.t; // 56.4
const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [CHEEK_X[0], FRAME_D.y0, CROWN.z1], [CHEEK_X[1] + CHEEK_W, FRAME_D.y0, CROWN.z1], [WHEEL.x + 6, WHEEL.y, WHEEL.z + WHEEL.r], [CHEEK_X[0], FRAME_A.y0, 64]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: AZIMUTH, elevation: ELEVATION },
);
const KS = G.scaleOf(P); // screen units per world unit
const V = G.viewOf(P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 10) / 10;
const depth = (p) => G.dot3(p, V);
const box = (x0, y0, z0, x1, y1, z1) => ({ x0, y0, z0, x1, y1, z1 });

// Boxes the cords must clear, for the check in audit.mjs.
const OBSTACLES = [];
const solid = (name, b) => (OBSTACLES.push({ name, ...b }), b);

// ---------- static parts ----------

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  const feet = k.corners(BASE, 18).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Position scale along the front edge: a major tick under each lane.
  const ruler = { x: -8, y: 115, w: 112, d: 5.5, r: 1 };
  out.push(S(k.slabOf(ruler, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(-6, 102, 4, 8, ruler.y + 0.01, 0.6, [1.8, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([ruler.x + 1.4, ruler.y + 4.4, 0.6]), at([ruler.x + ruler.w - 1.4, ruler.y + 4.4, 0.6])], { size: 0.42 }));
  // Label plate: the one engraved label.
  const label = { x: 108, y: 97, w: 18, d: 14, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 3, label.y + 6.2], 0.8, P, "x"), "BLOCK 1", { size: 2.5, tone: "mid" }));
  out.push(L([[label.x + 3, label.y + 9, 11], [label.x + 3, label.y + 11, 7]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 1.6, label.y + 2, 0.8]), at([label.x + label.w - 1.6, label.y + label.d - 2, 0.8])], { size: 0.4 }));
  return out.join("");
}

function cheek(x, frame) {
  const plan = { x, y: frame.y0, w: CHEEK_W, d: frame.y1 - frame.y0, r: 1.5 };
  solid("cheek", box(x, frame.y0, 0, x + CHEEK_W, frame.y1, frame.top));
  return S(k.slabOf(plan, 0, frame.top, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 3), { tone: "faint" }) });
}

// Bolt heads on the outer face of the right cheek where the bars and the panel attach.
function cheekBolts(frame, rows) {
  const x = CHEEK_X[1] + CHEEK_W;
  return D(rows.map(([y, z]) => at([x, y, z])), { size: 0.45 });
}

// A closed height-adjust slot on the outer face of the right cheek: the gauge bar's bolt rides in it.
function cheekSlot(y, z0, z1, half = 1.3) {
  const x = CHEEK_X[1] + CHEEK_W;
  const ring = [];
  for (let index = 0; index <= 12; index++) {
    const a = Math.PI + (index / 12) * Math.PI;
    ring.push([x, y + half * Math.cos(a), z1 - half - half * Math.sin(a)]);
  }
  for (let index = 0; index <= 12; index++) {
    const a = (index / 12) * Math.PI;
    ring.push([x, y + half * Math.cos(a), z0 + half - half * Math.sin(a)]);
  }
  return L(k.pathOf(ring.map(at), true), { tone: "lo" });
}

// A conveyor belt: a stadium round its two rollers, extruded across the lane.
function belt(lane) {
  const F = G.frameOf([LANE_X[lane] - BELT.half, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const ring = G.stadium(BELT.r, BELT.r, BELT.y1 - BELT.y0, 20).map(([u, v]) => [u + BELT.y0, v + BELT.r]);
  return G.prismOf(F, ring, 0, BELT.half * 2, P);
}
const beltAxles = () => D(LANE_X.flatMap((x) => [at([x + BELT.half, BELT.y0, BELT.r]), at([x + BELT.half, BELT.y1, BELT.r])]), { size: 0.55, tone: "hi" });

// Cleats across a belt top, shifted by the distance the belt has run. Shared with the page.
function cleatsOf(lane, shift) {
  const x0 = LANE_X[lane] - BELT.half;
  const x1 = LANE_X[lane] + BELT.half;
  const out = [];
  const pitch = 8;
  const phase = ((shift % pitch) + pitch) % pitch;
  for (let y = BELT.y1 - phase; y > BELT.y0; y -= pitch) {
    const edge = Math.min(y - BELT.y0, BELT.y1 - y);
    const alpha = Math.max(0, Math.min(1, (edge - 1) / 7));
    if (alpha > 0.02) out.push({ d: k.lineOnTop([x0, y], [x1, y], BELT_TOP, P), alpha: alpha * alpha * (3 - 2 * alpha) });
  }
  return k.fadedSvg(out, { tone: "lo" });
}

// ---------- gauges (RMSNorm) ----------

const DIAL_FACE = (y) => y + GAUGE.d / 2;
function gaugeBar(y, zb) {
  const plan = { x: BAR.x, y: y - GAUGE.d / 2 - 4, w: BAR.w, d: 4, r: 0.6 };
  const [z0, z1] = [zb, zb + 4];
  solid("gauge-bar", box(plan.x, plan.y, z0, plan.x + plan.w, plan.y + plan.d, z1));
  return S(k.slabOf(plan, z0, z1 - z0, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, (z0 + z1) / 2, P, 3), { tone: "faint" }) }) + D(LANE_X.map((x) => at([x + 11, y - GAUGE.d / 2 - 2, z1])), { size: 0.4 });
}

function gaugeBody(lane, y, zb) {
  const x = LANE_X[lane];
  const plan = { x: x - GAUGE.half, y: y - GAUGE.d / 2, w: GAUGE.half * 2, d: GAUGE.d, r: 0.8 };
  solid(`gauge-${lane}`, box(plan.x, plan.y, zb, plan.x + plan.w, plan.y + plan.d, zb + GAUGE.h));
  const out = [];
  out.push(S(k.cylinder(x, y, 1.5, zb - 1.6, 1.6, P, 18), { tone: "mid" }));
  out.push(S(k.slabOf(plan, zb, GAUGE.h, P, 3, 0.4), { tone: "mid" }));
  const face = DIAL_FACE(y);
  const c = [x, face, zb + GAUGE.h / 2];
  out.push(L(k.sideRing(c, GAUGE.dialR, "y", P, 40), { tone: "lo" }));
  const minor = [];
  const major = [];
  for (let index = 0; index < 20; index++) {
    const angle = (index / 20) * Math.PI * 2;
    const big = index % 5 === 0;
    const r0 = GAUGE.dialR - (big ? 1.1 : 0.6);
    const p = (r) => [x + r * Math.sin(angle), face, zb + GAUGE.h / 2 + r * Math.cos(angle)];
    (big ? major : minor).push(k.segment(p(r0), p(GAUGE.dialR), P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(D([at(c)], { size: 0.55, tone: "hi" }));
  return out.join("");
}

// The needle turns with the plunger. The page runs this same function.
function needleOf(x, face, zc, lift) {
  const angle = ((-40 + lift * 34) * Math.PI) / 180;
  const p = (r) => [x + r * Math.sin(angle), face, zc + r * Math.cos(angle)];
  return k.segment(p(-0.8), p(2.6), P);
}

// The plunger rod, built at rest and moved up by the lift. The box hides its top.
const plungerSvg = (x, y, zb) => S(k.cylinder(x, y, 0.75, zb - 6, 10, P, 14), { tone: "mid", crease: "none" });

// How far a gauge's plunger is lifted by a block whose centre is at yb. Shared with the page.
function liftOf(gy, yb, top, rest) {
  const s = (a, b, v) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const back = yb - 6;
  const front = yb + 6;
  return (top - rest) * s(gy + 3.2, gy + 1.2, back) * s(gy - 1.25, gy + 0.75, front);
}

// ---------- switchboard (attention) ----------

const jackX = (reader, source) => LANE_X[reader] + (source - 1.5) * STRIP.pitch;
// Plug order on each gauge top, left to right: the longest cord starts outermost so the cords
// from one gauge nest instead of crossing, and the cord to its own lane sits on the side its jack is.
const PLUG_ORDER = [[0, 3, 2, 1], [1, 3, 2], [3, 2], [3]];
const plugX = (reader, source) => {
  const order = PLUG_ORDER[source];
  return LANE_X[source] + (order.indexOf(reader) - (order.length - 1) / 2) * GAUGE.pitch;
};

function panel() {
  const plan = { x: BAR.x, y: Y.B - 2, w: BAR.w, d: 4, r: 0.6 };
  solid("panel", box(plan.x, plan.y, PANEL.z0, plan.x + plan.w, plan.y + plan.d, PANEL.z1));
  const out = [S(k.slabOf(plan, PANEL.z0, PANEL.z1 - PANEL.z0, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, PANEL.z1 - 3, P, 3), { tone: "faint" }) })];
  out.push(D([BAR.x + 3, BAR.x + BAR.w - 3].flatMap((x) => [at([x, Y.B + 2, PANEL.z0 + 3]), at([x, Y.B + 2, PANEL.z1 - 6])]), { size: 0.45 }));
  return out.join("");
}

function adderHead(lane) {
  const x = LANE_X[lane];
  const plan = { x: x - 6, y: Y.B - 4.5, w: 12, d: 9, r: 1 };
  solid(`adder-${lane}`, box(plan.x, plan.y, TOP_A, plan.x + plan.w, plan.y + plan.d, PANEL.z0));
  return S(k.slabOf(plan, TOP_A, PANEL.z0 - TOP_A, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, TOP_A + 3, P, 3), { tone: "faint" }) }) + D([at([x - 3.4, plan.y + plan.d, PANEL.z0 - 2.5]), at([x + 3.4, plan.y + plan.d, PANEL.z0 - 2.5])], { size: 0.42 });
}

function readerStrip(lane) {
  const x = LANE_X[lane];
  const plan = { x: x - STRIP.half, y: Y.B + 2, w: STRIP.half * 2, d: STRIP.t, r: 0.6 };
  solid(`strip-${lane}`, box(plan.x, plan.y, STRIP.z0, plan.x + plan.w, plan.y + plan.d, STRIP.z1));
  const out = [S(k.slabOf(plan, STRIP.z0, STRIP.z1 - STRIP.z0, P, 3, 0.4), { tone: "mid" })];
  // Jack rings: open jacks take a plug, later lanes sit under the stop plate.
  out.push(L([0, 1, 2, 3].filter((source) => source <= lane).map((source) => k.sideRing([jackX(lane, source), STRIP_FACE, STRIP.jack], PLUG.r + 0.5, "y", P, 24)).join(""), { tone: "lo" }));
  if (lane < 3) {
    const x0 = x + (lane - 1) * STRIP.pitch;
    const stop = { x: x0, y: STRIP_FACE, w: x + STRIP.half - 0.6 - x0, d: 1, r: 0.4 };
    solid(`stop-${lane}`, box(stop.x, stop.y, STRIP.z0 + 0.6, stop.x + stop.w, stop.y + stop.d, STRIP.z1 - 0.6));
    out.push(`<g data-part="stop">${S(k.slabOf(stop, STRIP.z0 + 0.6, STRIP.z1 - STRIP.z0 - 1.2, P, 2, 0.3), { tone: "hi", crease: "lo" })}</g>`);
    out.push(D([at([stop.x + 1.3, stop.y + stop.d, STRIP.jack]), at([stop.x + stop.w - 1.3, stop.y + stop.d, STRIP.jack])], { size: 0.42, tone: "hi" }));
  }
  return out.join("");
}

// A patch cord as a cubic curve in world space: up out of the gauge plug, then into the
// reader strip's plug from the front.
function cordCurve({ reader, source }) {
  const S0 = [plugX(reader, source), Y.A, ROW.A + GAUGE.h + GAUGE.plugH];
  const E0 = [jackX(reader, source), STRIP_FACE + PLUG.l, STRIP.jack];
  // A longer cord rises higher and bows further forward, so it passes over the shorter ones.
  const span = reader - source;
  const C1 = [S0[0], S0[1], S0[2] + 12 + 8 * span];
  const C2 = [E0[0], E0[1] + 8 + 2 * span, E0[2] + 3 + 5.5 * span];
  return Array.from({ length: 49 }, (_, index) => {
    const t = index / 48;
    const u = 1 - t;
    return [0, 1, 2].map((axis) => u * u * u * S0[axis] + 3 * u * u * t * C1[axis] + 3 * u * t * t * C2[axis] + t * t * t * E0[axis]);
  });
}
const cordRadius = (w) => 0.42 + 0.78 * w;

// Screen crossings between two cords, with the depth of each at the crossing.
function crossings(a, b) {
  const out = [];
  const sa = a.points.map(at);
  const sb = b.points.map(at);
  for (let i = 0; i < sa.length - 1; i++) {
    for (let j = 0; j < sb.length - 1; j++) {
      const [p, p2] = [sa[i], sa[i + 1]];
      const [q, q2] = [sb[j], sb[j + 1]];
      const r = [p2[0] - p[0], p2[1] - p[1]];
      const s = [q2[0] - q[0], q2[1] - q[1]];
      const den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < 1e-9) continue;
      const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den;
      const u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const da = depth(G.lerp3(a.points[i], a.points[i + 1], t));
      const db = depth(G.lerp3(b.points[j], b.points[j + 1], u));
      out.push({ at: [p[0] + r[0] * t, p[1] + r[1] * t], da, db, ta: (i + t) / (sa.length - 1), tb: (j + u) / (sb.length - 1) });
    }
  }
  return out;
}

// Cords in back-to-front order: at every crossing the nearer cord is drawn later.
function cordOrder(list) {
  const after = list.map(() => new Set());
  const pairs = [];
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      for (const cross of crossings(list[a], list[b])) {
        pairs.push({ a, b, ...cross });
        if (cross.da > cross.db) after[a].add(b);
        else after[b].add(a);
      }
    }
  }
  const order = [];
  const state = list.map(() => 0);
  const visit = (index) => {
    if (state[index] === 2) return;
    if (state[index] === 1) throw new Error(`cord order has a cycle at ${index}`);
    state[index] = 1;
    after[index].forEach(visit);
    state[index] = 2;
    order.push(index);
  };
  list.forEach((_, index) => visit(index));
  return { order, pairs };
}

const CORD_LIST = CORDS.map((cord) => ({ ...cord, points: cordCurve(cord), r: cordRadius(cord.w) }));
const ORDER = cordOrder(CORD_LIST);

function cordSvg(cord, index) {
  const screen = cord.points.map(at);
  const d = k.pathOf(screen);
  const width = 2 * cord.r * KS;
  const S0 = cord.points[0];
  const gaugePlug = S(k.cylinder(S0[0], S0[1], GAUGE.plug, ROW.A + GAUGE.h, GAUGE.plugH, P, 16), { tone: "mid" });
  const F = G.frameAlong([jackX(cord.reader, cord.source), STRIP_FACE, STRIP.jack], [0, 1, 0]);
  const stripPlug = S(G.disc(0, PLUG.l, PLUG.r, F, P), { tone: "mid" });
  return `<g data-cord="${index}" data-reader="${cord.reader}" data-source="${cord.source}"><path class="bk-cord-o" d="${d}" style="stroke-width:${fix(width + 1.1)}"/><path class="bk-cord-b" d="${d}" style="stroke-width:${fix(Math.max(0.5, width - 0.5))}"/><g class="bk-beads"></g>${stripPlug}${gaugePlug}</g>`;
}

// ---------- press (MLP) ----------

function pressMoving() {
  const out = [];
  const ram = { x: BAR.x, y: Y.D - 6, w: BAR.w, d: 12, r: 1 };
  out.push(`<g data-part="die">${S(k.slabOf(ram, RAM.z0, RAM.z1 - RAM.z0, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(ram, RAM.z0 + 2.2, P, 4), { tone: "faint" }) })}</g>`);
  out.push(D([BAR.x + 4, BAR.x + BAR.w - 4].map((x) => at([x, Y.D, RAM.z1])), { size: 0.45 }));
  // Guide rods stand on the ram and run up into the crown, which hides their tops.
  for (const x of RODS_X) out.push(S(k.cylinder(x, Y.D, 1.6, RAM.z1, CROWN.z1 - 1 - RAM.z1, P, 18), { tone: "mid", crease: "none" }));
  for (const x of LANE_X) {
    const plan = { x: x - 6, y: Y.D - 5, w: 12, d: 10, r: 1 };
    out.push(S(k.slabOf(plan, PUNCH_FACE, RAM.z0 - PUNCH_FACE, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, PUNCH_FACE + 2, P, 3), { tone: "faint" }) }));
  }
  return out.join("");
}

function crown() {
  const plan = { x: CHEEK_X[0], y: FRAME_D.y0, w: CHEEK_X[1] + CHEEK_W - CHEEK_X[0], d: 24, r: 2 };
  solid("crown", box(plan.x, plan.y, CROWN.z0, plan.x + plan.w, plan.y + plan.d, CROWN.z1));
  const out = [S(k.slabOf(plan, CROWN.z0, CROWN.z1 - CROWN.z0, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, CROWN.z0 + 3, P, 4), { tone: "faint" }) })];
  out.push(L(k.planOutline(k.insetPlan(plan, 3.5), CROWN.z1, P, 4), { tone: "faint" }));
  out.push(D(k.corners(plan, 6).map(([x, y]) => at([x, y, CROWN.z1])), { size: 0.5 }));
  return out.join("");
}

const WHEEL_F = G.frameOf([WHEEL.x, WHEEL.y, WHEEL.z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
function wheel() {
  const out = [S(G.disc(0, WHEEL.t, WHEEL.r, WHEEL_F, P), { tone: "mid", inner: L(G.circleOf(WHEEL_F, WHEEL.t, WHEEL.r - 2, P), { tone: "faint" }) })];
  out.push(S(G.disc(WHEEL.t, WHEEL.t + 1.6, 3.2, WHEEL_F, P), { tone: "mid" }));
  return out.join("");
}

// The crank pin on the flywheel face and the line from the hub to it. The page runs this too.
function crankOf(phase) {
  const angle = phase * Math.PI * 2;
  const pin = [WHEEL.x + WHEEL.t, WHEEL.y + WHEEL.pin * Math.sin(angle), WHEEL.z + WHEEL.pin * Math.cos(angle)];
  const hub = [WHEEL.x + WHEEL.t, WHEEL.y + 3.2 * Math.sin(angle), WHEEL.z + 3.2 * Math.cos(angle)];
  const F = G.frameOf(pin, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return k.lineSvg(k.segment(hub, [pin[0], pin[1] - 1.3 * Math.sin(angle), pin[2] - 1.3 * Math.cos(angle)], P), { tone: "hi" }) + k.solidSvg(G.disc(0, 2.4, 1.3, F, P, { steps: 24 }), { tone: "hi" });
}
const strokeOf = (phase) => (STROKE * (1 - Math.cos(phase * Math.PI * 2))) / 2;

// ---------- blocks ----------

// The block for one lane, built with its centre at y = 0. Plates are rebuilt as they grow.
function blockSvg(lane) {
  const x = LANE_X[lane];
  const plan = { x: x - BLOCK.half, y: -BLOCK.depth, w: BLOCK.half * 2, d: BLOCK.depth * 2, r: 1 };
  const seams = L(k.sideSeam(plan, BELT_TOP + 3.8, P, 3) + k.sideSeam(plan, BELT_TOP + 7.6, P, 3), { tone: "lo" });
  return S(k.slabOf(plan, BELT_TOP, BLOCK.h, P, 3, 0.5), { tone: "hi", crease: "lo", inner: seams });
}
function plateSvg(lane, z, t, lit) {
  if (t < 0.02) return "";
  const x = LANE_X[lane];
  const plan = { x: x - BLOCK.half, y: -BLOCK.depth, w: BLOCK.half * 2, d: BLOCK.depth * 2, r: 1 };
  return k.solidSvg(k.slabOf(plan, z, t, P, 3, t > 1 ? 0.4 : 0), { tone: "hi", crease: "lo", lit });
}

// The line's cycle in Full block and Residual: blocks enter, stop at each station, leave.
const CYCLE = [
  { kind: "in", dur: 0.6, y: Y.in },
  { kind: "move", dur: 1.0, from: Y.in, to: Y.A },
  { kind: "dwell", dur: 0.8, y: Y.A, stage: "norm1" },
  { kind: "move", dur: 1.2, from: Y.A, to: Y.B },
  { kind: "dwell", dur: 1.6, y: Y.B, stage: "attention" },
  { kind: "move", dur: 1.9, from: Y.B, to: Y.C },
  { kind: "dwell", dur: 0.8, y: Y.C, stage: "norm2" },
  { kind: "move", dur: 1.2, from: Y.C, to: Y.D },
  { kind: "dwell", dur: 1.8, y: Y.D, stage: "mlp" },
  { kind: "move", dur: 1.2, from: Y.D, to: Y.out },
  { kind: "out", dur: 0.6, y: Y.out },
  { kind: "rest", dur: 0.4, y: Y.out },
];
const PERIOD = CYCLE.reduce((sum, step) => sum + step.dur, 0);

// Where the line is at time t of its cycle. Shared with the page.
function lineAt(t) {
  const smooth = (a, b, v) => {
    const u = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  let clock = ((t % PERIOD) + PERIOD) % PERIOD;
  let travelled = Math.floor(t / PERIOD) * Math.abs(Y.in - Y.out);
  const state = { y: Y.in, alpha: 1, tA: 0, tM: 0, crank: 0, stage: "enter", run: 0 };
  for (let index = 0; index < CYCLE.length; index++) {
    const step = CYCLE[index];
    const u = Math.min(1, clock / step.dur);
    const done = clock >= step.dur;
    if (step.kind === "in") state.alpha = smooth(0, 1, u);
    if (step.kind === "move") {
      const e = (1 - Math.cos(Math.PI * u)) / 2;
      state.y = step.from + (step.to - step.from) * e;
      travelled += Math.abs(step.to - step.from) * e;
    }
    if (step.kind === "dwell") {
      state.y = step.y;
      if (step.stage === "attention") state.tA = PLATE_T * smooth(0.15, 0.65, u);
      if (step.stage === "mlp") {
        state.crank = u;
        state.tM = PLATE_T * smooth(0.36, 0.62, u);
      }
      state.stage = step.stage;
    }
    if (step.kind === "move" && index > 1) state.stage = CYCLE[index - 1].stage;
    if (step.kind === "move" && step.to === Y.out && u > 0.25) state.stage = "leave";
    if (step.kind === "out") {
      state.alpha = 1 - smooth(0, 1, u);
      state.stage = "leave";
    }
    if (!done) break;
    clock -= step.dur;
  }
  state.run = travelled;
  return state;
}

// Which slot a block is drawn in, by where its centre is along the line.
function slotOf(y) {
  if (y < Y.D + 16) return "P";
  if (y < Y.C + 7) return "C";
  if (y < Y.B + 10.5) return "D";
  if (y < Y.A + 7) return "A";
  return "F";
}

// The still frame for a mode, also the first frame of the page.
const STILL_T = { full: 7.5, residual: 12.0, attention: 5.1, mlp: 10.5 };

export function build({ fig = "Fig 1", id = "block" } = {}) {
  OBSTACLES.length = 0;
  const initial = { mode: "full", lane: 2 };
  const line = lineAt(STILL_T[initial.mode]);
  const cordGroups = ORDER.order.map((index) => cordSvg(CORD_LIST[index], index)).join("");
  const blocks = (state) =>
    LANE_X.map((_, lane) => {
      const move = k.translateAlong(P, [0, state.y, 0]);
      return `<g data-block="${lane}" transform="${move}"${state.alpha < 1 ? ` opacity="${state.alpha.toFixed(2)}"` : ""}>${blockSvg(lane)}<g data-plate="a">${plateSvg(lane, TOP_X, state.tA)}</g><g data-plate="m">${plateSvg(lane, TOP_A, state.tM)}</g></g>`;
    });
  const startBlocks = blocks(line);
  const slot = (name) => `<g data-slot="${name}">${slotOf(line.y) === name ? startBlocks.join("") : ""}</g>`;
  const gaugeRow = (y, zb, top, name) =>
    `<g data-part="${name}">${gaugeBar(y, zb)}${LANE_X.map((x, lane) => `<g data-plunger="${lane}" transform="${k.translateAlong(P, [0, 0, liftOf(y, line.y, top, zb - 6)])}">${plungerSvg(x, y, zb)}</g>${gaugeBody(lane, y, zb)}<path class="iso-line" data-tone="hi" data-free="start" data-needle="${lane}" d="${needleOf(x, DIAL_FACE(y), zb + GAUGE.h / 2, liftOf(y, line.y, top, zb - 6))}" style="stroke-width:.9"/>`).join("")}</g>`;
  const pressDrop = strokeOf(line.crank);

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A production line with four conveyor lanes, one per token: the, river, bank and flooded. Each lane carries its token's state block. At the first station, a gauge reads each block. Patch cords carry the readings to a switchboard. Each lane's reader strip takes cords only from its own lane and earlier lanes. A stop plate covers the jacks of later lanes. An adder head lays an update plate on each block. At the second station, gauges read the blocks again. One press with one shared die stamps a second update plate on every lane.",
    body: [
      base(),
      cheek(CHEEK_X[0], FRAME_D),
      cheek(CHEEK_X[0], FRAME_A),
      LANE_X.map((_, lane) => `<g data-belt="${lane}">${S(belt(lane), { tone: "mid" })}</g><g data-cleats="${lane}">${cleatsOf(lane, line.run)}</g>`).join(""),
      beltAxles(),
      slot("P"),
      `<g data-part="press" transform="${k.translateAlong(P, [0, 0, -pressDrop])}">${pressMoving()}</g>`,
      crown(),
      slot("C"),
      gaugeRow(Y.C, ROW.C, TOP_A, "norm2"),
      cheek(CHEEK_X[1], FRAME_D),
      cheekSlot(Y.C - 4.25, ROW.C - 3, ROW.C + 7),
      cheekBolts(FRAME_D, [[Y.C - 4.25, ROW.C + 2]]),
      wheel(),
      `<g data-part="crank">${crankOf(line.crank)}</g>`,
      slot("D"),
      panel(),
      LANE_X.map((_, lane) => adderHead(lane)).join(""),
      LANE_X.map((_, lane) => readerStrip(lane)).join(""),
      slot("A"),
      gaugeRow(Y.A, ROW.A, TOP_X, "norm1"),
      `<g data-part="cords">${cordGroups}</g>`,
      slot("F"),
      cheek(CHEEK_X[1], FRAME_A),
      cheekSlot(Y.A - 4.25, ROW.A - 3, ROW.A + 7),
      cheekBolts(FRAME_A, [[Y.A - 4.25, ROW.A + 2], [Y.B, PANEL.z0 + 4], [Y.B, PANEL.z1 - 4]]),
    ],
  });

  const stage = stageHtml({
    svg,
    label: "One decoder block as a production line. Left and right arrow keys choose a token lane. Keys 1 to 4 choose Full block, Attention, MLP or Residual.",
    role: "slider",
    attrs: `aria-valuemin="0" aria-valuemax="${TOKENS.length - 1}" aria-valuenow="${initial.lane}"`,
  });

  const meter = TOKENS.map((token, source) => `<div><dt>${token}</dt><dd data-w="${source}"></dd></div>`).join("") + `<div><dt>Sum</dt><dd data-w="sum"></dd></div>`;
  const controls = `<div class="fig-controls" role="group" aria-label="Part of the block">${MODES.map((mode) => `<button class="btn" type="button" data-mode="${mode.key}" aria-pressed="${mode.key === initial.mode}">${mode.label}</button>`).join("")}</div>
<div class="fig-controls" role="group" aria-label="Token lane"><span class="label">Lane</span>${TOKENS.map((token, lane) => `<button class="btn" type="button" data-lane="${lane}" aria-pressed="${lane === initial.lane}">${token}</button>`).join("")}</div>
<dl class="fig-meter" aria-live="off"><div class="bk-meter-head"><dt>Attention weights</dt><dd data-w="who"></dd></div>${meter}</dl>`;

  const html = plate({
    id,
    fig,
    title: "One decoder block",
    hint: "Pick a part of the block",
    readout: "full block · bank · attention adds an update",
    keys: [
      { mark: "lit", label: "Lit: the part that works in this mode" },
      { mark: "raised", label: "Blocks: one token's state on its own lane" },
      { mark: "flat", label: "Thin plates: the updates that attention and the MLP add" },
      { mark: "edge", label: "Stop plates: they cover the jacks of later lanes" },
    ],
    caption:
      "Each lane carries one token's state past attention and the MLP. Each part adds one update plate to the state. A lane's cords reach only its own lane and earlier lanes. Cord thickness shows the weight. The weights for each lane sum to 1. One die drives all four presses, so the MLP applies the same weights to each lane on its own. A model stacks dozens of these blocks. The weights are illustrative. Real implementations store these values in tensors and fuse many steps on accelerators.",
    stage,
    controls,
  });

  const script = `
const P = ${JSON.stringify(P)};
const TOKENS = ${JSON.stringify(TOKENS)};
const WEIGHTS = ${JSON.stringify(WEIGHTS)};
const MODES = ${JSON.stringify(MODES.map((mode) => mode.key))};
const LANE_X = ${JSON.stringify(LANE_X)}, BELT = ${JSON.stringify(BELT)}, BELT_TOP = ${BELT_TOP}, BLOCK = ${JSON.stringify(BLOCK)};
const Y = ${JSON.stringify(Y)}, PLATE_T = ${PLATE_T}, TOP_X = ${TOP_X}, TOP_A = ${TOP_A}, STROKE = ${STROKE};
const WHEEL = ${JSON.stringify(WHEEL)}, GAUGE = ${JSON.stringify(GAUGE)}, ROW = ${JSON.stringify(ROW)};
const CYCLE = ${JSON.stringify(CYCLE)}, PERIOD = ${PERIOD};
const STILL_T = ${JSON.stringify(STILL_T)};
const CORD_SCREEN = ${JSON.stringify(CORD_LIST.map((cord) => cord.points.map((p) => at(p).map(fix))))};
const CORD_R = ${JSON.stringify(CORD_LIST.map((cord) => fix(cord.r * KS * 10) / 10))};
const rowSum = ${rowSum.toString()};
const strongestOf = ${strongestOf.toString()};
const readsText = ${readsText.toString()};
${cleatsOf.toString()}
${needleOf.toString()}
${liftOf.toString()}
${crankOf.toString()}
${plateSvg.toString()}
${lineAt.toString()}
${slotOf.toString()}
const strokeOf = ${strokeOf.toString()};
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const say = readoutOf(root);
const q = (selector) => svg.querySelector(selector);
const blocks = [...svg.querySelectorAll("[data-block]")];
const slots = Object.fromEntries([...svg.querySelectorAll("[data-slot]")].map((node) => [node.dataset.slot, node]));
const cleats = [...svg.querySelectorAll("[data-cleats]")];
const belts = [...svg.querySelectorAll("[data-belt] .iso-solid")];
const cords = [...svg.querySelectorAll("[data-cord]")];
const press = q('[data-part="press"]');
const die = q('[data-part="die"] .iso-solid');
const crank = q('[data-part="crank"]');
const gauges = ["norm1", "norm2"].map((name) => {
  const row = q('[data-part="' + name + '"]');
  return { y: name === "norm1" ? Y.A : Y.C, zb: name === "norm1" ? ROW.A : ROW.C, top: name === "norm1" ? TOP_X : TOP_A, plungers: [...row.querySelectorAll("[data-plunger]")], needles: [...row.querySelectorAll("[data-needle]")] };
});
const modeButtons = [...root.querySelectorAll("[data-mode]")];
const laneButtons = [...root.querySelectorAll("[data-lane]")];
const meter = Object.fromEntries([...root.querySelectorAll("[data-w]")].map((node) => [node.dataset.w, node]));
const state = { mode: "full", lane: 2, clock: STILL_T.full, phase: 0, beads: 0 };
let touring = !STILL.matches, idle = 0, tourClock = 0, tourStep = 0, idleTimer = 0;
const STAGES = { enter: "the state enters", norm1: "RMSNorm scales the state", attention: "attention adds an update", norm2: "RMSNorm scales the state", mlp: "the MLP adds an update", leave: "the state leaves with 2 updates" };

// Beads run along the lit cords, from the source gauge to the reader strip.
const beadLayers = cords.map((node) => node.querySelector(".bk-beads"));
const lengths = CORD_SCREEN.map((points) => { const out = [0]; for (let i = 1; i < points.length; i++) out.push(out[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])); return out; });
function pointAt(index, share) {
  const points = CORD_SCREEN[index], acc = lengths[index], target = share * acc[acc.length - 1];
  let i = 1;
  while (i < acc.length - 1 && acc[i] < target) i++;
  const t = (target - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1);
  return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
}
function drawBeads(which, phase) {
  cords.forEach((node, index) => {
    const layer = beadLayers[index];
    if (!which || (which === "lane" && Number(node.dataset.reader) !== state.lane)) { if (layer.firstChild) layer.textContent = ""; return; }
    let html = "";
    for (let b = 0; b < 2; b++) {
      const share = (phase + b / 2) % 1;
      const fade = Math.min(1, share / 0.12, (1 - share) / 0.12);
      const [x, y] = pointAt(index, share);
      html += '<circle class="bk-bead" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + Math.max(0.9, CORD_R[index] * 0.85).toFixed(2) + '" opacity="' + Math.max(0, fade).toFixed(2) + '"/>';
    }
    layer.innerHTML = html;
  });
}

let lastSlot = null, lastRun = null;
function place(line) {
  const move = translateAlong(P, [0, line.y, 0]);
  const slot = slotOf(line.y);
  blocks.forEach((node, lane) => {
    node.setAttribute("transform", move);
    if (line.alpha < 0.999) node.setAttribute("opacity", line.alpha.toFixed(3)); else node.removeAttribute("opacity");
    const a = node.querySelector('[data-plate="a"]'), m = node.querySelector('[data-plate="m"]');
    const lit = state.mode === "full" && lane === state.lane;
    const ka = line.tA.toFixed(2) + lit, km = line.tM.toFixed(2) + lit;
    if (a.dataset.t !== ka) { a.dataset.t = ka; a.innerHTML = plateSvg(lane, TOP_X, line.tA, lit); }
    if (m.dataset.t !== km) { m.dataset.t = km; m.innerHTML = plateSvg(lane, TOP_A, line.tM, lit); }
  });
  if (slot !== lastSlot) { const fragment = document.createDocumentFragment(); blocks.forEach((node) => fragment.appendChild(node)); slots[slot].appendChild(fragment); lastSlot = slot; }
  const run = Math.round(line.run * 10) / 10;
  if (run !== lastRun) { lastRun = run; cleats.forEach((node, lane) => { node.innerHTML = cleatsOf(lane, line.run); }); }
  for (const gauge of gauges) {
    const lift = liftOf(gauge.y, line.y, gauge.top, gauge.zb - 6);
    gauge.plungers.forEach((node) => node.setAttribute("transform", translateAlong(P, [0, 0, lift])));
    gauge.needles.forEach((node, lane) => node.setAttribute("d", needleOf(LANE_X[lane], gauge.y + GAUGE.d / 2, gauge.zb + GAUGE.h / 2, lift)));
  }
}
// The press follows its target turn with a short lag, so a mode change never jumps the ram.
const crankState = { phase: 0 };
let lastCrank = null;
function pressAt(target, dt, calm) {
  let gap = target - crankState.phase;
  gap -= Math.round(gap);
  crankState.phase = calm ? target : crankState.phase + gap * (1 - Math.exp(-dt / 0.12));
  const phase = ((crankState.phase % 1) + 1) % 1;
  press.setAttribute("transform", translateAlong(P, [0, 0, -strokeOf(phase)]));
  const key = Math.round(phase * 720);
  if (key !== lastCrank) { lastCrank = key; crank.innerHTML = crankOf(phase); }
}
function lightUp() {
  blocks.forEach((node, lane) => node.querySelectorAll(".iso-solid").forEach((solid) => solid.toggleAttribute("data-lit", state.mode === "full" && lane === state.lane)));
  belts.forEach((solid, lane) => solid.toggleAttribute("data-lit", state.mode === "residual" && lane === state.lane));
  die.toggleAttribute("data-lit", state.mode === "mlp");
  cords.forEach((node) => {
    const on = state.mode === "attention" && Number(node.dataset.reader) === state.lane;
    node.toggleAttribute("data-on", on);
    node.querySelectorAll(".iso-solid").forEach((solid) => solid.toggleAttribute("data-lit", on));
  });
  root.dataset.mode = state.mode;
}
function weightsTable() {
  meter.who.textContent = TOKENS[state.lane] + " reads";
  TOKENS.forEach((_, source) => { meter[source].textContent = source <= state.lane ? WEIGHTS[state.lane][source].toFixed(2) : "blocked"; meter[source].toggleAttribute("data-blocked", source > state.lane); });
  meter.sum.textContent = rowSum(state.lane).toFixed(2);
}
function readout(line) {
  const who = TOKENS[state.lane];
  if (state.mode === "attention") return say("attention · " + readsText(state.lane));
  if (state.mode === "mlp") return say("MLP · same weights on all 4 lanes");
  const updates = (line.tA > PLATE_T * 0.5 ? 1 : 0) + (line.tM > PLATE_T * 0.5 ? 1 : 0);
  if (state.mode === "residual") return say("residual · " + who + " · " + (updates ? "state + " + updates + (updates > 1 ? " updates" : " update") : "state, no update yet"));
  say("full block · " + who + " · " + STAGES[line.stage]);
}
function describe() {
  const who = TOKENS[state.lane];
  const parts = WEIGHTS[state.lane].map((w, source) => TOKENS[source] + " " + w.toFixed(2));
  const row = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
  const later = TOKENS.slice(state.lane + 1);
  const text = {
    full: "Full block. The " + who + " lane carries its state through RMSNorm, attention, RMSNorm and the MLP. Each part adds an update.",
    attention: "Attention. The " + who + " lane reads " + row + ". The weights sum to 1." + (later.length ? " The stop plate blocks " + later.join(" and ") + "." : ""),
    mlp: "MLP. One shared die drives the press on every lane. Each lane gets the same weights on its own.",
    residual: "Residual. The " + who + " lane carries its state past both parts. Each part adds one update.",
  }[state.mode];
  stage.setAttribute("aria-valuetext", text);
}
const runs = () => state.mode === "full" || state.mode === "residual";
let line = lineAt(state.clock);
const loop = figureLoop(stage, (dt, calm) => {
  if (touring) {
    tourClock += dt;
    const step = TOUR[tourStep % TOUR.length];
    if (tourClock >= step.dur) { tourClock = 0; tourStep++; applyTour(); }
  }
  if (calm) {
    state.clock = STILL_T[state.mode];
    line = lineAt(state.clock);
    place(line);
    pressAt(state.mode === "mlp" ? 0.5 : line.crank, dt, true);
    drawBeads(null, 0);
    readout(line);
    return false;
  }
  if (runs()) state.clock += dt;
  line = lineAt(state.clock);
  place(line);
  if (state.mode === "mlp") { state.phase = (state.phase + dt / 2.4) % 1; pressAt(state.phase, dt, false); }
  else { state.phase = line.crank; pressAt(line.crank, dt, false); }
  const beads = state.mode === "attention" ? "lane" : state.mode === "full" && line.stage === "attention" && line.tA < PLATE_T * 0.98 ? "all" : null;
  state.beads = (state.beads + dt / 1.5) % 1;
  drawBeads(beads, state.beads);
  readout(line);
  return true;
});
const TOUR = [
  { mode: "full", dur: PERIOD },
  { mode: "attention", lane: 0, dur: 2.4 },
  { mode: "attention", lane: 1, dur: 2.4 },
  { mode: "attention", lane: 2, dur: 2.4 },
  { mode: "attention", lane: 3, dur: 2.4 },
  { mode: "mlp", dur: 4.8 },
  { mode: "residual", dur: PERIOD },
];
function applyTour() {
  const step = TOUR[tourStep % TOUR.length];
  setMode(step.mode, false);
  if (step.lane !== undefined) setLane(step.lane, false);
}
function setMode(mode, manual) {
  if (mode === state.mode) return;
  state.mode = mode;
  modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  lightUp();
  if (manual) describe();
  loop.kick();
}
function setLane(lane, manual) {
  lane = Math.max(0, Math.min(TOKENS.length - 1, lane));
  if (lane === state.lane) return;
  state.lane = lane;
  stage.setAttribute("aria-valuenow", String(lane));
  laneButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.lane) === lane)));
  lightUp();
  weightsTable();
  if (manual) describe();
  loop.kick();
}
function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !STILL.matches;
    tourClock = 0;
    tourStep = Math.max(0, TOUR.findIndex((step) => step.mode === state.mode && (step.lane === undefined || step.lane === state.lane)));
    loop.kick();
  }, 6000);
}
modeButtons.forEach((button) => button.addEventListener("click", () => { takeOver(); setMode(button.dataset.mode, true); describe(); }));
laneButtons.forEach((button) => button.addEventListener("click", () => { takeOver(); setLane(Number(button.dataset.lane), true); describe(); }));
stage.addEventListener("keydown", (event) => {
  let handled = true;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") { takeOver(); setLane(state.lane + 1, true); }
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { takeOver(); setLane(state.lane - 1, true); }
  else if (event.key === "Home") { takeOver(); setLane(0, true); }
  else if (event.key === "End") { takeOver(); setLane(TOKENS.length - 1, true); }
  else if (["1", "2", "3", "4"].includes(event.key)) { takeOver(); setMode(MODES[Number(event.key) - 1], true); describe(); }
  else handled = false;
  if (handled) event.preventDefault();
});
stage.addEventListener("pointerdown", () => takeOver());
let lastMove = 0;
stage.addEventListener("pointermove", (event) => { if (event.pointerType !== "touch" && event.timeStamp - lastMove > 400) { lastMove = event.timeStamp; takeOver(); } });
stage.addEventListener("focus", () => takeOver());
if (STILL.matches) touring = false;
lightUp();
weightsTable();
describe();
place(line);
readout(line);
`;

  const css = `
[data-fig="${id}"] .bk-cord-o,[data-fig="${id}"] .bk-cord-b{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:none}
[data-fig="${id}"] .bk-cord-o{stroke:var(--anatomy-mid)}
[data-fig="${id}"] .bk-cord-b{stroke:var(--anatomy-shade-3)}
[data-fig="${id}"] [data-cord][data-on] .bk-cord-o,[data-fig="${id}"] [data-cord][data-on] .bk-cord-b{stroke:var(--anatomy-lit)}
[data-fig="${id}"] .bk-bead{fill:var(--anatomy-paper);stroke:var(--anatomy-hi);stroke-width:.5;vector-effect:none}
[data-fig="${id}"] [data-cord][data-on] .bk-bead{stroke:var(--anatomy-lit)}
[data-fig="${id}"] .iso-solid[data-lit]>.iso-edge{stroke-width:1.2px}
[data-fig="${id}"] .fig-meter dd[data-blocked]{color:var(--anatomy-muted)}
[data-fig="${id}"] .bk-meter-head dd{color:var(--anatomy-text)}
@media (max-width:560px){[data-fig="${id}"] .iso-stage{overflow:hidden}[data-fig="${id}"] .iso-stage .iso-svg{width:116%;margin:0 -8%}}
`;
  return { html, css, script, needs: ["lathe"] };
}

// For audit.mjs: the cords, their draw order and the boxes they must clear.
export function geometry() {
  build();
  return { P, KS, V, cords: CORD_LIST, order: ORDER, obstacles: [...OBSTACLES], lineAt, slotOf, liftOf, Y, ROW, TOP_X, TOP_A, TOP_M, PUNCH_FACE, STROKE, strokeOf, PERIOD, CYCLE };
}
