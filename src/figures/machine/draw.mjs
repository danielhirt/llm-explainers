// The machine's drawing: one bench with two decks. The raised back deck builds the model once
// (corpus, tokenizer, training rig, checkpoint). The front deck runs it once per token (tape,
// tokenizer, embedding cabinet, transformer stack, logits board, sampler wheel and caster), and
// a return conveyor carries each new type slug back to the context row on the galley.
// Everything static is built here once. Functions marked "page" also run in the browser, so
// they use only k., G., P and the exported constants.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { BLOCKS, DRAWERS, COLUMNS, PROMPT_TOKENS, OUTPUT_TOKENS } from "./model.mjs";

export const WIDTH = 680;
export const HEIGHT = 420;

// World layout, in units of about one viewBox pixel. x runs along the bench, y toward the
// viewer, z up.
export const BENCH = { x: -314, y: -154, w: 360, d: 182, r: 9 };
const BENCH_H = 10;
const FOOT_H = 5;
export const RISER = { x: -306, y: -148, w: 262, d: 76, r: 4 };
export const DECK = 32.5; // back deck top

// Front line: the galley (context row) and the return conveyor share one bed.
export const LINE = { y0: -5, y1: 11, z: 5 }; // the bed runs from y0 to y1; slugs stand at z
export const SLUG = { w: 6, d: 8, h: 6, y: 3 };
export const PITCH = 7.4;
export const SET_X = -230; // the head of the context row, in front of the tokenizer's exit
export const GALLEY_X0 = -310;
export const BELT = { x0: -226, x1: 30 };

// Front stations.
export const SPOOL = { x: -293, y: -34, z: 17, r: 11, roll: 8 };
export const TOK = { x: -270, y: -52, w: 50, d: 36, r: 2, h: 26 };
export const CAB = { x: -212, y: -54, w: 52, d: 38, r: 2, h: 46 };
export const STK = { x: -148, y: -54, w: 42, d: 36 };
export const UNIT_H = 7.2;
export const UNIT_GAP = 1.3;
export const STK_Z0 = 5;
export const LOG = { x: -94, y: -40, w: 58, d: 5, h: 40 };
export const WHEEL = { x: -12, y: -32, r: 15, z: 10, h: 4 };
export const CAST = { x: 8, y: -50, w: 22, d: 30, r: 2, h: 25 };
export const CASTER_X = 19;

// Back stations.
export const CORPUS = { x: -300, y: -140, w: 22, d: 24 };
export const TRAINER = { x: -254, y: -140, w: 44, d: 30 };
export const TRAINER_TOP = DECK + 6;
export const CASE = { x: -250, y: -136, w: 26, d: 20, r: 0.8 };
export const RIG = { x: -198, y: -142, w: 58, d: 32 };
export const GAUGE = { x: -128, y: -120, r: 8, z: 44 };
export const CRADLE = { x: -104, y: -138, w: 40, d: 26, r: 1 };

export const P = k.fitProjection(
  [...k.boxCorners(BENCH, -BENCH_H - FOOT_H, 0), [STK.x + 12, STK.y + 6, 72], [CORPUS.x, CORPUS.y, 58], [CAST.x + CAST.w, CAST.y, CAST.h]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 64, elevation: 34 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 10) / 10;
const box = (plan, z, h, style = {}, steps = 2, bevel = 0) => S(k.slabOf({ r: 0.6, ...plan }, z, h, P, steps, bevel), { tone: "mid", ...style });
const face = (y, z, x = 0) => k.sideMatrix([x, y], z, P, "left");
const rectPath = (x, y, w, h) => `M${fix(x)} ${fix(y)}h${fix(w)}v${fix(h)}h${fix(-w)}Z`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const screws = (points, z, size = 0.45) => D(points.map(([x, y]) => at([x, y, z])), { size });
const onFront = (y, body) => `<g transform="${face(y, 0)}">${body}</g>`;
// Lines on a face that points at +x, in local (u, v): u runs along -y from y0, v runs down.
const onSide = (x, y0, body) => `<g transform="${k.sideMatrix([x, y0], 0, P, "right")}">${body}</g>`;
// A slot on a face that points at +y: a dark opening with its rim (closed, so it has no ends).
const frontSlot = (y, x0, x1, z0, z1) => onFront(y, `<path class="mx-hole" d="${rectPath(x0, -z1, x1 - x0, z1 - z0)}"/>${L(rectPath(x0, -z1, x1 - x0, z1 - z0), { tone: "lo" })}`);

// The screen region in which a body that leaves an opening (x0..x1, z0..z1 on the face y) is in
// front of that face: the opening swept toward the viewer. A part clipped to it slides out of
// the opening and stays hidden behind the face.
function openingSweep(x0, x1, z0, z1, y) {
  const corners = [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  return k.pathOf(G.hullOf([...corners, ...corners.map(([x, , z]) => [x, y + 60, z])].map(at)), true);
}

// ---------------------------------------------------------------- bench and back deck

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -BENCH_H - FOOT_H, BENCH_H, P)}"/>`];
  const feet = k.corners(BENCH, 18);
  for (const [x, y] of byDepth(feet)) out.push(S(k.cylinder(x, y, 6, -BENCH_H - FOOT_H, FOOT_H, P, 24, 0.4), { tone: "lo" }));
  out.push(S(k.slabOf(BENCH, -BENCH_H, BENCH_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(BENCH, -3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 4.5), 0, P), { tone: "lo" }));
  const corner = k.corners(BENCH, 9);
  out.push(L(corner.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(screws(corner, 0, 0.5));
  // Label plate at the front right of the bench.
  const label = { x: 8, y: 13, w: 30, d: 9, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.2), 0.7, P, 2), { tone: "faint" }));
  out.push(L([[11.5, 15.8, 18], [11.5, 18, 12], [11.5, 20.2, 15]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.7, P)).join(""), { tone: "lo", free: true }));
  out.push(screws([[label.x + label.w - 2.6, label.y + 2.6], [label.x + label.w - 2.6, label.y + label.d - 2.6]], 0.7, 0.4));
  return out.join("");
}

