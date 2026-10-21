// Fig: which message costs more, as an equal-arm beam balance. Every token of a message is one slug,
// and every slug weighs the same. The reader picks A or B. Then the slugs of A drop onto the left pan
// and the slugs of B onto the right pan, one pair at a time. The beam tips toward the pan with more
// tokens, the pointer reads the difference on the scale, and the counter under each pan shows its
// tokens. The page trains the site's teaching tokenizer and counts the tokens itself.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { trainTokenizer, tokenizerSource } from "../_shared/toy-tokenizer.mjs";
import { ROUNDS, SENDS_PER_MONTH, RATE, SENSITIVITY, STOP, monthlyCost, heavierOf, tiltOf } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 400;

// World units are about 1 px. x runs along the beam, y toward the viewer, z up. The base top is z = 0.
const L = 110; // pivot to the end knife on each side
const ZK = 108; // the knife line: the pivot and both end knives
const BASE = { x: -150, y: -46, w: 300, d: 92, r: 8 };
const BASE_H = 12;
const FOOT_H = 5;

// Pans, built at rest. A pan is a plate on two drop rods under a yoke, and the yoke hangs from a
// stirrup that rides the end knife.
const PAN = { w: 47, d: 36, h: 1.8 };
const ZP = 40; // pan underside
const ZY = ZP + 34; // yoke underside
const YOKE_H = 2.6;
const ROD_X = PAN.w / 2 + 1.7; // drop rods, from the pan centre
const SLUG = { s: 4.6, h: 3.2, pitch: 5.5, cols: 8, rows: 6 };
const SLOTS = SLUG.cols * SLUG.rows;
const DROP = 22; // a slug falls this far onto the pan
const STIR = { half: 3.5, cheek: 1.4, inner: 4.2, top: 2.2, bar: 2.6, low: 16 };

// The beam's parts in its own plane: x' along the beam, z' up from the knife line. They turn about the pivot.
const ARM_R = [[7, -8.4], [L + 2.5, -4.4], [L + 2.5, -1.2], [7, 1.4]];
const ARM_L = ARM_R.map(([x, z]) => [-x, z]);
const BOSS = [[-7, -9], [7, -9], [7, 6.2], [5.2, 8], [-5.2, 8], [-7, 6.2]];
const KNIFE = [[-1.7, 2.6], [1.7, 2.6], [0, 0]];
const COLLAR = [[-2.2, 8], [2.2, 8], [2.2, 11.2], [-2.2, 11.2]];
const NEEDLE = [[-1, 11.2], [1, 11.2], [0.3, 60.6], [-0.3, 60.6]];

// The scale over the beam: a plate whose top edge is an arc round the pivot.
const SCALE = { r: 62, half: 14, low: 44, y: [-3.2, -1.8] };
const SCALE_A = Math.asin(SCALE.half / SCALE.r);
const SCALE_POLY = [
  [-SCALE.half, SCALE.low],
  [SCALE.half, SCALE.low],
  ...Array.from({ length: 33 }, (_, index) => {
    const a = SCALE_A - (2 * SCALE_A * index) / 32;
    return [SCALE.r * Math.sin(a), SCALE.r * Math.cos(a)];
  }),
];

const COUNTER = { w: 32, d: 22, h: 15 };

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    [0, SCALE.y[0], ZK + SCALE.r + 0.5],
    [-SCALE.half, SCALE.y[0], ZK + SCALE.r],
    [SCALE.half, SCALE.y[0], ZK + SCALE.r],
    [-L - STIR.half, -5.6, ZK + STIR.top],
    [L + STIR.half, -5.6, ZK + STIR.top],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 70 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const fix = (n) => Math.round(n * 100) / 100;

// The slot of slug j on a pan, from the pan centre: rows fill from the back, left to right.
const slotOf = (j) => [(j % SLUG.cols - (SLUG.cols - 1) / 2) * SLUG.pitch, (Math.floor(j / SLUG.cols) - (SLUG.rows - 1) / 2) * SLUG.pitch];

