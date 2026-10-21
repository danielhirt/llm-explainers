// Fig: one pre-training step as a grading bench. Two tapes lie on rails at the front: the input
// text, and the same text shifted one slot left, so each input slug sits beside the token that
// follows it. Behind each pair, a dial gauge reads the probability the model gave that target, and
// a column rises out of a collar to −log p. A summing beam rides between two posts at the mean of
// the six columns, and the loss dial on the right post reads it. A return wire carries the error
// back to the model cabinet, and the trim screws on its lid (the weights) each turn a little.
import * as k from "../../kit/iso-kit.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { TOKENS, INPUTS, TARGETS, POSITIONS, SCREWS, TURN_PER_STEP, RATE, P_START, lossOf, meanOf, probsAt, stepOf, screwAngle } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 372;
const AZIMUTH = 56;

const PITCH = 34; // one token slot
const slotX = (slot) => slot * PITCH;
const POS_X = Array.from({ length: POSITIONS }, (_, index) => slotX(index + 1));
const K = 12; // world units per nat of loss

const BASE = { x: -36, y: -90, w: 316, d: 166, r: 8 };
const BASE_H = 10;
const FOOT_H = 5;

// The model cabinet at the back, with its weights as trim screws on the lid.
const CAB = { x: -14, y: -80, w: 254, d: 30, r: 2 };
const CAB_H = 15;
const LID = { x: -16, y: -82, w: 258, d: 34, r: 3 };
const LID_TOP = 18.5;
const SCREW_X = [14, 62, 110, 158, 206];
const SCREW_Y = [-72, -58];
const SCREW_AT = SCREW_Y.flatMap((y) => SCREW_X.map((x) => [x, y]));
const SCREW_R = 4.2;
const SCREW_TOP = LID_TOP + 2.2;
const WASHER_R = 5.6;

// The return wire: from the back of the dial post, over the lid, between the screw rows.
const WIRE_Y = -65;
const WIRE_R = 0.8;
const WIRE_Z = LID_TOP + WIRE_R;
const TERM = { x: -12, y: WIRE_Y - 4.5, w: 9, d: 9, r: 1 };

// The posts and the summing beam. Zero loss is the top of the column collars.
const Z0 = 8;
const POST_L = { x: 4, y: -24, w: 8, d: 8, r: 1 };
const POST_L_H = Z0 + 3 * K + 4;
const POST_R = { x: 224, y: -24, w: 8, d: 8, r: 1 };
const POST_R_H = 34;
const BEAM = { x: POST_L.x + POST_L.w, y: -22, w: POST_R.x - POST_L.x - POST_L.w, d: 4, r: 0.6 };
const BEAM_T = 3.2;
const DIAL = { x: POST_R.x + POST_R.w / 2, y: POST_R.y + POST_R.d / 2, r: 11, z: [POST_R_H, POST_R_H + 4.4] };
const DIAL_MAX = 2; // nats across the loss dial
const SWEEP = (270 * Math.PI) / 180;
const toViewer = Math.atan2(Math.cos((AZIMUTH * Math.PI) / 180), -Math.sin((AZIMUTH * Math.PI) / 180)); // dial angle that points at the viewer
const SWEEP_FROM = toViewer + Math.PI / 4;

// The grading bar: a gauge (p) and a column (−log p) for each position.
const BAR = { x: 16, y: -14, w: 206, d: 29, r: 2.5 };
const BAR_TOP = 5;
const ROD_Y = -8;
const ROD_R = 1.9;
const COLLAR_R = 3.2;
const GAUGE_Y = 5;
const GAUGE_R = 8.5;
const GAUGE_TOP = BAR_TOP + 3.5;