function riser() {
  const out = [];
  const front = RISER.y + RISER.d;
  out.push(S(k.slabOf(RISER, 0, DECK - 2.5, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(RISER, 5, P, 4), { tone: "faint" }) }));
  const top = k.insetPlan(RISER, -1.2);
  out.push(S(k.slabOf(top, DECK - 2.5, 2.5, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(top, 3.5), DECK, P, 4), { tone: "faint" }));
  out.push(screws(k.corners(top, 6), DECK, 0.45));
  // Front face: screws along it, and a vent panel at the right where the face shows.
  out.push(D([-290, -230, -170, -110, -62].map((x) => at([x, front, 18])), { size: 0.45 }));
  const vents = Array.from({ length: 6 }, (_, i) => rectPath(-86 + i * 5.4, -22, 2.2, 11)).join("");
  out.push(onFront(front, L(rectPath(-90, -25, 34, 17), { tone: "faint" }) + L(vents, { tone: "lo" })));
  // The right end face: an access panel held by four screws.
  const end = RISER.x + RISER.w;
  const panel = `<g transform="${k.sideMatrix([end, RISER.y + RISER.d - 12], 0, P, "right")}">${L(rectPath(0, -24, 52, 17), { tone: "faint" })}</g>`;
  out.push(panel);
  out.push(D([[RISER.y + RISER.d - 15, 9.5], [RISER.y + RISER.d - 61, 9.5], [RISER.y + RISER.d - 15, 21.5], [RISER.y + RISER.d - 61, 21.5]].map(([y, z]) => at([end, y, z])), { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- back deck stations

// Corpus: a tall stack of raw documents, a filter gate and the stack of selected text.
export const SELECTED = { x: -270, y: -136, w: 12, d: 16, h: 14 };
export const SHEET = { x: CORPUS.x + 4, y: CORPUS.y + 4, w: 14, d: 16, z: DECK + 26.4 };
function corpus() {
  const out = [];
  const stack = { ...CORPUS, r: 0.6 };
  const sheets = [];
  for (let z = DECK + 2.2; z < DECK + 25; z += 2.2) sheets.push(k.sideSeam(stack, z, P, 2));
  out.push(S(k.slabOf(stack, DECK, 26.4, P, 2), { tone: "hi", crease: "lo", inner: L(sheets.join(""), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(stack, 2.5), DECK + 26.4, P, 2), { tone: "faint" }));
  return out.join("");
}
// The filter gate between the raw stack and the selected stack: two posts and a top bar.
function gateBack() {
  return box({ x: -276, y: -138, w: 3, d: 3 }, DECK, 20, { tone: "mid" });
}
function gateFront() {
  const out = [box({ x: -276, y: -121, w: 3, d: 3 }, DECK, 20, { tone: "mid" })];
  out.push(box({ x: -276.6, y: -138.6, w: 4.2, d: 21.2 }, DECK + 20, 2.4, { tone: "mid" }, 2, 0.3));
  out.push(L(k.planOutline({ x: -275.6, y: -134, w: 2.2, d: 12, r: 1 }, DECK + 22.4, P, 3), { tone: "lo" }));
  out.push(screws([[-274.5, -137], [-274.5, -119]], DECK + 22.4, 0.4));
  return out.join("");
}
// The selected stack grows as the filter passes sheets (page).
function selectedAt(share) {
  const h = 2 + share * (SELECTED.h - 2);
  const plan = { ...SELECTED, r: 0.5 };
  const sheets = [];
  for (let z = DECK + 2.2; z < DECK + h - 0.8; z += 2.2) sheets.push(k.sideSeam(plan, z, P, 2));
  return k.solidSvg(k.slabOf(plan, DECK, h, P, 2), { tone: "hi", crease: "lo", inner: k.lineSvg(sheets.join(""), { tone: "faint" }) });
}

// Tokenizer trainer: a base, the master type case and a guillotine that cuts the sample.
export const CASE_GRID = { cols: 8, rows: 5 };
function caseLines(plan, z) {
  const lines = [];
  const { cols, rows } = CASE_GRID;
  const inner = k.insetPlan(plan, 1.2);
  for (let c = 1; c < cols; c++) {
    const x = inner.x + (inner.w * c) / cols;
    lines.push(k.lineOnTop([x, inner.y], [x, inner.y + inner.d], z, P));
  }
  for (let r = 1; r < rows; r++) {
    const y = inner.y + (inner.d * r) / rows;
    lines.push(k.lineOnTop([inner.x, y], [inner.x + inner.w, y], z, P));
  }
  return lines.join("") + k.planOutline(inner, z, P, 2);
}
// Screen points of the sorts in a type case's compartments, in a scattered filling order.
export function sortsOf(plan, z) {
  const { cols, rows } = CASE_GRID;
  const inner = k.insetPlan(plan, 1.2);
  const points = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) points.push(at([inner.x + (inner.w * (c + 0.5)) / cols, inner.y + (inner.d * (r + 0.5)) / rows, z]).map(fix));
  return points.map((point, index) => ({ point, order: (index * 17) % points.length })).sort((a, b) => a.order - b.order).map((entry) => entry.point);
}
function typeCase(plan, z) {
  return S(k.slabOf({ ...plan, r: 0.8 }, z, 3, P, 2, 0.4), { tone: "hi", inner: L(caseLines(plan, z + 3), { tone: "lo" }) });
}
export const BLADE = { x: -215, y0: -136, y1: -118, up: DECK + 20.5, drop: 6.5 };
function trainer() {
  const out = [];
  out.push(box({ ...TRAINER, r: 1 }, DECK, TRAINER_TOP - DECK, { tone: "mid" }, 3, 0.5));
  out.push(screws([[TRAINER.x + 2.4, TRAINER.y + 2.4], [TRAINER.x + 2.4, TRAINER.y + TRAINER.d - 2.4]], TRAINER_TOP));
  out.push(typeCase(CASE, TRAINER_TOP));
  return out.join("");
}
// The sample under the guillotine, the posts, the crossbar.
function guillotineBack() {
  const out = [box({ x: BLADE.x - 1.5, y: BLADE.y0 - 3, w: 3, d: 3 }, TRAINER_TOP, 16, { tone: "mid" })];
  const sample = { x: BLADE.x - 3.5, y: BLADE.y0 + 3, w: 7, d: BLADE.y1 - BLADE.y0 - 6, r: 0.4 };
  out.push(S(k.slabOf(sample, TRAINER_TOP, 5, P, 2), { tone: "hi", crease: "lo", inner: L(k.sideSeam(sample, TRAINER_TOP + 2.5, P, 2), { tone: "faint" }) }));
  return out.join("");
}
function guillotineFront() {
  const out = [box({ x: BLADE.x - 1.5, y: BLADE.y1, w: 3, d: 3 }, TRAINER_TOP, 16, { tone: "mid" })];
  out.push(box({ x: BLADE.x - 2, y: BLADE.y0 - 3.6, w: 4, d: BLADE.y1 - BLADE.y0 + 7.2 }, TRAINER_TOP + 16, 2.6, { tone: "mid" }, 2, 0.3));
  out.push(screws([[BLADE.x, BLADE.y0 - 1.5], [BLADE.x, BLADE.y1 + 1.5]], TRAINER_TOP + 18.6, 0.4));
  return out.join("");
}
// The blade, built raised; the page drops it onto the sample.
function blade() {
  return box({ x: BLADE.x - 0.6, y: BLADE.y0, w: 1.2, d: BLADE.y1 - BLADE.y0 }, BLADE.up - 4, 4, { tone: "hi" });
}

// The encoded strip: token IDs on a tape that leaves the tokenizer for the training rig.
export const STRIP = { x: -247, y: -117.4, w: 29.5, d: 4.2, z: DECK + 6, travel: 48 };
function strip() {
  const plan = { x: STRIP.x, y: STRIP.y, w: STRIP.w, d: STRIP.d, r: 0.3 };
  const marks = [];
  for (let x = STRIP.x + 1.6; x < STRIP.x + STRIP.w - 2; x += 3.1) marks.push(k.planOutline({ x, y: STRIP.y + 1, w: 2, d: 2.4, r: 0.2 }, STRIP.z + 0.8, P, 1));
  return S(k.slabOf(plan, STRIP.z, 0.8, P, 1), { tone: "hi", crease: "none", inner: L(marks.join(""), { tone: "lo" }) });
}

// Training rig: a board of trim screws (the weights), a bridge that sweeps across it and a
// loss gauge.
export const SCREWS = { cols: 7, rows: 3, r: 1.7 };
export const BRIDGE = { x0: RIG.x + 4, x1: RIG.x + RIG.w - 12, w: 4 };
export const RIG_TOP = DECK + 6;
const RAIL_TOP = DECK + 6.6;
function screwCentres() {
  const out = [];
  for (let r = 0; r < SCREWS.rows; r++) for (let c = 0; c < SCREWS.cols; c++) out.push([RIG.x + 8 + c * 6.6, RIG.y + 5.5 + r * 8.4]);
  return out;
}
export const SCREW_CENTRES = screwCentres();
function rig() {
  const out = [];
  // Bridge rail behind the board.
  out.push(box({ x: RIG.x, y: RIG.y - 4, w: RIG.w - 8, d: 3 }, DECK, RAIL_TOP - DECK, { tone: "lo" }));
  out.push(box({ ...RIG, r: 1.2 }, DECK, 6, { tone: "mid" }, 3, 0.6));
  const panel = { x: RIG.x + 3, y: RIG.y + 2.5, w: RIG.w - 13, d: RIG.d - 5, r: 1 };
  out.push(L(k.planOutline(panel, RIG_TOP, P, 3), { tone: "faint" }));
  out.push(L(SCREW_CENTRES.map(([x, y]) => k.ring(x, y, SCREWS.r, RIG_TOP, P, 14)).join(""), { tone: "mid" }));
  return out.join("");
}
function rigFront() {
  return box({ x: RIG.x, y: RIG.y + RIG.d + 1, w: RIG.w - 8, d: 3 }, DECK, RAIL_TOP - DECK, { tone: "lo" });
}
// Trim screw slots at a set of turns, one per screw (page).
function slotsAt(turns) {
  return SCREW_CENTRES.map(([x, y], index) => {
    const a = 0.6 + (turns[index] || 0);
    const r = SCREWS.r;
    return k.lineOnTop([x - r * Math.cos(a), y - r * Math.sin(a)], [x + r * Math.cos(a), y + r * Math.sin(a)], RIG_TOP, P);
  }).join("");
}
// The bridge, built at x = BRIDGE.x0; the page moves it along x.
function bridge() {
  const out = [];
  const x = BRIDGE.x0;
  out.push(box({ x, y: RIG.y - 4.4, w: BRIDGE.w, d: RIG.d + 8.8 }, RAIL_TOP, 3, { tone: "hi" }, 2, 0.3));
  out.push(screws([[x + BRIDGE.w / 2, RIG.y - 2.6], [x + BRIDGE.w / 2, RIG.y + RIG.d + 2.6]], RAIL_TOP + 3, 0.45));
  return out.join("");
}
function gauge() {
  const out = [];
  const { x, y, r, z } = GAUGE;
  out.push(S(k.cylinder(x, y, 3.4, DECK, 2, P, 18), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.8, DECK + 2, z - DECK - 2, P, 14), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, r, z, 3.2, P, 48, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 1.3, z + 3.2, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r - 1.3, 20, 5, z + 3.2, [1, 2], P, -Math.PI * 0.75, Math.PI * 1.5);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 0.9, z + 3.2, P, 12), { tone: "mid" }));
  return out.join("");
}
// The loss needle: 0 is no loss, 1 is the top of the scale (page).
function needleAt(loss) {
  const { x, y, r, z } = GAUGE;
  const angle = -Math.PI * 0.75 + loss * Math.PI * 1.5;
  const tip = r - 2.4;
  return k.lineOnTop([x - Math.sin(angle) * 1.6, y + Math.cos(angle) * 1.6], [x + Math.sin(angle) * tip, y - Math.cos(angle) * tip], z + 3.4, P);
}