// The beam at a tilt, positive when pan B (right) goes down. Node draws the rest pose with it and the
// page draws every frame with it.
function beamParts(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const F = { o: [0, 0, ZK], a: [0, 1, 0], u: [c, 0, -s], v: [s, 0, c] };
  const on = (x, y, z) => k.iso([x * c + z * s, y, ZK - x * s + z * c], P);
  const beam =
    k.solidSvg(G.prismOf(F, ARM_L, -3, 3, P), { tone: "mid" }) +
    k.solidSvg(G.prismOf(F, BOSS, -3.6, 3.6, P), { tone: "mid" }) +
    k.dotsSvg([on(-4.2, 3.6, 3.4), on(4.2, 3.6, 3.4), on(-4.2, 3.6, -5.4), on(4.2, 3.6, -5.4)], { size: 0.45 }) +
    k.solidSvg(G.prismOf(F, ARM_R, -3, 3, P), { tone: "mid" });
  const knife = k.solidSvg(G.prismOf(F, KNIFE, 3.6, 6.7, P), { tone: "hi", crease: "lo" });
  const needle = k.solidSvg(G.prismOf(F, COLLAR, -1.6, 1.6, P), { tone: "mid" }) + k.solidSvg(G.prismOf(F, NEEDLE, -0.5, 0.5, P), { tone: "hi", lit: true });
  return { beam, knife, needle };
}