// The tapes.
const RAIL_T = { x: -20, y: 22, w: 278, d: 12, r: 1.5 };
const RAIL_I = { x: -20, y: 40, w: 278, d: 12, r: 1.5 };
const RAIL_H = 3;
const SLUG_TOP = RAIL_H + 5;
const STRIP = { x: -16, y: 55, w: 272, d: 5, r: 1 };
const LABEL = { x: 222, y: 63.5, w: 34, d: 8, r: 1.2 };

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...k.boxCorners(LID, LID_TOP, LID_TOP + 4),
    [POST_L.x, POST_L.y, POST_L_H],
    [POST_L.x + POST_L.w, POST_L.y + POST_L.d, POST_L_H],
    [DIAL.x + DIAL.r, DIAL.y, DIAL.z[1]],
    [DIAL.x, DIAL.y - DIAL.r, DIAL.z[1]],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: AZIMUTH },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- shared with the page -------------------------------------------------------------------

// A face-up dial needle at a value 0..1 of its sweep. Its tail and tip stop on the face.
function needleAt(cx, cy, r, z, share) {
  const angle = SWEEP_FROM + Math.max(0, Math.min(1, share)) * SWEEP;
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return k.lineOnTop([cx - sx * 2.2, cy - sy * 2.2], [cx + sx * (r - 3), cy + sy * (r - 3)], z + 0.15, P);
}

// One loss column at a height in nats.
function columnSvg(index, nats) {
  if (!(nats > 0.004)) return "";
  return k.solidSvg(k.cylinder(POS_X[index], ROD_Y, ROD_R, Z0, nats * K, P, 20, 0.3), { tone: "hi", crease: "lo" });
}

// A screw slot as a closed slot outline, turned by an angle in degrees.
function slotAt(index, degrees) {
  const [cx, cy] = SCREW_AT[index];
  const angle = (degrees * Math.PI) / 180;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const half = SCREW_R - 0.9;
  const w = 0.5;
  const corners = [
    [cx + ux * half - uy * w, cy + uy * half + ux * w],
    [cx - ux * half - uy * w, cy - uy * half + ux * w],
    [cx - ux * half + uy * w, cy - uy * half - ux * w],
    [cx + ux * half + uy * w, cy + uy * half - ux * w],
  ];
  return k.onTop(corners, SCREW_TOP, P, true);
}