// Checkpoint: a cradle with two cheeks; the cartridge is lowered in and a hasp locks it.
export const CART = { x: -99, y: -134, w: 30, d: 18, h: 11, z: DECK + 5.5, drop: 14 };
function cradleBack() {
  const out = [];
  out.push(box({ ...CRADLE, r: 1 }, DECK, 5.5, { tone: "mid" }, 3, 0.5));
  out.push(L(k.planOutline(k.insetPlan(CRADLE, 3), DECK + 5.5, P, 2), { tone: "faint" }));
  out.push(box({ x: CRADLE.x, y: CRADLE.y, w: 4, d: CRADLE.d }, DECK + 5.5, 9, { tone: "mid" }));
  return out.join("");
}
function cradleFront() {
  return box({ x: CRADLE.x + CRADLE.w - 4, y: CRADLE.y, w: 4, d: CRADLE.d }, DECK + 5.5, 9, { tone: "mid" });
}
// A cartridge, built seated at z.
function cartridge(plan, z, h) {
  const out = [];
  const seam = k.sideSeam({ ...plan, r: 1 }, z + h - 3, P, 2);
  out.push(S(k.slabOf({ ...plan, r: 1 }, z, h, P, 2, 0.5), { tone: "hi", inner: L(seam, { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), z + h, P, 2), { tone: "faint" }));
  out.push(screws(k.corners(plan, 1.6), z + h, 0.4));
  return out.join("");
}
// The label plate on a cartridge's front face, and its printed lines.
function labelPlate(plan, z) {
  return onFront(plan.y + plan.d + 0.05, L(rectPath(plan.x + 3.4, -(z + 7.6), plan.w - 6.8, 6), { tone: "lo" }));
}
function labelLines(plan, z) {
  const y = plan.y + plan.d + 0.05;
  const x0 = plan.x + 5.4;
  return [[x0, z + 6, 13], [x0, z + 4.4, 8], [x0, z + 2.8, 10]].map(([x, zz, w]) => k.segment([x, y, zz], [x + w, y, zz], P)).join("");
}
export const STK_CART = { x: STK.x + 6, y: STK.y + 8, w: STK.w - 12, d: STK.d - 16, h: 9, r: 1 };

// A hinged hasp: a bar that lies along x from x0 to x1 on a lid at height z and turns up about a
// hinge at x1 (page). `open` runs from 0 (closed and locked) to 1 (turned back past upright).
function haspAt(h, open) {
  const angle = open * 1.75;
  const F = G.frameOf([h.x1, h.y, h.z + 0.7], [-Math.cos(angle), 0, Math.sin(angle)], [0, 1, 0], [Math.sin(angle), 0, Math.cos(angle)]);
  return k.solidSvg(G.prismOf(F, [[-1.5, -0.7], [1.5, -0.7], [1.5, 0.7], [-1.5, 0.7]], 0, h.x1 - h.x0, P), { tone: "hi" });
}
// The hinge block a hasp turns on, standing on the surface at h.base.
function hingeBlock(h) {
  return box({ x: h.x1, y: h.y - 2.4, w: 2.8, d: 4.8, r: 0.5 }, h.base, h.z + 1.8 - h.base, { tone: "mid" }) + screws([[h.x1 + 1.4, h.y]], h.z + 1.8, 0.45);
}
// The four locks: the master type case, the cartridge in its cradle, and the two copies on the
// run deck.
export const HASPS = {
  case: { x0: CASE.x - 1, x1: CASE.x + CASE.w + 0.6, y: CASE.y + CASE.d / 2, z: TRAINER_TOP + 3, base: TRAINER_TOP },
  cart: { x0: CART.x - 1, x1: CRADLE.x + CRADLE.w - 4, y: CART.y + CART.d / 2, z: CART.z + CART.h, base: DECK + 14.5 },
  tok: { x0: TOK.x + 4, x1: TOK.x + 32.6, y: TOK.y + 16, z: TOK.h + 3, base: TOK.h },
  stk: { x0: STK_CART.x - 1, x1: STK_CART.x + STK_CART.w + 0.6, y: STK_CART.y + STK_CART.d / 2, z: 0, base: 0 },
};

// ---------------------------------------------------------------- front deck stations

function spoolBack() {
  const out = [];
  out.push(box({ x: SPOOL.x - 7, y: SPOOL.y - 13, w: 14, d: 26, r: 1 }, 0, 2, { tone: "lo" }, 2, 0.3));
  out.push(box({ x: SPOOL.x - 2.5, y: SPOOL.y - 12, w: 5, d: 2.4 }, 2, SPOOL.z, { tone: "mid" }));
  return out.join("");
}
const SPOOL_F = G.frameAlong([SPOOL.x, SPOOL.y - 9.5, SPOOL.z], [0, 1, 0]);
function reel() {
  const out = [];
  const profile = [[0, SPOOL.r], [1.2, SPOOL.r], [1.2, SPOOL.roll], [17.8, SPOOL.roll], [17.8, SPOOL.r], [19, SPOOL.r]];
  out.push(S(G.solidOf(profile, SPOOL_F, P, { steps: 48 }), { tone: "hi" }));
  out.push(L(G.circleOf(SPOOL_F, 19, 2.2, P, 20), { tone: "lo" }));
  out.push(L(G.circleOf(SPOOL_F, 19, SPOOL.r - 1.6, P, 40), { tone: "faint" }));
  return out.join("");
}
function spoolFront() {
  return box({ x: SPOOL.x - 2.5, y: SPOOL.y + 9.6, w: 5, d: 2.4 }, 2, SPOOL.z, { tone: "mid" }) + screws([[SPOOL.x, SPOOL.y + 10.8]], SPOOL.z + 2, 0.45);
}
// The prompt tape between the reel and the tokenizer's feed slot.
export const TAPE = { x0: SPOOL.x, x1: TOK.x, y0: -38, y1: -30, z: SPOOL.z - SPOOL.roll - 0.4 };
function tape() {
  const plan = { x: TAPE.x0, y: TAPE.y0, w: TAPE.x1 - TAPE.x0, d: TAPE.y1 - TAPE.y0, r: 0 };
  return S(k.slabOf(plan, TAPE.z, 0.4, P, 1), { tone: "hi", crease: "none" });
}
// Printed marks on the tape, shifted by how far the tape has moved (page). They stand for text.
function tapeMarks(offset) {
  const out = [];
  const span = 5.2;
  const shift = ((offset % span) + span) % span;
  for (let x = TAPE.x0 + 1 + shift - span; x < TAPE.x1 - 1; x += span) {
    const a = Math.max(TAPE.x0 + 1.2, x);
    const b = Math.min(TAPE.x1 - 1.2, x + 3.4);
    if (b - a > 0.4) out.push(k.lineOnTop([a, TAPE.y0 + 2.6], [b, TAPE.y0 + 2.6], TAPE.z + 0.4, P));
    const c = Math.min(TAPE.x1 - 1.2, x + 2.2);
    if (c - a > 0.4) out.push(k.lineOnTop([a, TAPE.y0 + 5.2], [c, TAPE.y0 + 5.2], TAPE.z + 0.4, P));
  }
  return out.join("");
}

// The opening a slug leaves through, and the block it slides across to the line.
export const EXIT = { x0: SET_X - 4, x1: SET_X + 4, z0: LINE.z - 0.2, z1: LINE.z + SLUG.h + 1.2, y: TOK.y + TOK.d };
export const OUTLET = { x0: CASTER_X - 4, x1: CASTER_X + 4, z0: LINE.z - 0.2, z1: LINE.z + SLUG.h + 1.2, y: CAST.y + CAST.d };
const transfer = (x, y) => box({ x: x - 4.6, y, w: 9.2, d: LINE.y0 - y, r: 0.4 }, 0, LINE.z, { tone: "lo" }, 2, 0.3);

export const COUNTER = { cells: 3, w: 3.2, h: 4.4, gap: 0.5 };
function counter(x0, y, z, name) {
  const w = COUNTER.cells * COUNTER.w + (COUNTER.cells - 1) * COUNTER.gap + 3;
  const solid = box({ x: x0, y, w, d: 2.4, r: 0.6 }, z, COUNTER.h + 3, { tone: "mid" }, 2, 0.3);
  const cells = Array.from({ length: COUNTER.cells }, (_, index) => rectPath(1.5 + index * (COUNTER.w + COUNTER.gap), -COUNTER.h - 1.5, COUNTER.w, COUNTER.h)).join("");
  const digits = Array.from({ length: COUNTER.cells }, (_, index) => `<text class="mx-digit" x="${fix(1.5 + index * (COUNTER.w + COUNTER.gap) + COUNTER.w / 2)}" y="-2.6" font-size="3.3" text-anchor="middle" data-${name}="${index}">0</text>`).join("");
  return solid + `<g transform="${face(y + 2.4, z, x0)}"><path class="mx-window" d="${cells}"/>${digits}${L(cells, { tone: "lo" })}</g>`;
}
export const TOK_CASE = { x: TOK.x + 5, y: TOK.y + 6, w: 26, d: 20, r: 0.8 };
export const CUTTER = { x: TOK.x + TOK.w - 13, y: TOK.y + 12, w: 8, d: 12, stroke: 3 };
function tokenizer() {
  const out = [];
  out.push(S(k.slabOf(TOK, 0, TOK.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(TOK, 6, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(TOK_CASE, -1.4), TOK.h, P, 2), { tone: "lo" }));
  out.push(frontSlot(EXIT.y, EXIT.x0, EXIT.x1, EXIT.z0, EXIT.z1));
  out.push(screws([[TOK.x + 2.4, TOK.y + 2.4], [TOK.x + TOK.w - 2.4, TOK.y + 2.4], [TOK.x + TOK.w - 2.4, TOK.y + TOK.d - 2.4]], TOK.h, 0.45));
  // Cutter guide block: the cutter head strokes down into it on each cut.
  out.push(box({ x: CUTTER.x - 1, y: CUTTER.y - 1, w: CUTTER.w + 2, d: CUTTER.d + 2, r: 0.8 }, TOK.h, 2.4, { tone: "lo" }, 2, 0.3));
  out.push(L(k.planOutline({ x: CUTTER.x + 1.2, y: CUTTER.y + 1.2, w: CUTTER.w - 2.4, d: CUTTER.d - 2.4, r: 0.4 }, TOK.h + 2.4, P, 1), { tone: "lo" }));
  // Vent slots on the +x face.
  const vents = Array.from({ length: 5 }, (_, i) => rectPath(6 + i * 4.4, -21, 2, 10)).join("");
  out.push(onSide(TOK.x + TOK.w, TOK.y + TOK.d, L(vents, { tone: "lo" })));
  return out.join("");
}
// The cutter head, built raised; the page strokes it down on each cut.
function cutter() {
  const out = [];
  out.push(box({ x: CUTTER.x + 1.6, y: CUTTER.y + 1.6, w: CUTTER.w - 3.2, d: CUTTER.d - 3.2, r: 0.6 }, TOK.h + 2.4, 3 + CUTTER.stroke, { tone: "mid" }));
  out.push(box({ ...CUTTER, r: 1 }, TOK.h + 5.4 + CUTTER.stroke, 3, { tone: "hi" }, 2, 0.4));
  out.push(screws([[CUTTER.x + CUTTER.w / 2, CUTTER.y + CUTTER.d / 2]], TOK.h + 8.4 + CUTTER.stroke, 0.55));
  return out.join("");
}

// Embedding cabinet: twelve drawers in three rows. Each drawer holds the rows of a range of IDs.
export const DRAWER = { cols: 4, rows: 3, w: 11, h: 11.6, gap: 1.6, x0: CAB.x + 3.4, z0: 7.6, depth: 14, out: 9 };
export const FRONT_Y = CAB.y + CAB.d;
export function drawerBox(index) {
  const col = index % DRAWER.cols;
  const row = DRAWER.rows - 1 - Math.floor(index / DRAWER.cols);
  return { x: DRAWER.x0 + col * (DRAWER.w + DRAWER.gap), z: DRAWER.z0 + row * (DRAWER.h + DRAWER.gap), w: DRAWER.w, h: DRAWER.h };
}
function cabinet() {
  const out = [];
  out.push(S(k.slabOf(CAB, 0, CAB.h, P, 3, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CAB, 3), CAB.h, P, 3), { tone: "faint" }));
  out.push(screws(k.corners(CAB, 1.8), CAB.h, 0.45));
  out.push(L(k.sideSeam(CAB, 4, P, 3), { tone: "faint" }));
  const holes = Array.from({ length: DRAWERS }, (_, index) => {
    const b = drawerBox(index);
    return rectPath(b.x, -(b.z + b.h), b.w, b.h);
  }).join("");
  out.push(onFront(FRONT_Y, `<path class="mx-hole" d="${holes}"/>`));
  // Side panel on the +x face, held by four screws.
  const side = CAB.x + CAB.w;
  out.push(onSide(side, FRONT_Y - 5, L(rectPath(0, -40, CAB.d - 10, 32), { tone: "faint" })));
  out.push(D([[FRONT_Y - 7.5, 10.5], [FRONT_Y - CAB.d + 7.5, 10.5], [FRONT_Y - 7.5, 37.5], [FRONT_Y - CAB.d + 7.5, 37.5]].map(([y, z]) => at([side, y, z])), { size: 0.45 }));
  return out.join("");
}
// One drawer, built closed: its box (with the row card inside) and the front with a pull and a
// label holder.
function drawer(index) {
  const b = drawerBox(index);
  const out = [];
  const plan = { x: b.x + 0.4, y: FRONT_Y - DRAWER.depth, w: b.w - 0.8, d: DRAWER.depth, r: 0.3 };
  out.push(S(k.slabOf(plan, b.z + 0.4, b.h - 1.6, P, 1), { tone: "mid", crease: "faint" }));
  out.push(L(k.planOutline({ x: b.x + 2, y: FRONT_Y - 8, w: b.w - 4, d: 4.5, r: 0.3 }, b.z + b.h - 1.2, P, 1), { tone: "lo" }));
  out.push(S(k.slabOf({ x: b.x, y: FRONT_Y - 0.2, w: b.w, d: 1.4, r: 0.4 }, b.z, b.h, P, 2), { tone: "mid" }));
  const pull = k.pathOf(k.roundedPlan({ x: b.x + b.w / 2 - 2.6, y: -(b.z + 4.6), w: 5.2, d: 1.8, r: 0.9 }, 3), true);
  out.push(onFront(FRONT_Y + 1.2, L(rectPath(b.x + 2.6, -(b.z + b.h - 2), b.w - 5.2, 2.6), { tone: "faint" }) + L(pull, { tone: "hi" })));
  return out.join("");
}

// Transformer stack: a base, six identical units on four guide pillars, a top plate and the
// mounted checkpoint cartridge. Each unit has a lamp and a cache rack on its front face.
export const UNIT = { x: STK.x + 2, y: STK.y + 2, w: STK.w - 4, d: STK.d - 4 };
export const STK_FRONT = UNIT.y + UNIT.d;
export const unitZ = (i) => STK_Z0 + 1.3 + i * (UNIT_H + UNIT_GAP);
export const TOP_Z = unitZ(BLOCKS) + 2.2;
HASPS.stk.z = TOP_Z + 3 + STK_CART.h;
HASPS.stk.base = TOP_Z + 3;
export const RACK = { x0: UNIT.x + 9, pitch: 2.4, w: 1.5, h: 3.8, slots: PROMPT_TOKENS.length + OUTPUT_TOKENS.length };
const CHAMFER = 4;
const PILLAR_R = 1.9;
const inset = (PILLAR_R * Math.SQRT2 - CHAMFER) / -2; // pillar sits in the chamfer, tangent to it
const PILLARS = [
  [UNIT.x + inset, UNIT.y + inset],
  [UNIT.x + UNIT.w - inset, UNIT.y + inset],
  [UNIT.x + inset, UNIT.y + UNIT.d - inset],
  [UNIT.x + UNIT.w - inset, UNIT.y + UNIT.d - inset],
];
const chamfered = (plan, c) => [
  [plan.x + c, plan.y],
  [plan.x + plan.w - c, plan.y],
  [plan.x + plan.w, plan.y + c],
  [plan.x + plan.w, plan.y + plan.d - c],
  [plan.x + plan.w - c, plan.y + plan.d],
  [plan.x + c, plan.y + plan.d],
  [plan.x, plan.y + plan.d - c],
  [plan.x, plan.y + c],
];
export const UNIT_RING = chamfered(UNIT, CHAMFER);
function stackBase() {
  const out = [];
  const base = { x: STK.x - 5, y: STK.y - 5, w: STK.w + 10, d: STK.d + 10, r: 2 };
  out.push(S(k.slabOf(base, 0, STK_Z0, P, 3, 0.5), { tone: "mid" }));
  out.push(screws(k.corners(base, 2.2), STK_Z0, 0.45));
  for (const [x, y] of PILLARS.slice(0, 2)) out.push(S(k.cylinder(x, y, PILLAR_R, STK_Z0, TOP_Z - STK_Z0, P, 16), { tone: "mid", crease: "none" }));
  return out.join("");
}
function unit(i) {
  const z = unitZ(i);
  const out = [S(k.extrude(UNIT_RING, z, UNIT_H, P, { bevel: 0.4 }), { tone: "hi" })];
  const mid = z + UNIT_H / 2;
  const rack = Array.from({ length: RACK.slots }, (_, s) => rectPath(RACK.x0 + s * RACK.pitch, -(mid + RACK.h / 2), RACK.w, RACK.h)).join("");
  out.push(onFront(STK_FRONT, L(rack, { tone: "faint" }) + `<path class="mx-card" data-cache="${i}" d=""/>` + `<circle class="mx-lamp" data-lamp="${i}" cx="${fix(UNIT.x + 5.5)}" cy="${fix(-mid)}" r="1.5"/>` + L(`M${fix(UNIT.x + 5.5 + 1.5)} ${fix(-mid)}A1.5 1.5 0 1 1 ${fix(UNIT.x + 5.5 - 1.5)} ${fix(-mid)}A1.5 1.5 0 1 1 ${fix(UNIT.x + 5.5 + 1.5)} ${fix(-mid)}Z`, { tone: "lo" })));
  return out.join("");
}
function stackFront() {
  const out = [];
  for (const [x, y] of PILLARS.slice(2)) out.push(S(k.cylinder(x, y, PILLAR_R, STK_Z0, TOP_Z - STK_Z0, P, 16), { tone: "mid", crease: "none" }));
  const plate = { x: STK.x - 1.5, y: STK.y - 1.5, w: STK.w + 3, d: STK.d + 3, r: 2 };
  out.push(S(k.slabOf(plate, TOP_Z, 3, P, 3, 0.5), { tone: "mid" }));
  out.push(screws(PILLARS, TOP_Z + 3, 0.55));
  out.push(L(k.planOutline(k.insetPlan(STK_CART, -1.6), TOP_Z + 3, P, 2), { tone: "lo" }));
  return out.join("");
}

// Logits board: ten gauge columns. A slider in each column rises to that entry's score.
export const SLIDER = { w: 3.6, h: 2.6, z0: 6.5, z1: 33 };
export const LOG_FRONT = LOG.y + LOG.d;
export const columnX = (i) => LOG.x + 10 + i * 6;
function logitsBoard() {
  const out = [];
  const foot = { x: LOG.x - 3, y: LOG.y - 6, w: LOG.w + 6, d: 17, r: 1.5 };
  out.push(S(k.slabOf(foot, 0, 3.6, P, 3, 0.5), { tone: "lo" }));
  out.push(S(k.slabOf({ ...LOG, r: 0.8 }, 3.6, LOG.h - 3.6, P, 2, 0.5), { tone: "mid" }));
  const slots = Array.from({ length: COLUMNS }, (_, i) => rectPath(columnX(i) - 0.7, -(SLIDER.z1 + 3.6), 1.4, SLIDER.z1 - SLIDER.z0 + 4)).join("");
  // A scale strip at the left: ticks hang from its right edge every 3.3 units.
  const sx = LOG.x + 2;
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const z = SLIDER.z0 + 1.3 + i * 3.3;
    ticks.push(`M${fix(sx + 2)} ${fix(-z)}H${fix(sx + 2 + (i % 4 === 0 ? 2.4 : 1.4))}`);
  }
  out.push(onFront(LOG_FRONT, L(slots, { tone: "lo" }) + L(rectPath(sx, -(SLIDER.z1 + 2.6), 2, SLIDER.z1 - SLIDER.z0 + 2.6), { tone: "lo" }) + L(ticks.join(""), { tone: "lo" })));
  out.push(screws([[LOG.x + 2, LOG.y + LOG.d / 2], [LOG.x + LOG.w - 2, LOG.y + LOG.d / 2]], LOG.h, 0.45));
  return out.join("");
}
// One slider, built at the bottom of column i; the page lifts it.
function slider(i) {
  const x = columnX(i);
  return box({ x: x - SLIDER.w / 2, y: LOG_FRONT, w: SLIDER.w, d: 2.4, r: 0.5 }, SLIDER.z0, SLIDER.h, { tone: "hi" }, 2, 0.3);
}