// Where each pan hangs at a tilt: the screen offset of its end knife from rest, left then right.
function hangOffsets(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [k.translateAlong(P, [L - L * c, 0, L * s]), k.translateAlong(P, [L * c - L, 0, -L * s])];
}

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(BASE, -BASE_H + 4, P, 8), { tone: "faint" }) }));
  out.push(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Label plate at the front right: three rule lines stand for printed text.
  const label = { x: 40, y: 28, w: 34, d: 11, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(Ln(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(Ln([[44, 31.4, 22], [44, 33.6, 15], [44, 35.8, 19]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 2.2, label.y + label.d / 2, 0.8])], { size: 0.42 }));
  // Round spirit level at the front left: the bubble sits in its ring when the base is level.
  const [lx, ly] = [-46, 33];
  out.push(S(k.cylinder(lx, ly, 5.2, 0, 2.4, P, 32, 0.4), { tone: "mid" }));
  out.push(Ln(k.ring(lx, ly, 3.4, 2.4, P, 32), { tone: "lo" }));
  out.push(Ln(k.ring(lx, ly, 1.2, 2.4, P, 20), { tone: "hi" }));
  return out.join("");
}

function counter(xc) {
  const plan = { x: xc - COUNTER.w / 2, y: -COUNTER.d / 2, w: COUNTER.w, d: COUNTER.d, r: 2 };
  const out = [S(k.slabOf(plan, 0, COUNTER.h, P, 6, 0.6), { tone: "mid", inner: Ln(k.sideSeam(plan, 2.6, P, 6), { tone: "faint" }) })];
  out.push(D([at([xc - 12, -7, COUNTER.h]), at([xc + 12, -7, COUNTER.h])], { size: 0.45 }));
  // The window on the front face, drawn in the face's own plane: two digit cells.
  const face = k.sideMatrix([xc, COUNTER.d / 2], COUNTER.h, P, "left");
  const rect = (x0, y0, x1, y1, r = 0) =>
    r
      ? `M${x0 + r} ${y0}H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + r}V${y1 - r}Q${x1} ${y1} ${x1 - r} ${y1}H${x0 + r}Q${x0} ${y1} ${x0} ${y1 - r}V${y0 + r}Q${x0} ${y0} ${x0 + r} ${y0}Z`
      : `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
  const side = xc < 0 ? 0 : 1;
  const digits = [-3.85, 3.85].map((x, index) => `<text class="iso-face-text" data-tone="hi" x="${x}" y="10.05" font-size="7.4" text-anchor="middle" data-count="${side}" data-digit="${index}">0</text>`).join("");
  out.push(`<g transform="${face}"><path class="iso-line" data-tone="lo" d="${rect(-8.4, 1.9, 8.4, 12.5, 1.2)}"/><path class="iso-line" data-tone="faint" d="${rect(-7.4, 2.9, -0.5, 11.5)}${rect(0.5, 2.9, 7.4, 11.5)}"/>${digits}</g>`);
  return out.join("");
}

function pillar() {
  const out = [];
  out.push(S(k.cylinder(0, 0, 12, 0, 3.6, P, 48, 0.6), { tone: "mid" }));
  out.push(D([45, 135, 225, 315].map((deg) => at([9 * Math.cos((deg * Math.PI) / 180), 9 * Math.sin((deg * Math.PI) / 180), 3.6])), { size: 0.45 }));
  out.push(S(k.cylinder(0, 0, 6.4, 3.6, 4, P, 32, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 4.6, 7.6, ZK - 18 - 7.6, P, 28), { tone: "mid", crease: "none", inner: Ln([34, 62].map((z) => k.sideArc(0, 0, 4.6, z, P, 16)).join(""), { tone: "faint" }) }));
  // The fork head: a cross piece with a short front prong and a tall back post that carries the scale.
  out.push(S(k.slabOf({ x: -4.6, y: -7.2, w: 9.2, d: 14.4, r: 1 }, ZK - 18, 4, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -3, y: -6.8, w: 6, d: 2.6, r: 0.5 }, ZK - 14, 71, P, 3, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -2.4, y: -4.2, w: 4.8, d: 1, r: 0.3 }, ZK + 46, 8, P, 2), { tone: "mid" }));
  // The scale: one tick for every 5 tokens of difference, a longer one for every 10, the zero in hi.
  const F = G.frameOf([0, 0, ZK], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const face = SCALE.y[1];
  const tick = (n, length) => {
    const a = tiltOf(n);
    const r0 = SCALE.r;
    const r1 = SCALE.r - length;
    return k.segment([r0 * Math.sin(a), face, ZK + r0 * Math.cos(a)], [r1 * Math.sin(a), face, ZK + r1 * Math.cos(a)], P);
  };
  const minor = [];
  const major = [];
  for (let n = -30; n <= 30; n += 5) {
    if (n === 0) continue;
    (n % 10 === 0 ? major : minor).push(tick(n, n % 10 === 0 ? 4 : 2.4));
  }
  const inner = Ln(minor.join(""), { tone: "lo" }) + Ln(major.join(""), { tone: "mid" }) + Ln(tick(0, 4.6), { tone: "hi" });
  out.push(S(G.prismOf(F, SCALE_POLY, SCALE.y[0], SCALE.y[1], P), { tone: "hi", crease: "lo", inner }));
  out.push(D([at([-9, face, ZK + 48]), at([9, face, ZK + 48])], { size: 0.45 }));
  return out.join("");
}

// The front prong and its agate plane, in front of the beam. The knife rests on the plane.
function prong() {
  return S(k.slabOf({ x: -3, y: 4.1, w: 6, d: 2.6, r: 0.5 }, ZK - 14, 12.8, P, 3, 0.3), { tone: "mid" }) + S(k.slabOf({ x: -2.6, y: 4.15, w: 5.2, d: 2.5, r: 0.3 }, ZK - 1.2, 1.2, P, 2), { tone: "hi", crease: "lo" });
}

// Behind the beam: the stirrup's back cheek.
function hangBack(xc) {
  return S(k.slabOf({ x: xc - STIR.half, y: -STIR.inner - STIR.cheek, w: STIR.half * 2, d: STIR.cheek, r: 0.3 }, ZK - STIR.low, STIR.low, P, 2), { tone: "mid" });
}

const SLUG_SVG = S(k.slabOf({ x: -SLUG.s / 2, y: -SLUG.s / 2, w: SLUG.s, d: SLUG.s, r: 0.5 }, 0, SLUG.h, P, 2, 0.3), { tone: "hi", crease: "lo" });

// In front of the beam: the pan and its slugs, the yoke, the rods and the rest of the stirrup.
function hangFront(side) {
  const xc = side ? L : -L;
  const out = [];
  const lug = (sign) => {
    const x = sign < 0 ? xc - PAN.w / 2 - 3.4 : xc + PAN.w / 2;
    return S(k.slabOf({ x, y: -1.6, w: 3.4, d: 3.2, r: 0.6 }, ZP, 3, P, 2, 0.2), { tone: "mid" });
  };
  const rod = (sign) => S(k.cylinder(xc + sign * ROD_X, 0, 0.9, ZP + 3, ZY - ZP - 3, P, 14), { tone: "mid", crease: "none" });
  out.push(lug(-1), rod(-1));
  const pan = { x: xc - PAN.w / 2, y: -PAN.d / 2, w: PAN.w, d: PAN.d, r: 3 };
  out.push(S(k.slabOf(pan, ZP, PAN.h, P, 4, 0.6), { tone: "mid" }));
  out.push(Ln(k.planOutline(k.insetPlan(pan, 1), ZP + PAN.h, P, 4), { tone: "faint" }));
  out.push(`<g data-part="slugs-${side}"></g>`);
  out.push(lug(1), rod(1));
  out.push(S(k.slabOf({ x: xc - ROD_X - 1.8, y: -1.4, w: ROD_X * 2 + 3.6, d: 2.8, r: 0.8 }, ZY, YOKE_H, P, 3, 0.3), { tone: "mid" }));
  out.push(D([at([xc - ROD_X, 0, ZY + YOKE_H]), at([xc + ROD_X, 0, ZY + YOKE_H])], { size: 0.42 }));
  out.push(S(k.cylinder(xc, 0, 2, ZY + YOKE_H, 1.6, P, 18, 0.2), { tone: "mid" }));
  out.push(S(k.cylinder(xc, 0, 1.1, ZY + YOKE_H + 1.6, ZK - STIR.low - ZY - YOKE_H - 1.6, P, 14), { tone: "mid", crease: "none" }));
  out.push(S(k.slabOf({ x: xc - STIR.half, y: -STIR.inner, w: STIR.half * 2, d: STIR.inner * 2 + STIR.cheek, r: 0.5 }, ZK - STIR.low, STIR.bar, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: xc - STIR.half, y: STIR.inner, w: STIR.half * 2, d: STIR.cheek, r: 0.3 }, ZK - STIR.low + STIR.bar, STIR.low - STIR.bar, P, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: xc - STIR.half, y: -STIR.inner - STIR.cheek, w: STIR.half * 2, d: (STIR.inner + STIR.cheek) * 2, r: 0.5 }, ZK, STIR.top, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([xc, 0, ZK + STIR.top])], { size: 0.45 }));
  return out.join("");
}

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function build({ fig = "Fig 1", id = "balance" } = {}) {
  // Every round must fit its pans.
  const tokenizer = trainTokenizer();
  for (const round of ROUNDS) {
    for (const text of [round.a, round.b]) if (tokenizer.encode(text).length > SLOTS) throw new Error(`"${text}" has more tokens than a pan has slots`);
  }

  const rest = beamParts(0);
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "An equal-arm beam balance on a base plate. A pillar holds the beam on a knife edge. A pan hangs from each end of the beam: pan A on the left and pan B on the right. Each token of a message is one slug, and all slugs weigh the same. A pointer over the beam reads the difference on a scale, and a counter under each pan shows the tokens on that pan.",
    body: [
      base(),
      counter(-L),
      counter(L),
      pillar(),
      `<g data-part="back-0">${hangBack(-L)}</g>`,
      `<g data-part="back-1">${hangBack(L)}</g>`,
      `<g data-part="beam">${rest.beam}</g>`,
      prong(),
      `<g data-part="knife">${rest.knife}</g>`,
      `<g data-part="needle">${rest.needle}</g>`,
      `<g data-part="front-0">${hangFront(0)}</g>`,
      `<g data-part="front-1">${hangFront(1)}</g>`,
    ],
  });

  const stage = stageHtml({
    svg,
    label: "Beam balance. Press A or B to pick the message that you think costs more. Press Enter for the next pair.",
    role: "meter",
    attrs: `aria-valuemin="-${SLOTS}" aria-valuemax="${SLOTS}" aria-valuenow="0" aria-valuetext="Round 1 of ${ROUNDS.length}. The pans are empty."`,
  });

  const choice = (index) => {
    const letter = index ? "B" : "A";
    const text = index ? ROUNDS[0].b : ROUNDS[0].a;
    return `<button class="btn bal-choice" type="button" data-pick="${index}" aria-pressed="false"><span class="bal-letter" aria-hidden="true">${letter}</span><span class="bal-body"><span class="sr-only">Message ${letter}: </span><span class="bal-text" data-text>${esc(text)}</span><span class="bal-cut" data-cut aria-hidden="true" hidden></span><span class="bal-count" data-count hidden></span></span><span class="bal-tag" aria-hidden="true">Your pick</span></button>`;
  };
  const controls = `<div class="bal-choices" role="group" aria-label="Messages">${choice(0)}${choice(1)}</div>
<div class="bal-result" data-result hidden><p class="bal-verdict" data-verdict></p><p class="bal-lesson" data-lesson></p><div class="bal-next"><button class="btn btn-primary" type="button" data-next hidden>Next pair</button><button class="btn btn-primary" type="button" data-again hidden>Try again</button></div></div>
<p class="sr-only" aria-live="polite" data-say></p>`;

  const html = plate({
    id,
    fig,
    title: "Which message costs more?",
    hint: "Pick A or B",
    readout: `round 1 of ${ROUNDS.length} · pans empty`,
    keys: [
      { mark: "raised", label: "Slug: one token. Pan A is on the left, pan B on the right." },
      { mark: "lit", label: "Pointer: the difference in tokens" },
      { mark: "flat", label: "Counter: the tokens on the pan above it" },
    ],
    caption: `Every slug weighs the same, so the pan with more tokens goes down. The counts come from this page's small teaching tokenizer, which learned from English text. Production tokenizers cut text differently. Cost assumes ${(SENDS_PER_MONTH / 1e6).toLocaleString("en-US")} million sends a month at $${RATE} per million input tokens.`,
    stage,
    controls,
  });

  const script = `
${tokenizerSource()}
const P = ${JSON.stringify(P)};
const ROUNDS = ${JSON.stringify(ROUNDS)};
const SENDS_PER_MONTH = ${SENDS_PER_MONTH}, RATE = ${RATE}, SENSITIVITY = ${SENSITIVITY}, STOP = ${STOP};
const L = ${L}, ZK = ${ZK}, ZP = ${ZP}, PAN_H = ${PAN.h}, DROP = ${DROP}, SLOTS = ${SLOTS};
const SLUG = ${JSON.stringify(SLUG)};
const ARM_R = ${JSON.stringify(ARM_R)}, ARM_L = ${JSON.stringify(ARM_L)}, BOSS = ${JSON.stringify(BOSS)};
const KNIFE = ${JSON.stringify(KNIFE)}, COLLAR = ${JSON.stringify(COLLAR)}, NEEDLE = ${JSON.stringify(NEEDLE)};
const monthlyCost = ${monthlyCost.toString()};
const heavierOf = ${heavierOf.toString()};
const tiltOf = ${tiltOf.toString()};
const slotOf = ${slotOf.toString()};
${beamParts.toString()}
${hangOffsets.toString()}

// Timing: one pair of slugs every BEAT seconds, each falling DROP units under GRAVITY.
const BEAT = 0.075, GRAVITY = 490, FALL = Math.sqrt((2 * DROP) / GRAVITY), FADE = 0.08;
const SWAY = 0.009, SWAY_PERIOD = 4.4;
const tokenizer = trainTokenizer();
const CUTS = ROUNDS.map((round) => [tokenizer.encode(round.a), tokenizer.encode(round.b)]);

const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const beamNode = part("beam"), knifeNode = part("knife"), needleNode = part("needle");
const hangNodes = [[part("back-0"), part("front-0")], [part("back-1"), part("front-1")]];
// The slugs: one template, 48 slots on each pan, hidden until they drop.
const SLUG_SVG = ${JSON.stringify(SLUG_SVG)};
const slugNodes = [0, 1].map((side) => {
  const holder = part("slugs-" + side);
  holder.innerHTML = Array.from({ length: SLOTS }, () => '<g display="none">' + SLUG_SVG + "</g>").join("");
  return [...holder.children];
});
const digitNodes = [0, 1].map((side) => [0, 1].map((index) => svg.querySelector('[data-count="' + side + '"][data-digit="' + index + '"]')));
const choices = [...root.querySelectorAll("[data-pick]")];
const result = root.querySelector("[data-result]");
const verdictNode = root.querySelector("[data-verdict]");
const lessonNode = root.querySelector("[data-lesson]");
const nextButton = root.querySelector("[data-next]");
const againButton = root.querySelector("[data-again]");
const sayNode = root.querySelector("[data-say]");
const readout = readoutOf(root);

const state = { round: 0, phase: "pick", pick: -1, t: 0, landed: [0, 0], shown: [-1, -1], beam: { at: 0, rate: 0 }, drawn: null, clear: 0 };
let swayClock = -1.4, swaying = !STILL.matches, idleTimer = 0;

const counts = () => CUTS[state.round].map((cut) => cut.length);
const two = (n) => String(n).padStart(2, "0");
const say = (text) => { sayNode.textContent = text; };

function placeSlug(side, j, lift, alpha) {
  const node = slugNodes[side][j];
  if (alpha <= 0) {
    if (node.getAttribute("display") !== "none") node.setAttribute("display", "none");
    return;
  }
  const [sx, sy] = slotOf(j);
  node.setAttribute("transform", translateAlong(P, [(side ? L : -L) + sx, sy, ZP + PAN_H + lift]));
  if (node.hasAttribute("display")) node.removeAttribute("display");
  if (alpha >= 1) node.removeAttribute("opacity");
  else node.setAttribute("opacity", alpha.toFixed(2));
}

function drawBeam() {
  const theta = state.beam.at;
  if (state.drawn !== null && Math.abs(theta - state.drawn) < 2e-5) return;
  state.drawn = theta;
  const parts = beamParts(theta);
  beamNode.innerHTML = parts.beam;
  knifeNode.innerHTML = parts.knife;
  needleNode.innerHTML = parts.needle;
  hangOffsets(theta).forEach((offset, side) => hangNodes[side].forEach((node) => node.setAttribute("transform", offset)));
}

function drawCounts() {
  state.landed.forEach((count, side) => {
    if (state.shown[side] === count) return;
    state.shown[side] = count;
    const text = two(count);
    digitNodes[side].forEach((node, index) => { node.textContent = text[index]; });
  });
  const total = ROUNDS.length;
  readout(state.phase === "pick" ? "round " + (state.round + 1) + " of " + total + " · pans empty" : "round " + (state.round + 1) + " of " + total + " · A " + state.landed[0] + " · B " + state.landed[1]);
}

// Long messages without spaces may break after a comma.
function setText(node, text) {
  node.replaceChildren();
  text.split(",").forEach((piece, index, all) => {
    node.append(piece + (index < all.length - 1 ? "," : ""));
    if (index < all.length - 1) node.append(document.createElement("wbr"));
  });
}

function chips(cut) {
  return cut.map((token) => {
    const span = document.createElement("span");
    span.className = "bal-chip";
    if (token.charAt(0) === " ") {
      const mark = document.createElement("span");
      mark.className = "bal-space";
      mark.textContent = "␣";
      span.appendChild(mark);
      span.appendChild(document.createTextNode(token.slice(1)));
    } else span.textContent = token;
    return span;
  });
}

function showRound() {
  const round = ROUNDS[state.round];
  choices.forEach((button, index) => {
    button.setAttribute("aria-pressed", "false");
    button.removeAttribute("aria-disabled");
    setText(button.querySelector("[data-text]"), index ? round.b : round.a);
    button.querySelector("[data-text]").hidden = false;
    const cut = button.querySelector("[data-cut]");
    cut.hidden = true;
    cut.replaceChildren();
    const count = button.querySelector("[data-count]");
    count.hidden = true;
    count.textContent = "";
  });
  result.hidden = true;
  nextButton.hidden = true;
  againButton.hidden = true;
  stage.setAttribute("aria-valuenow", "0");
  stage.setAttribute("aria-valuetext", "Round " + (state.round + 1) + " of " + ROUNDS.length + ". The pans are empty.");
}

function reveal() {
  const [a, b] = counts();
  const heavy = heavierOf(a, b);
  const letter = (index) => (index ? "B" : "A");
  let head;
  let body;
  if (heavy < 0) {
    head = "They cost the same.";
    body = "A and B both use " + a + " tokens.";
  } else {
    head = (heavy === state.pick ? "Yes. " : "No. ") + letter(heavy) + " costs more.";
    body = letter(heavy) + " uses " + Math.abs(b - a) + " more tokens than " + letter(1 - heavy) + ".";
  }
  verdictNode.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = head;
  verdictNode.append(strong, " " + body);
  lessonNode.textContent = ROUNDS[state.round].lesson;
  choices.forEach((button, index) => {
    const n = index ? b : a;
    button.querySelector("[data-text]").hidden = true;
    const cut = button.querySelector("[data-cut]");
    cut.replaceChildren(...chips(CUTS[state.round][index]));
    cut.hidden = false;
    const count = button.querySelector("[data-count]");
    count.textContent = n + " tokens · " + money(monthlyCost(n)) + " a month";
    count.hidden = false;
  });
  const last = state.round + 1 >= ROUNDS.length;
  nextButton.hidden = last;
  againButton.hidden = !last;
  result.hidden = false;
  stage.setAttribute("aria-valuenow", String(b - a));
  const text = "A uses " + a + " tokens and B uses " + b + ". " + head;
  stage.setAttribute("aria-valuetext", text);
  say(head + " " + body);
}

function pick(index) {
  if (state.phase === "clear") {
    for (let side = 0; side < 2; side++) for (let j = 0; j < SLOTS; j++) placeSlug(side, j, 0, 0);
    state.phase = "pick";
  }
  if (state.phase !== "pick") return;
  hold();
  state.pick = index;
  state.phase = "drop";
  state.t = 0;
  choices.forEach((button, i) => {
    button.setAttribute("aria-pressed", String(i === index));
    button.setAttribute("aria-disabled", "true");
  });
  say("You picked " + (index ? "B" : "A") + ". The slugs drop onto the pans.");
  if (STILL.matches) state.t = 1e6;
  loop.kick();
}

function nextRound(again) {
  if (state.phase !== "done") return;
  const focused = root.contains(document.activeElement) && document.activeElement.matches("[data-next], [data-again]");
  state.round = again ? 0 : state.round + 1;
  state.phase = "clear";
  state.clear = STILL.matches ? 1 : 0;
  state.landed = [0, 0];
  showRound();
  if (focused) choices[0].focus({ preventScroll: true });
  say("Round " + (state.round + 1) + " of " + ROUNDS.length + ". Pick A or B.");
  hold();
  loop.kick();
}

// The idle sway pauses on any input and comes back after 6 s, only while the pans wait for a pick.
function hold() {
  swaying = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    swaying = !STILL.matches;
    swayClock = 0;
    loop.kick();
  }, 6000);
}

const loop = figureLoop(stage, (dt, calm) => {
  let moving = false;
  const [a, b] = counts();
  let target = 0;
  if (state.phase === "pick") {
    if (swaying && !calm) {
      swayClock += dt;
      if (swayClock > 0) target = SWAY * Math.sin((2 * Math.PI * swayClock) / SWAY_PERIOD) * Math.min(1, swayClock / 2);
      moving = true;
    }
  } else if (state.phase === "clear") {
    state.clear = calm ? 1 : Math.min(1, state.clear + dt / 0.3);
    const alpha = 1 - state.clear;
    for (let side = 0; side < 2; side++) for (let j = 0; j < SLOTS; j++) if (slugNodes[side][j].getAttribute("display") !== "none") slugNodes[side][j].setAttribute("opacity", alpha.toFixed(2));
    if (state.clear >= 1) {
      for (let side = 0; side < 2; side++) for (let j = 0; j < SLOTS; j++) placeSlug(side, j, 0, 0);
      state.phase = "pick";
    }
    moving = true;
  } else {
    state.t += dt;
    const before = state.landed.slice();
    [a, b].forEach((count, side) => {
      let landed = 0;
      for (let j = 0; j < count; j++) {
        const age = state.t - j * BEAT;
        if (age < 0) { placeSlug(side, j, 0, 0); continue; }
        const lift = Math.max(0, DROP - 0.5 * GRAVITY * age * age);
        if (lift === 0) landed += 1;
        placeSlug(side, j, lift, calm ? 1 : Math.min(1, age / FADE));
      }
      state.landed[side] = landed;
    });
    // Each slug that lands nudges the beam toward its pan.
    if (!calm) state.beam.rate += 0.03 * ((state.landed[1] - before[1]) - (state.landed[0] - before[0]));
    target = tiltOf(state.landed[1] - state.landed[0]);
    const done = state.landed[0] === a && state.landed[1] === b;
    if (state.phase === "drop" && done) {
      const lastLand = (Math.max(a, b) - 1) * BEAT + FALL;
      if (calm || state.t > lastLand + 1.3 || (state.t > lastLand + 0.4 && Math.abs(state.beam.at - target) < 0.002 && Math.abs(state.beam.rate) < 0.01)) {
        state.phase = "done";
        reveal();
      }
    }
    moving = moving || state.phase === "drop";
  }
  const settled = springTo(state.beam, target, dt, 26, 5.2, calm);
  drawBeam();
  drawCounts();
  return moving || !settled;
});

choices.forEach((button, index) => button.addEventListener("click", () => pick(index)));
nextButton.addEventListener("click", () => nextRound(false));
againButton.addEventListener("click", () => nextRound(true));
root.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === "a" || key === "b") pick(key === "a" ? 0 : 1);
  else if (event.key === "Enter") {
    // Next pair and Try again click on their own; anywhere else in the figure, Enter goes on.
    if (state.phase !== "done" || (event.target instanceof Element && event.target.matches("[data-next], [data-again]"))) return;
    nextRound(state.round + 1 >= ROUNDS.length);
  } else return;
  event.preventDefault();
});
stage.addEventListener("pointerenter", hold);
root.addEventListener("focusin", hold);
if (STILL.matches) swaying = false;
showRound();
drawCounts();
`;

  const css = `
[data-fig="${id}"] .bal-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0 0}
[data-fig="${id}"] .bal-choice{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;justify-content:stretch;gap:12px;min-height:76px;padding:13px 14px 14px;text-align:left;text-transform:none;letter-spacing:0;line-height:1.45;white-space:normal}
[data-fig="${id}"] .bal-choice::before{display:none}
[data-fig="${id}"] .bal-choice[aria-disabled="true"]{cursor:default}
[data-fig="${id}"] .bal-choice[aria-disabled="true"]:hover{box-shadow:inset 0 0 0 1px var(--site-rule-strong);color:var(--anatomy-text)}
[data-fig="${id}"] .bal-choice[aria-pressed="true"],[data-fig="${id}"] .bal-choice[aria-pressed="true"]:hover{box-shadow:inset 0 0 0 1px var(--anatomy-strong);background:var(--anatomy-face)}
[data-fig="${id}"] .bal-letter{display:flex;align-items:center;justify-content:center;width:30px;height:30px;box-shadow:inset 0 0 0 1px var(--anatomy-mid);color:var(--anatomy-strong);font:600 15px/1 var(--site-sans);letter-spacing:0}
[data-fig="${id}"] .bal-choice[aria-pressed="true"] .bal-letter{background:var(--anatomy-strong);color:var(--anatomy-page);box-shadow:none}
[data-fig="${id}"] .bal-body{display:grid;gap:8px;min-width:0;padding-top:4px}
[data-fig="${id}"] .bal-text{color:var(--anatomy-strong);font:15px/1.5 var(--anatomy-mono);overflow-wrap:anywhere}
[data-fig="${id}"] .bal-cut{display:flex;flex-wrap:wrap;gap:4px}
[data-fig="${id}"] .bal-cut[hidden],[data-fig="${id}"] .bal-count[hidden],[data-fig="${id}"] .bal-text[hidden]{display:none}
[data-fig="${id}"] .bal-chip{padding:2px 5px 3px;box-shadow:inset 0 0 0 1px var(--site-rule-strong);background:var(--anatomy-card);color:var(--anatomy-strong);font:13px/1.35 var(--anatomy-mono);white-space:pre}
[data-fig="${id}"] .bal-space{color:var(--anatomy-muted)}
[data-fig="${id}"] .bal-count{color:var(--anatomy-strong);font:600 14px/1.4 var(--site-sans);letter-spacing:0}
[data-fig="${id}"] .bal-tag{position:absolute;top:9px;right:10px;display:none;color:var(--anatomy-muted);font:10.5px/1 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase}
[data-fig="${id}"] .bal-choice[aria-pressed="true"] .bal-tag{display:block}
[data-fig="${id}"] .bal-choice[aria-pressed="true"] .bal-body{padding-right:72px}
[data-fig="${id}"] .bal-result{margin:12px 0 0;padding:13px 15px 14px;background:var(--site-wash);box-shadow:inset 2px 0 0 var(--anatomy-strong)}
[data-fig="${id}"] .bal-result[hidden]{display:none}
[data-fig="${id}"] .bal-verdict{margin:0 0 6px;color:var(--anatomy-text);font-size:16px;line-height:1.5}
[data-fig="${id}"] .bal-verdict strong{color:var(--anatomy-strong);font-weight:600}
[data-fig="${id}"] .bal-lesson{margin:0;color:var(--anatomy-text);font-size:15px;line-height:1.55}
[data-fig="${id}"] .bal-next{display:flex;gap:8px;margin:12px 0 0}
[data-fig="${id}"] .bal-next .btn[hidden]{display:none}
@media (max-width:560px){
  [data-fig="${id}"] .bal-choices{grid-template-columns:1fr}
  [data-fig="${id}"] .bal-choice{min-height:0}
}
`;
  return { html, css, script, needs: ["lathe"] };
}