// ---- static parts ---------------------------------------------------------------------------

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 22))) out.push(S(k.cylinder(x, y, 6, -BASE_H - FOOT_H, FOOT_H, P, 28, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

function cabinet() {
  const out = [];
  const front = CAB.y + CAB.d;
  const onFront = (points) => k.pathOf(points.map(([x, z]) => at([x, front, z])), true);
  const seams = [80, 160].map((x) => k.segment([x, front, 0], [x, front, CAB_H], P)).join("");
  // Vent slots in the left panel: closed outlines, so they have no ends.
  const vents = Array.from({ length: 8 }, (_, index) => {
    const x = 10 + index * 7;
    return onFront([[x, 5], [x + 2.4, 5], [x + 2.4, 11.5], [x, 11.5]]);
  }).join("");
  const screwsOn = [6, 74, 86, 154, 166, 234].flatMap((x) => [[x, 3.2], [x, CAB_H - 2.6]]).map(([x, z]) => at([x, front, z]));
  out.push(S(k.slabOf(CAB, 0, CAB_H, P, 4, 0), { tone: "mid", inner: L(k.sideSeam(CAB, 1.6, P, 4) + seams, { tone: "faint" }) + L(vents, { tone: "lo" }) }));
  out.push(D(screwsOn, { size: 0.45 }));
  // Label plate on the middle panel: three rule lines stand for printed text.
  const plateAt = { x: 104, z: 4.5, w: 32, h: 7.5 };
  out.push(S(k.extrude([[plateAt.x, front], [plateAt.x + plateAt.w, front], [plateAt.x + plateAt.w, front + 0.6], [plateAt.x, front + 0.6]], plateAt.z, plateAt.h, P), { tone: "mid" }));
  out.push(L([[2, 22], [4, 15], [6, 19]].map(([dz, w]) => k.segment([plateAt.x + 3, front + 0.6, plateAt.z + plateAt.h - dz], [plateAt.x + 3 + w, front + 0.6, plateAt.z + plateAt.h - dz], P)).join(""), { tone: "lo", free: true }));
  out.push(S(k.slabOf(LID, CAB_H, LID_TOP - CAB_H, P, 6, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(LID, 3.4), LID_TOP, P, 6), { tone: "faint" }));
  out.push(D([[LID.x + 6, LID.y + 6], [LID.x + LID.w - 6, LID.y + 6], [LID.x + 6, LID.y + LID.d - 6], [LID.x + LID.w - 6, LID.y + LID.d - 6]].map(([x, y]) => at([x, y, LID_TOP])), { size: 0.45 }));
  return out.join("");
}

// One screw head with its washer ring and the two zero marks it started on.
function screw(index) {
  const [x, y] = SCREW_AT[index];
  const marks = [0, Math.PI].map((angle) => k.lineOnTop([x + Math.cos(angle) * WASHER_R, y + Math.sin(angle) * WASHER_R], [x + Math.cos(angle) * (WASHER_R + 1.6), y + Math.sin(angle) * (WASHER_R + 1.6)], LID_TOP, P)).join("");
  return (
    L(k.ring(x, y, WASHER_R, LID_TOP, P, 40) + marks, { tone: "lo" }) +
    S(k.cylinder(x, y, SCREW_R, LID_TOP, SCREW_TOP - LID_TOP, P, 28, 0.35), { tone: "hi", crease: "lo" }) +
    `<path class="iso-line" data-tone="mid" data-part="slot" data-index="${index}" d="${slotAt(index, 0)}"/>`
  );
}

// The wire's route, as world points with one rounded corner.
const WIRE_POINTS = (() => {
  const x = DIAL.x;
  const r = 5;
  const points = [[x, POST_R.y, WIRE_Z]];
  for (let step = 0; step <= 8; step++) {
    const t = (-Math.PI / 2) * (step / 8);
    points.push([x - r + r * Math.cos(t), WIRE_Y + r + r * Math.sin(t), WIRE_Z]);
  }
  points.push([TERM.x + TERM.w, WIRE_Y, WIRE_Z]);
  return points;
})();

function wire(id) {
  const d = k.pathOf(WIRE_POINTS.map(at));
  const pieces = tubePieces(WIRE_POINTS, WIRE_R, P, { maxLength: 400 });
  return (
    S(k.slabOf(TERM, LID_TOP, 3.6, P, 2, 0.3), { tone: "mid" }) +
    D([at([TERM.x + TERM.w / 2, TERM.y + TERM.d / 2, LID_TOP + 3.6])], { size: 0.5 }) +
    pieces.map((piece) => tubeSvg(piece, { tone: "hi" })).join("") +
    `<path class="iso-line pt-pulse" data-tone="hi" data-part="pulse" id="${id}-pulse" d="${d}"/>`
  );
}

function postLeft() {
  const out = [S(k.slabOf(POST_L, 0, POST_L_H, P, 3, 0.4), { tone: "mid" })];
  // A loss scale on the front face: a minor tick every 0.25 nat, a major every nat, the zero in hi.
  const face = POST_L.y + POST_L.d;
  const root = POST_L.x + 0.25;
  const minor = [];
  const major = [];
  for (let q = 1; q <= 12; q++) {
    const z = Z0 + (q / 4) * K;
    (q % 4 === 0 ? major : minor).push(k.segment([root, face, z], [root + (q % 4 === 0 ? 4.4 : 2.4), face, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }), L(k.segment([root, face, Z0], [root + 4.4, face, Z0], P), { tone: "hi" }));
  out.push(D([at([POST_L.x + POST_L.w / 2, POST_L.y + POST_L.d / 2, POST_L_H])], { size: 0.5 }));
  return out.join("");
}

// The summing beam, built at zero loss and lifted by the mean.
function beam() {
  const z = Z0 - BEAM_T / 2;
  const front = BEAM.y + BEAM.d;
  const mean = k.segment([BEAM.x, front, Z0], [BEAM.x + BEAM.w, front, Z0], P);
  return (
    `<path class="iso-halo" d="${k.haloOf(k.insetPlan(BEAM, 0.5), z, 0.1, P)}" style="filter:blur(3px);opacity:.18"/>` +
    S(k.slabOf(BEAM, z, BEAM_T, P, 2, 0.3), { tone: "hi", lit: true, inner: L(mean, { tone: "mid" }) }) +
    D([BEAM.x + 3, BEAM.x + BEAM.w - 3].map((x) => at([x, BEAM.y + BEAM.d / 2, z + BEAM_T])), { size: 0.45, tone: "hi" })
  );
}

function postRight() {
  // The guide slot the beam's right end rides in, as a closed outline on the front face.
  const face = POST_R.y + POST_R.d;
  const cx = POST_R.x + POST_R.w / 2;
  const slot = k.pathOf([[cx - 1, 5], [cx + 1, 5], [cx + 1, POST_R_H - 4], [cx - 1, POST_R_H - 4]].map(([x, z]) => at([x, face, z])), true);
  const out = [S(k.slabOf(POST_R, 0, POST_R_H, P, 3, 0.4), { tone: "mid", inner: L(slot, { tone: "lo" }) })];
  const { x, y, r } = DIAL;
  const top = DIAL.z[1];
  out.push(S(k.cylinder(x, y, r, DIAL.z[0], top - DIAL.z[0], P, 64, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, r, top - 2.2, top, 72, P, 0.3), { tone: "lo" }), L(k.sideArc(x, y, r, top - 2.2, P, 48), { tone: "faint" }));
  out.push(L(k.ring(x, y, r - 1.8, top, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(x, y, r - 1.8, 20, 5, top, [1.2, 2.4], P, SWEEP_FROM, SWEEP);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.3, top, P, 16), { tone: "mid" }));
  return out.join("");
}

function bar() {
  const out = [S(k.slabOf(BAR, 0, BAR_TOP, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BAR, 1.6, P, 4), { tone: "faint" }) })];
  out.push(D([[BAR.x + 4, BAR.y + 4], [BAR.x + 4, BAR.y + BAR.d - 4], [BAR.x + BAR.w - 4, BAR.y + 4], [BAR.x + BAR.w - 4, BAR.y + BAR.d - 4]].map(([x, y]) => at([x, y, BAR_TOP])), { size: 0.45 }));
  return out.join("");
}

function collar(index) {
  const x = POS_X[index];
  return S(k.cylinder(x, ROD_Y, COLLAR_R, BAR_TOP, Z0 - BAR_TOP, P, 24, 0.4), { tone: "mid" }) + L(k.ring(x, ROD_Y, ROD_R + 0.5, Z0, P, 20), { tone: "faint" });
}

function gauge(index) {
  const x = POS_X[index];
  const out = [S(k.cylinder(x, GAUGE_Y, GAUGE_R, BAR_TOP, GAUGE_TOP - BAR_TOP, P, 48, 0.5), { tone: "hi", crease: "lo" })];
  out.push(L(k.ring(x, GAUGE_Y, GAUGE_R - 1.4, GAUGE_TOP, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(x, GAUGE_Y, GAUGE_R - 1.4, 10, 5, GAUGE_TOP, [1, 1.9], P, SWEEP_FROM, SWEEP);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, GAUGE_Y, 1, GAUGE_TOP, P, 14), { tone: "mid" }));
  return out.join("");
}

function rail(plan) {
  const out = [S(k.slabOf(plan, 0, RAIL_H, P, 3, 0.4), { tone: "mid" })];
  out.push(D([plan.x + 3, plan.x + plan.w - 3].map((x) => at([x, plan.y + plan.d / 2, RAIL_H])), { size: 0.45 }));
  return out.join("");
}

function slug(slot, token, plan, extra = "") {
  const x = slotX(slot);
  const body = { x: x - 15, y: plan.y + 0.5, w: 30, d: plan.d - 1, r: 1 };
  const text = k.faceTextSvg(k.topMatrix([x, body.y + body.d / 2 + 2.1], SLUG_TOP, P, "x"), token, { size: 6, tone: "hi", anchor: "middle" });
  return `<g data-slot="${slot}"${extra}>${S(k.slabOf(body, RAIL_H, SLUG_TOP - RAIL_H, P, 2, 0.3), { tone: "hi", crease: "lo" })}${text}</g>`;
}

function front() {
  const out = [S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" })];
  const ticks = k.topTicks(0, slotX(7), PITCH / 2, 2, STRIP.y + 0.01, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(S(k.slabOf(LABEL, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[2.2, 20], [4.2, 14], [6, 17]].map(([dy, w]) => k.lineOnTop([LABEL.x + 4, LABEL.y + dy], [LABEL.x + 4 + w, LABEL.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([LABEL.x + 2, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 2, LABEL.y + LABEL.d / 2, 0.8])], { size: 0.42 }));
  return out.join("");
}

export function build({ fig = "Fig 1", id = "pretrain" } = {}) {
  const backRow = SCREW_AT.map((_, index) => index).filter((index) => SCREW_AT[index][1] < WIRE_Y);
  const frontRow = SCREW_AT.map((_, index) => index).filter((index) => SCREW_AT[index][1] > WIRE_Y);
  const order = (list) => [...list].sort((a, b) => k.depthOf([...SCREW_AT[a], 0], P) - k.depthOf([...SCREW_AT[b], 0], P));
  const targets = TOKENS.map((token, index) => slug(index + 1, token, RAIL_T)).join("");
  const inputs = TOKENS.map((token, index) => slug(index + 1, token, RAIL_I)).join("");

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A grading bench for one training step. An input tape and a target tape lie on two rails at the front. The target tape holds the same text, moved one slot left, so each input token sits beside the next token. Behind each pair, a dial gauge reads the probability that the model gives the target. A column behind the gauge rises to minus log p. A summing beam rides at the mean height of the six columns, and the loss dial reads that mean. A wire runs from the loss dial back to the model cabinet. Ten trim screws on the cabinet lid stand for the weights.",
    body: [
      base(),
      cabinet(),
      order(backRow).map(screw).join(""),
      wire(id),
      order(frontRow).map(screw).join(""),
      postLeft(),
      `<g data-part="beam">${beam()}</g>`,
      postRight(),
      `<path class="iso-line" data-tone="lit" data-free="" data-part="loss-needle" d="${needleAt(DIAL.x, DIAL.y, DIAL.r, DIAL.z[1], 0)}" style="stroke-width:1.1"/>`,
      bar(),
      POS_X.map((_, index) => `${collar(index)}<g data-part="column" data-index="${index}"></g>`).join(""),
      POS_X.map((x, index) => `${gauge(index)}<path class="iso-line" data-tone="hi" data-free="" data-part="needle" data-index="${index}" d="${needleAt(x, GAUGE_Y, GAUGE_R, GAUGE_TOP, 0)}" style="stroke-width:.9"/>`).join(""),
      rail(RAIL_T),
      `<g data-part="targets">${targets}</g>`,
      rail(RAIL_I),
      `<g data-part="inputs">${inputs}</g>`,
      front(),
    ],
  });

  const stage = stageHtml({
    svg,
    label: "Grading bench. Press Space or Enter to run one training step. Press R to reset.",
    role: "slider",
    attrs: `aria-valuemin="0" aria-valuemax="99" aria-valuenow="0" aria-valuetext="Step 0. The bench is reset."`,
  });

  const cells = INPUTS.map((input, index) => `<div><dt>${input} → ${TARGETS[index]}</dt><dd><span data-out="p" data-index="${index}">p –</span><span data-out="loss" data-index="${index}">−log p –</span></dd></div>`).join("");
  const controls = `<div class="fig-controls"><button class="btn btn-primary" type="button" data-act="step">Step</button><button class="btn" type="button" data-act="reset">Reset</button></div>
<dl class="fig-meter pt-meter">${cells}</dl><p class="sr-only" aria-live="polite" data-out="live"></p>`;

  const html = plate({
    id,
    fig,
    title: "One training step",
    hint: "Press Step",
    readout: "step 0 · ready",
    keys: [
      { mark: "raised", label: "Gauge and column at each position: p and −log p" },
      { mark: "lit", label: "Summing beam and loss dial: the batch loss, the mean of the columns" },
      { mark: "dashed", label: "Return wire: carries the error back to the weights" },
      { mark: "flat", label: "Trim screws: the weights. Each step turns them a little." },
    ],
    caption:
      "The bench runs one optimizer step at toy scale. The targets come from the text itself. The target at each position is the next token. The model scores all six positions at once, under the causal mask. The loss at each position is −log p. The batch loss is the mean of the six losses. Backpropagation finds the gradient for every weight. AdamW then makes a small update, so the next loss is a little lower. The probabilities are illustrative. Production runs use many sequences and many layers.",
    stage,
    controls,
  });

  const script = `
const P = ${JSON.stringify(P)};
const POS_X = ${JSON.stringify(POS_X)}, SCREW_AT = ${JSON.stringify(SCREW_AT)}, SCREWS = ${JSON.stringify(SCREWS)};
const K = ${K}, Z0 = ${Z0}, ROD_Y = ${ROD_Y}, ROD_R = ${ROD_R}, PITCH = ${PITCH};
const SCREW_R = ${SCREW_R}, SCREW_TOP = ${SCREW_TOP}, GAUGE_Y = ${GAUGE_Y}, GAUGE_R = ${GAUGE_R}, GAUGE_TOP = ${GAUGE_TOP};
const DIAL = ${JSON.stringify(DIAL)}, DIAL_MAX = ${DIAL_MAX}, SWEEP = ${SWEEP}, SWEEP_FROM = ${SWEEP_FROM};
const P_START = ${JSON.stringify(P_START)}, RATE = ${RATE}, TURN_PER_STEP = ${TURN_PER_STEP};
const lossOf = ${lossOf.toString()};
const meanOf = ${meanOf.toString()};
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (score) => 1 / (1 + Math.exp(-score));
${probsAt.toString()}
${stepOf.toString()}
const screwAngle = ${screwAngle.toString()};
${needleAt.toString()}
${columnSvg.toString()}
${slotAt.toString()}

const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => [...svg.querySelectorAll('[data-part="' + name + '"]')];
const needles = part("needle");
const columns = part("column");
const slots = [...svg.querySelectorAll('[data-part="slot"]')].sort((a, b) => a.dataset.index - b.dataset.index);
const beamNode = part("beam")[0];
const lossNeedle = part("loss-needle")[0];
const targets = part("targets")[0];
const inputs = part("inputs")[0];
const pulse = part("pulse")[0];
const pulseLength = pulse.getTotalLength();
const PULSE = 16;
pulse.style.strokeDasharray = PULSE + " " + (pulseLength + PULSE * 2);
const say = readoutOf(root);
const out = (name) => root.querySelector('[data-out="' + name + '"]');
const pOut = [...root.querySelectorAll('[data-out="p"]')];
const lossOut = [...root.querySelectorAll('[data-out="loss"]')];
const live = out("live");
const buttons = { step: root.querySelector('[data-act="step"]'), reset: root.querySelector('[data-act="reset"]') };

const N = POS_X.length;
const show = { shift: 0, p: Array(N).fill(0), h: Array(N).fill(0), turn: SCREWS.map(() => 0), pulse: -1 };
let done = 0, run = null, queued = false;
let touring = !STILL.matches, tourWait = 1.4, idleTimer = 0;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function meter(probs, losses) {
  pOut.forEach((node, index) => { node.textContent = probs ? "p " + probs[index].toFixed(2) : "p –"; });
  lossOut.forEach((node, index) => { node.textContent = losses ? "−log p " + losses[index].toFixed(2) : "−log p –"; });
}
function stateText() {
  return done ? "Step " + done + " is complete. The batch loss is " + stepOf(done).mean.toFixed(2) + "." : "Step 0. The bench is reset.";
}
function describe(announce) {
  const text = stateText();
  stage.setAttribute("aria-valuenow", String(done));
  stage.setAttribute("aria-valuetext", text);
  if (announce) live.textContent = text;
}

function startStep() {
  const n = done + 1;
  const m = stepOf(n);
  const from = { shift: show.shift, p: show.p.slice(), h: show.h.slice(), turn: show.turn.slice() };
  const plan = [];
  if (from.shift < 1) plan.push({ name: "shift targets", move: 0.9, hold: 0.25, set: (e) => { show.shift = from.shift + (1 - from.shift) * e; } });
  plan.push({ name: "forward", move: 0.8, hold: 0.25, set: (e) => { show.p = from.p.map((v, i) => v + (m.probs[i] - v) * e); }, end: () => meter(m.probs, null) });
  plan.push({ name: "loss", move: 1.1, hold: 0.35, set: (e) => { show.h = from.h.map((v, i) => v + (m.losses[i] - v) * e); }, end: () => meter(m.probs, m.losses) });
  plan.push({ name: "backward", move: 1.3, hold: 0.15, linear: true, set: (e) => { show.pulse = e; }, end: () => { show.pulse = -1; } });
  plan.push({ name: "update", move: 0.8, hold: 0.1, set: (e) => { show.turn = from.turn.map((v, j) => v + (screwAngle(SCREWS[j], n) - v) * e); } });
  run = { kind: "step", n, m, plan, index: 0, t: 0, user: !touring };
  buttons.reset.disabled = false;
}

function startReset() {
  const from = { shift: show.shift, p: show.p.slice(), h: show.h.slice(), turn: show.turn.slice() };
  queued = false;
  run = { kind: "reset", n: 0, user: !touring, plan: [{ name: "reset", move: 0.9, hold: 0.1, set: (e) => {
    show.shift = from.shift * (1 - e);
    show.p = from.p.map((v) => v * (1 - e));
    show.h = from.h.map((v) => v * (1 - e));
    show.turn = from.turn.map((v) => v * (1 - e));
    show.pulse = -1;
  } }], index: 0, t: 0 };
  meter(null, null);
}

function finish() {
  done = run.kind === "step" ? run.n : 0;
  describe(run.user);
  run = null;
  if (queued) { queued = false; startStep(); }
}

// Advance the timeline. Under reduced motion every phase jumps to its end.
function advance(dt, calm) {
  if (!run) return;
  run.t += calm ? 1e9 : dt;
  while (run && run.index < run.plan.length) {
    const item = run.plan[run.index];
    const length = item.move + item.hold;
    if (run.t < item.move) {
      const share = run.t / item.move;
      item.set(item.linear ? share : ease(share));
      return;
    }
    if (!item.ended) {
      item.set(1);
      if (item.end) item.end();
      item.ended = true;
    }
    if (run.t < length) return;
    run.t -= length;
    run.index++;
  }
  if (run && run.index >= run.plan.length) finish();
}

let lastColumns = Array(N).fill(-1), lastTurns = SCREWS.map(() => null);
function draw() {
  targets.setAttribute("transform", translateAlong(P, [-PITCH * show.shift, 0, 0]));
  const shifted = show.shift > 0.5;
  targets.querySelector('[data-slot="1"]').toggleAttribute("data-unused", shifted);
  inputs.querySelector('[data-slot="7"]').toggleAttribute("data-unused", shifted);
  needles.forEach((node, i) => node.setAttribute("d", needleAt(POS_X[i], GAUGE_Y, GAUGE_R, GAUGE_TOP, show.p[i])));
  columns.forEach((node, i) => {
    const h = Math.round(show.h[i] * 1000) / 1000;
    if (h !== lastColumns[i]) { lastColumns[i] = h; node.innerHTML = columnSvg(i, h); }
  });
  const mean = meanOf(show.h);
  beamNode.setAttribute("transform", translateAlong(P, [0, 0, mean * K]));
  lossNeedle.setAttribute("d", needleAt(DIAL.x, DIAL.y, DIAL.r, DIAL.z[1], mean / DIAL_MAX));
  slots.forEach((node, j) => {
    const a = Math.round(show.turn[j] * 20) / 20;
    if (a !== lastTurns[j]) { lastTurns[j] = a; node.setAttribute("d", slotAt(j, a)); }
  });
  if (show.pulse < 0) pulse.style.opacity = "0";
  else {
    pulse.style.opacity = String(smooth(0, 0.08, show.pulse) * (1 - smooth(0.9, 1, show.pulse)));
    pulse.style.strokeDashoffset = String(PULSE - show.pulse * (pulseLength + PULSE));
  }
  let text;
  if (run && run.kind === "reset") text = "reset";
  else if (run) {
    const name = run.plan[Math.min(run.index, run.plan.length - 1)].name;
    text = "step " + run.n + " · " + (name === "loss" ? "loss " + mean.toFixed(2) : name);
  } else text = done ? "step " + done + " · loss " + stepOf(done).mean.toFixed(2) : "step 0 · ready";
  say(text);
}

const loop = figureLoop(stage, (dt, calm) => {
  if (touring && !run) {
    tourWait -= dt;
    if (tourWait <= 0) {
      if (done < 3) { startStep(); tourWait = 1.6; }
      else { startReset(); tourWait = 1.4; }
    }
  }
  advance(dt, calm);
  draw();
  return touring || !!run;
});

function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !STILL.matches; tourWait = 1.4; loop.kick(); }, 6000);
}
function step() {
  takeOver();
  if (run && run.kind === "step") queued = true;
  else if (run) queued = true;
  else startStep();
  loop.kick();
}
function reset() {
  takeOver();
  startReset();
  loop.kick();
}
buttons.step.addEventListener("click", step);
buttons.reset.addEventListener("click", reset);
stage.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight" || event.key === "ArrowUp") step();
  else if (event.key === "r" || event.key === "R" || event.key === "Home") reset();
  else return;
  event.preventDefault();
});
stage.addEventListener("pointerdown", () => takeOver());
stage.addEventListener("focus", () => { live.textContent = stateText(); });
if (STILL.matches) touring = false;
meter(null, null);
draw();
`;

  const css = `
[data-fig="${id}"] .pt-pulse{stroke-width:1.7;vector-effect:none;opacity:0;stroke-linecap:round}
[data-fig="${id}"] [data-unused] .iso-edge{stroke:var(--anatomy-mid)}
[data-fig="${id}"] [data-unused] .iso-face-text{fill:var(--anatomy-lo)}
[data-fig="${id}"] .pt-meter{grid-template-columns:repeat(auto-fit,minmax(128px,1fr))}
[data-fig="${id}"] .pt-meter dt{text-transform:none;letter-spacing:.02em;font-size:11px}
[data-fig="${id}"] .pt-meter dd{display:grid;gap:1px;font-size:13px}
`;
  return { html, css, script, needs: [] };
}