// Sampler: a wheel with pockets on a pedestal, and the caster that casts the chosen slug.
function wheel() {
  const out = [];
  const { x, y, r, z, h } = WHEEL;
  out.push(S(k.cylinder(x, y, 9, 0, 3, P, 32, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 3, 3, z - 3, P, 16), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, r, z, h, P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(x, y, r - 2.4, z + h, P, 64), { tone: "lo" }));
  out.push(L(k.ring(x, y, 4, z + h, P, 24), { tone: "lo" }));
  return out.join("");
}
function hub() {
  return S(k.cylinder(WHEEL.x, WHEEL.y, 2.2, WHEEL.z + WHEEL.h, 2.2, P, 16), { tone: "mid" });
}
// Pocket dividers for a list of shares, turned by `turn` (page).
function pocketLines(shares, turn) {
  const { x, y, r, z, h } = WHEEL;
  let a = turn;
  const out = [];
  for (const share of shares) {
    out.push(k.lineOnTop([x + 4 * Math.cos(a), y + 4 * Math.sin(a)], [x + (r - 2.4) * Math.cos(a), y + (r - 2.4) * Math.sin(a)], z + h, P));
    a += share * Math.PI * 2;
  }
  return out.join("");
}
function casterBody() {
  const out = [];
  out.push(S(k.slabOf(CAST, 0, CAST.h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(CAST, 4, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CAST, 3), CAST.h, P, 3), { tone: "faint" }));
  out.push(screws(k.corners(CAST, 1.8), CAST.h, 0.45));
  // Hopper of blank slug stock on top.
  out.push(box({ x: CAST.x + 5, y: CAST.y + 6, w: 12, d: 12, r: 1 }, CAST.h, 6, { tone: "mid" }, 2, 0.4));
  out.push(L(k.planOutline({ x: CAST.x + 7, y: CAST.y + 8, w: 8, d: 8, r: 0.6 }, CAST.h + 6, P, 2), { tone: "lo" }));
  out.push(frontSlot(OUTLET.y, OUTLET.x0, OUTLET.x1, OUTLET.z0, OUTLET.z1));
  out.push(onSide(CAST.x + CAST.w, CAST.y + CAST.d - 5, L(rectPath(0, -20, CAST.d - 10, 12), { tone: "faint" })));
  out.push(D([[CAST.y + CAST.d - 7, 10], [CAST.y + 7, 10], [CAST.y + CAST.d - 7, 18], [CAST.y + 7, 18]].map(([y, z]) => at([CAST.x + CAST.w, y, z])), { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- the front line

export const FENCE_BACK_X1 = SET_X - 4.2;
function lineBed() {
  const out = [];
  const bed = { x: GALLEY_X0, y: LINE.y0, w: BELT.x1 + 6 - GALLEY_X0, d: LINE.y1 - LINE.y0, r: 1 };
  out.push(S(k.slabOf(bed, 0, LINE.z - 1.6, P, 2, 0.4), { tone: "lo" }));
  // Galley floor, and the back fence up to the tokenizer's exit.
  out.push(box({ x: GALLEY_X0, y: LINE.y0, w: BELT.x0 - GALLEY_X0, d: LINE.y1 - LINE.y0 }, LINE.z - 1.6, 1.6, { tone: "mid" }));
  out.push(box({ x: GALLEY_X0, y: LINE.y0, w: FENCE_BACK_X1 - GALLEY_X0, d: 1.6 }, LINE.z, 3, { tone: "mid" }));
  // Conveyor belt between two rollers.
  out.push(box({ x: BELT.x0, y: LINE.y0 + 1, w: BELT.x1 - BELT.x0, d: LINE.y1 - LINE.y0 - 2 }, LINE.z - 1.6, 1.6, { tone: "hi" }));
  return out.join("");
}
// Belt ribs shifted by the belt's travel (page).
function beltRibs(offset) {
  const out = [];
  const y0 = LINE.y0 + 1;
  const y1 = LINE.y1 - 1;
  const shift = ((offset % 6) + 6) % 6;
  for (let x = BELT.x0 + 3 - shift; x < BELT.x1 - 1; x += 6) if (x > BELT.x0 + 1) out.push(k.lineOnTop([x, y0], [x, y1], LINE.z, P));
  return out.join("");
}
function lineFront() {
  const out = [];
  out.push(box({ x: GALLEY_X0, y: LINE.y1 - 1.6, w: BELT.x0 - GALLEY_X0, d: 1.6 }, LINE.z, 3, { tone: "mid" }));
  out.push(box({ x: GALLEY_X0 - 2, y: LINE.y0, w: 2, d: LINE.y1 - LINE.y0 }, LINE.z - 1.6, 6, { tone: "mid" }));
  for (const x of [BELT.x0, BELT.x1]) {
    const F = G.frameAlong([x, LINE.y0 + 0.4, LINE.z - 2.4], [0, 1, 0]);
    out.push(S(G.disc(0, LINE.y1 - LINE.y0 - 0.8, 2.4, F, P, { steps: 24 }), { tone: "mid" }));
    out.push(L(G.circleOf(F, LINE.y1 - LINE.y0 - 0.8, 0.9, P, 12), { tone: "lo" }));
  }
  // Context ruler in front of the galley: one tick per position, a major tick every fifth.
  const strip = { x: GALLEY_X0, y: LINE.y1 + 2.5, w: BELT.x0 - GALLEY_X0, d: 5, r: 0.6 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 2), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let i = 0; i < RACK.slots; i++) {
    const x = SET_X - i * PITCH;
    (i % 5 === 0 ? major : minor).push(k.lineOnTop([x, strip.y], [x, strip.y + (i % 5 === 0 ? 3.4 : 2)], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  return out.join("");
}

// One type slug with its token ID on top, built at x = 0 on the line (page moves it).
function slugSvg(id) {
  const plan = { x: -SLUG.w / 2, y: SLUG.y - SLUG.d / 2, w: SLUG.w, d: SLUG.d, r: 0.5 };
  const z = LINE.z;
  const text = `<text class="mx-id" transform="${k.topMatrix([0, SLUG.y], z + SLUG.h, P, "x")}" y="0.95" font-size="2.6" text-anchor="middle">${id}</text>`;
  return k.solidSvg(k.slabOf(plan, z, SLUG.h, P, 2, 0.3), { tone: "hi", className: "mx-slug" }) + text;
}

// ---------------------------------------------------------------- assembly

export function drawMachine({ id }) {
  const clip = (name, d) => `<clipPath id="${id}-${name}"><path d="${d}"/></clipPath>`;
  const drawerClips = Array.from({ length: DRAWERS }, (_, index) => {
    const b = drawerBox(index);
    return clip(`d${index}`, openingSweep(b.x - 0.3, b.x + b.w + 0.3, b.z - 0.3, b.z + b.h + 0.3, FRONT_Y - 0.2));
  }).join("");
  const defs = `<defs>${clip("exit", openingSweep(EXIT.x0, EXIT.x1, EXIT.z0, EXIT.z1, EXIT.y))}${clip("outlet", openingSweep(OUTLET.x0, OUTLET.x1, OUTLET.z0, OUTLET.z1, OUTLET.y))}${drawerClips}</defs>`;
  const st = (key, body) => `<g data-station="${key}">${body}</g>`;
  const part = (name, body, style = "") => `<g data-part="${name}"${style ? ` style="${style}"` : ""}>${body}</g>`;
  const cartPlan = { x: CART.x, y: CART.y, w: CART.w, d: CART.d, r: 1 };

  const back = [
    riser(),
    st("corpus", corpus() + gateBack() + part("selected", selectedAt(0.25)) + part("sheet", S(k.slabOf({ ...SHEET, r: 0.3 }, SHEET.z, 0.6, P, 1), { tone: "hi", crease: "none" }), "opacity:0") + gateFront()),
    st("tokenizer", trainer() + guillotineBack() + part("sorts", "") + part("blade", blade()) + guillotineFront() + hingeBlock(HASPS.case) + part("hasp-case", haspAt(HASPS.case, 0))),
    st("training", rig() + part("strip", strip()) + part("slots", L(slotsAt([]), { tone: "hi" })) + part("bridge", bridge()) + rigFront() + gauge() + `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="${needleAt(0.3)}" style="stroke-width:1"/>`),
    st("checkpoint", cradleBack() + part("cart", cartridge(cartPlan, CART.z, CART.h) + labelPlate(cartPlan, CART.z) + part("label", L(labelLines(cartPlan, CART.z), { tone: "lo", free: true }))) + cradleFront() + hingeBlock(HASPS.cart) + part("hasp-cart", haspAt(HASPS.cart, 0))),
  ];

  const drawers = Array.from({ length: DRAWERS }, (_, index) => `<g clip-path="url(#${id}-d${index})" data-drawer-slot="${index}"><g data-drawer="${index}">${drawer(index)}</g></g>`).join("");
  const units = Array.from({ length: BLOCKS }, (_, index) => unit(index)).join("");
  const sliders = Array.from({ length: COLUMNS }, (_, index) => `<g data-slider="${index}">${slider(index)}</g>`).join("");
  const front = [
    st(
      "tokenizer",
      spoolBack() +
        reel() +
        tape() +
        `<path data-part="tape" class="iso-line" data-tone="lo" data-free="" d="${tapeMarks(0)}"/>` +
        spoolFront() +
        tokenizer() +
        transfer(SET_X, EXIT.y) +
        part("tok-copy", typeCase(TOK_CASE, TOK.h) + `<g class="iso-dots" data-tone="hi">${sortsOf(TOK_CASE, TOK.h + 3).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.75"/>`).join("")}</g>` + hingeBlock(HASPS.tok) + part("hasp-tok", haspAt(HASPS.tok, 0))) +
        part("cutter", cutter()) +
        counter(TOK.x + 4, TOK.y + TOK.d, 13, "cin"),
    ),
    st("embedding", cabinet() + part("drawers", drawers)),
    st("stack", stackBase() + units + stackFront()),
    st("checkpoint", part("stk-copy", cartridge(STK_CART, TOP_Z + 3, STK_CART.h) + hingeBlock(HASPS.stk) + part("hasp-stk", haspAt(HASPS.stk, 0)))),
    st("logits", logitsBoard() + part("sliders", sliders)),
    st("sampler", wheel() + `<path data-part="pockets" class="iso-line" data-tone="lo" d=""/>` + part("ball", "") + hub() + casterBody() + transfer(CASTER_X, OUTLET.y) + counter(CAST.x + 5, CAST.y + CAST.d, 13, "cout")),
  ];

  const slugs = [...PROMPT_TOKENS, ...OUTPUT_TOKENS].map((token, index) => `<g data-slug="${index}" style="display:none">${slugSvg(token.id)}</g>`).join("");
  const line = [
    lineBed(),
    `<path data-part="belt" class="iso-line" data-tone="faint" d="${beltRibs(0)}"/>`,
    `<g clip-path="url(#${id}-exit)">${part("exit-slugs", "")}</g>`,
    `<g clip-path="url(#${id}-outlet)">${part("outlet-slugs", "")}</g>`,
    part("slugs", slugs),
    lineFront(),
  ];

  return [defs, bench(), part("back", back.join("")), part("front", front.join("")), part("line", line.join(""))].join("");
}

// Functions the page runs too.
export const PAGE = { selectedAt, slotsAt, needleAt, tapeMarks, beltRibs, pocketLines, slugSvg, haspAt };
