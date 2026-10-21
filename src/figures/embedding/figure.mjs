// Fig: the embedding table as a card catalog. Each drawer holds one row of the table and carries
// the row's token ID on its label; the drawers stand in ID order. An index carriage on a rail
// stops at the drawer for a token's ID, the drawer slides out and a card rises from it. The card's
// eight sliders are eight of the row's values. " light" and " lamp" sit far apart by ID but their
// cards match; " fog" and "house" sit side by side but their cards differ.
import * as k from "../../kit/iso-kit.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { TOKENS, FILED, drawerOf, shown, readoutText, VOCAB, D_MODEL, SHOWN } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 350;

const PLATE = { x: -136, y: -34, w: 272, d: 74, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

// Cabinet: the carcass front face is the plane y = 0; drawers slide out along +y.
const PITCH = 30;
const X = (c) => (c - 3.5) * PITCH;
const CAB = { x: -124, y: -24, w: 248, d: 24, r: 1.5 };
const CAB_Z = [3, 32];
const TOP = { x: -125.5, y: -25.5, w: 251, d: 27, r: 2 };
const TOP_Z = [32, 35];
const PANEL = { w: 27, d: 1.6, z: [6, 30] };
const HOLE = { w: 26, z: [6.6, 29.4] };
const BODY = { w: 24, d: 20, z: [7, 29] };
const OPEN = 12; // drawer travel
// The card stands in a slot in the drawer's top, 3 behind the front panel. At rest its top sits
// 1.4 below the drawer top and the card is hidden; raised, its bottom 4.4 stay in the slot.
const CARD = { w: 22, h: 20, t: 0.8, y: -3, z: 7.6 };
const LIFT = 17;
const SLOT = { pitch: 2.5, w: 0.8, v: [3.2, 16.8] };
const ZERO = 10; // card height of the zero line
const TRAVEL = 7; // card units for a value of 1
const KNOB = { w: 2.1, h: 1.2 };
const STEM = 0.55;
const HEADER = 17.6;

// Rail and index carriage in front of the cabinet.
const RAIL = { x: -118, y: 21.5, w: 236, d: 4, r: 1 };
const RAIL_H = 2.5;
const RULER = { x: -114, y: 29, w: 228, d: 4.6, r: 1 };
const LABEL = { x: 90, y: -19, w: 26, d: 9, r: 1.2 };

// At load the card for " light" stands up and is lit.
const INITIAL = TOKENS.findIndex((token) => token.text === " light");

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(TOP, 0, TOP_Z[1]), [-X(7) - CARD.w / 2, CARD.y + OPEN, CARD.z + LIFT + CARD.h], [X(7) + CARD.w / 2, CARD.y + OPEN, CARD.z + LIFT + CARD.h], [X(7) + PANEL.w / 2, OPEN + PANEL.d + 1.6, PANEL.z[1]]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: 60 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 10) / 10;
const poly = (points) => `M${points.map(([x, y]) => `${fix(x)} ${fix(y)}`).join("L")}Z`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
// A closed rounded rectangle in a vertical plane y = const, from (x0, z0) to (x1, z1).
const onFace = (y, x0, z0, x1, z1, r = 0, steps = 3) => k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([x, z]) => at([x, y, z])), true);
// The same in a vertical plane x = const, from (y0, z0) to (y1, z1).
const onSide = (x, y0, z0, y1, z1, r = 0, steps = 3) => k.pathOf(k.roundedPlan({ x: y0, y: z0, w: y1 - y0, d: z1 - z0, r }, steps).map(([y, z]) => at([x, y, z])), true);

function hull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
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
  // Ruler under the rail: a major tick at each drawer, a minor tick every fifth of a drawer.
  out.push(S(k.slabOf(RULER, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let m = -1; m <= 36; m++) {
    const x = X(0) + m * (PITCH / 5);
    (m % 5 === 0 ? major : minor).push(k.lineOnTop([x, RULER.y], [x, RULER.y + (m % 5 === 0 ? 3.4 : 2)], 0.6, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  return out.join("");
}

function cabinet() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAB, 2), 0, 6, P)}" style="opacity:calc(var(--anatomy-halo-opacity) * .7)"/>`];
  out.push(S(k.slabOf({ x: CAB.x + 2, y: CAB.y + 1.5, w: CAB.w - 4, d: CAB.d - 2, r: 1 }, 0, CAB_Z[0], P, 3), { tone: "lo" }));
  out.push(S(k.slabOf(CAB, CAB_Z[0], CAB_Z[1] - CAB_Z[0], P, 3, 0.6), { tone: "mid" }));
  // The openings behind the drawer fronts: dark, seen only when a drawer is out.
  const holes = Array.from({ length: 8 }, (_, c) => onFace(0, X(c) - HOLE.w / 2, HOLE.z[0], X(c) + HOLE.w / 2, HOLE.z[1]));
  out.push(`<path class="emb-void" d="${holes.join("")}"/>`, L(holes.join(""), { tone: "lo" }));
  // Frame-and-panel end.
  const end = CAB.x + CAB.w;
  out.push(L(onSide(end, CAB.y + 3, CAB_Z[0] + 3, -3, CAB_Z[1] - 3, 1.5), { tone: "lo" }));
  out.push(L(onSide(end, CAB.y + 4.6, CAB_Z[0] + 4.6, -4.6, CAB_Z[1] - 4.6, 1), { tone: "faint" }));
  out.push(S(k.slabOf(TOP, TOP_Z[0], TOP_Z[1] - TOP_Z[0], P, 6, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(TOP, 4), TOP_Z[1], P, 6), { tone: "faint" }));
  const screws = k.corners(TOP, 7.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.6, TOP_Z[1], P, 14)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, TOP_Z[1]])), { size: 0.45 }));
  // Maker's plate on the top, with three rule lines that stand for text.
  const z = TOP_Z[1];
  out.push(S(k.slabOf(LABEL, z, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(LABEL, 1.4), z + 0.8, P, 4), { tone: "faint" }));
  out.push(L([[3.4, 2.9, 15], [3.4, 4.5, 11], [3.4, 6.1, 13]].map(([dx, dy, w]) => k.lineOnTop([LABEL.x + dx, LABEL.y + dy], [LABEL.x + dx + w, LABEL.y + dy], z + 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([LABEL.x + LABEL.w - 2.6, LABEL.y + 2.6, z + 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d - 2.6, z + 0.8])], { size: 0.42 }));
  return out.join("");
}

// The drawer's box, built closed. Clipped to what has come out of the cabinet.
function bodySvg(c) {
  const xc = X(c);
  const plan = { x: xc - BODY.w / 2, y: -BODY.d, w: BODY.w, d: BODY.d, r: 0.6 };
  const slot = k.planOutline({ x: xc - CARD.w / 2 - 0.5, y: CARD.y - 0.6, w: CARD.w + 1, d: 1.2, r: 0.5 }, BODY.z[1], P, 3);
  return S(k.slabOf(plan, BODY.z[0], BODY.z[1] - BODY.z[0], P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, BODY.z[1] - 3.4, P, 3), { tone: "faint" }) }) + L(slot, { tone: "lo" });
}

// The drawer front: panel, label holder with the row's ID, and a bar pull.
function panelSvg(c, id) {
  const xc = X(c);
  const plan = { x: xc - PANEL.w / 2, y: 0, w: PANEL.w, d: PANEL.d, r: 0.6 };
  const front = PANEL.d;
  const out = [S(k.slabOf(plan, PANEL.z[0], PANEL.z[1] - PANEL.z[0], P, 3, 0.5), { tone: "mid" })];
  out.push(L(onFace(front, xc - 6.6, 21.4, xc + 6.6, 26.4, 0.9), { tone: "lo" }));
  out.push(L(onFace(front, xc - 5.8, 22.2, xc + 5.8, 25.6, 0.5), { tone: "faint" }));
  out.push(k.faceTextSvg(k.sideMatrix([xc, front], 22.9, P, "left"), String(id), { size: 2.7, tone: "mid", anchor: "middle" }));
  out.push(D([at([xc - 7.6, front, 23.9]), at([xc + 7.6, front, 23.9])], { size: 0.42 }));
  out.push(S(k.slabOf({ x: xc - 4.5, y: front, w: 9, d: 1.6, r: 0.7 }, 11, 2.4, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}

// One row's card, built at rest inside its drawer. Eight slots, a knob in each at the value.
function cardSvg(index, c) {
  const token = TOKENS[index];
  const xc = X(c);
  const plan = { x: xc - CARD.w / 2, y: CARD.y - CARD.t / 2, w: CARD.w, d: CARD.t, r: 0.2 };
  const face = CARD.y + CARD.t / 2;
  const z = CARD.z;
  const inner = L(k.sideSeam(plan, z + HEADER, P, 2), { tone: "faint" }) + L(k.sideSeam(plan, z + ZERO, P, 2), { tone: "lo" });
  const solid = S(k.slabOf(plan, z, CARD.h, P, 2), { tone: "hi", lit: index === INITIAL, inner });
  const u = (i) => xc + (i - (SHOWN - 1) / 2) * SLOT.pitch;
  const slots = token.row.map((_, i) => onFace(face, u(i) - SLOT.w / 2, z + SLOT.v[0], u(i) + SLOT.w / 2, z + SLOT.v[1], SLOT.w / 2, 3)).join("");
  // Each value is a knob at its height, joined to the zero line by a stem, so the sign reads at once.
  const knobs = token.row
    .map((value, i) => {
      const zc = z + ZERO + TRAVEL * value;
      const stem = onFace(face, u(i) - STEM / 2, Math.min(zc, z + ZERO), u(i) + STEM / 2, Math.max(zc, z + ZERO));
      return stem + onFace(face, u(i) - KNOB.w / 2, zc - KNOB.h / 2, u(i) + KNOB.w / 2, zc + KNOB.h / 2, 0.3, 2);
    })
    .join("");
  return `<g class="emb-card" data-card="${index}"${index === INITIAL ? " data-on" : ""}>${solid}${L(slots, { tone: "faint" })}<path class="emb-knob" d="${knobs}"/></g>`;
}

function rail() {
  const out = [S(k.slabOf(RAIL, 0, RAIL_H, P, 3, 0.4), { tone: "mid" })];
  out.push(L(k.lineOnTop([RAIL.x, RAIL.y + RAIL.d / 2], [RAIL.x + RAIL.w, RAIL.y + RAIL.d / 2], RAIL_H, P), { tone: "faint" }));
  out.push(D([RAIL.x + 6, RAIL.x + RAIL.w - 6].map((x) => at([x, RAIL.y + RAIL.d / 2, RAIL_H])), { size: 0.4 }));
  return out.join("");
}

function stop(x) {
  const plan = { x, y: RAIL.y - 1.5, w: 4, d: RAIL.d + 3, r: 1 };
  return S(k.slabOf(plan, 0, 5, P, 3, 0.4), { tone: "mid" }) + D([at([x + 2, RAIL.y + RAIL.d / 2, 5])], { size: 0.45 });
}

// The index carriage, built at x = 0. It stops in front of the drawer it serves.
function carriage() {
  const out = [];
  const body = { x: -8, y: RAIL.y - 2, w: 16, d: RAIL.d + 4, r: 1.2 };
  out.push(S(k.slabOf(body, RAIL_H, 5.5, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(body, RAIL_H + 1.6, P, 4), { tone: "faint" }) }));
  out.push(D([at([-5.4, body.y + 1.8, RAIL_H + 5.5]), at([5.4, body.y + body.d - 1.8, RAIL_H + 5.5])], { size: 0.45 }));
  const knob = [3.4, body.y + 2.6];
  out.push(S(k.cylinder(knob[0], knob[1], 1.9, RAIL_H + 5.5, 2.6, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 1.9, RAIL_H + 5.5, RAIL_H + 8.1, 16, P), { tone: "lo" }));
  return out.join("");
}

export function build({ fig = "Fig 1", id = "embedding" } = {}) {
  const initial = INITIAL;
  const open = drawerOf(initial);
  const slide = k.translateAlong(P, [0, OPEN, 0]);
  const lift = k.translateAlong(P, [0, 0, LIFT]);
  const defs = [];
  const drawers = FILED.map((index, c) => {
    const xc = X(c);
    const mouth = [-1, 1].flatMap((side) => [6.6, 29.4].flatMap((z) => [at([xc + (side * HOLE.w) / 2, 0, z]), at([xc + (side * HOLE.w) / 2, 60, z])]));
    defs.push(`<clipPath id="${id}-out-${c}"><path d="${poly(hull(mouth))}"/></clipPath>`);
    const yF = CARD.y + CARD.t / 2;
    const yB = CARD.y - CARD.t / 2;
    const fl = at([xc - CARD.w / 2, yF, BODY.z[1]]);
    const fr = at([xc + CARD.w / 2, yF, BODY.z[1]]);
    const br = at([xc + CARD.w / 2, yB, BODY.z[1]]);
    defs.push(`<clipPath id="${id}-up-${c}"><path d="${poly([[fl[0] - 4, fl[1] - 90], [fl[0] - 4, fl[1]], fl, fr, br, [br[0] + 4, br[1]], [br[0] + 4, br[1] - 90]])}"/></clipPath>`);
    const move = c === open ? ` transform="${slide}"` : "";
    const up = c === open ? ` transform="${lift}"` : ` style="display:none"`;
    return [
      `<g clip-path="url(#${id}-out-${c})"><g data-slide="${c}"${move}>${bodySvg(c)}</g></g>`,
      `<g data-slide="${c}"${move}><g clip-path="url(#${id}-up-${c})"><g data-lift="${c}"${up}>${cardSvg(index, c)}</g></g>${panelSvg(c, TOKENS[index].id)}</g>`,
    ].join("");
  });

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `A card catalog on a base plate. Eight drawers stand in token ID order, from 1211 to 40213. Each drawer holds one row of the embedding table. An index carriage runs on a rail in front of the drawers. When the carriage stops at a drawer, the drawer slides out and a card rises from it. The card has eight sliders. The height of each slider is one value of the row.`,
    body: [`<defs>${defs.join("")}</defs>`, base(), cabinet(), ...drawers, rail(), stop(RAIL.x - 4), stop(RAIL.x + RAIL.w), `<g data-part="carriage" transform="${k.translateAlong(P, [X(open), 0, 0])}">${carriage()}</g>`],
  });

  const token = TOKENS[initial];
  const stage = stageHtml({
    svg,
    label: "Card catalog of embedding rows. Left and right arrow keys choose a token. Home and End choose the first and last token.",
    role: "slider",
    attrs: `aria-valuemin="0" aria-valuemax="${TOKENS.length - 1}" aria-valuenow="${initial}" aria-valuetext="${token.text.trim()}: ID ${token.id}, row ${token.id.toLocaleString("en-US")}"`,
  });

  const controls = `<div class="fig-controls" role="group" aria-label="Token">${TOKENS.map((entry, index) => `<button class="btn" type="button" data-token="${index}" aria-pressed="${index === initial}">${shown(entry.text)}</button>`).join("")}</div>`;

  const html = plate({
    id,
    fig,
    title: "Rows become vectors",
    hint: "Pick a token",
    readout: readoutText(token, "shown"),
    keys: [
      { mark: "lit", label: "Lit card: the row for the chosen token" },
      { mark: "raised", label: "Drawers: one row each, in token ID order" },
      { mark: "flat", label: "Sliders: one value each, above or below the zero line" },
    ],
    caption: `The embedding table has one learned row for each vocabulary entry. The token ID is the row number. The lookup reads that row directly and does not search. The row becomes the token's starting hidden state at its position. Pre-training adjusts the rows. Tokens that occur in similar contexts get similar rows. The cards for “light” and “lamp” almost match, but the cards for “fog” and “house” differ. The sizes are illustrative: |V| = ${VOCAB.toLocaleString("en-US")} rows and d_model = ${D_MODEL.toLocaleString("en-US")} values. The cabinet shows ${TOKENS.length} rows, and each card shows ${SHOWN} values. The values are illustrative too.`,
    stage,
    controls,
  });

  const centres = FILED.map((_, c) => at([X(c), PANEL.d, 18]).map(fix));
  const script = `
const P = ${JSON.stringify(P)};
const TOKENS = ${JSON.stringify(TOKENS.map(({ text, id }) => ({ text, id })))};
const DRAWER = ${JSON.stringify(TOKENS.map((_, index) => drawerOf(index)))};
const FILED = ${JSON.stringify(FILED)};
const CENTRES = ${JSON.stringify(centres)};
const PITCH = ${PITCH}, OPEN = ${OPEN}, LIFT = ${LIFT};
const readoutText = ${readoutText.toString()};
const X = (c) => (c - 3.5) * PITCH;
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const slides = FILED.map((_, c) => [...svg.querySelectorAll('[data-slide="' + c + '"]')]);
const lifts = FILED.map((_, c) => svg.querySelector('[data-lift="' + c + '"]'));
const cards = TOKENS.map((_, index) => svg.querySelector('[data-card="' + index + '"]'));
const carriage = svg.querySelector('[data-part="carriage"]');
const buttons = [...root.querySelectorAll("[data-token]")];
const say = readoutOf(root);
// The tour walks the sentence, then shows ␣light and ␣lamp alone, then closes every drawer.
const SENTENCE = ${JSON.stringify(TOKENS.map((token, index) => (token.position === null ? -1 : index)).filter((index) => index >= 0))};
const PAIR = [${TOKENS.findIndex((token) => token.text === " light")}, ${TOKENS.findIndex((token) => token.text === " lamp")}];
let sel = ${initial};
const want = FILED.map((_, c) => c === DRAWER[sel]);
const e = want.map((open) => (open ? OPEN : 0));
const lift = want.map((open) => (open ? LIFT : 0));
const shownE = e.slice(), shownLift = lift.slice();
let car = X(DRAWER[sel]), shownCar = car;
let pending = [], clock = 0, clearing = false, closed = false;
let touring = !STILL.matches, tourStep = 0, tourIdle = 0, tourPhase = "walk", resume = 0;
function highlight(index) {
  cards.forEach((node, i) => {
    node.toggleAttribute("data-on", i === index);
    node.querySelector(".iso-solid").toggleAttribute("data-lit", i === index);
  });
  buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
}
function describe() {
  const token = TOKENS[sel];
  stage.setAttribute("aria-valuenow", String(sel));
  stage.setAttribute("aria-valuetext", token.text.trim() + ": ID " + token.id + ", row " + token.id.toLocaleString("en-US"));
}
function pick(index, manual) {
  const before = DRAWER[sel];
  if (before !== DRAWER[index] && e[before] < 0.01 && want[before]) want[before] = false;
  sel = index;
  const c = DRAWER[index];
  want[c] = true;
  pending = pending.filter((entry) => entry.c !== c);
  clearing = false;
  closed = false;
  highlight(index);
  if (manual) describe();
  loop.kick();
}
function closeAll(keep) {
  const open = FILED.map((_, c) => c).filter((c) => want[c] && c !== keep).reverse();
  pending = open.map((c, n) => ({ c, at: clock + n * 0.09 }));
  clearing = true;
  closed = true;
}
function draw() {
  if (car !== shownCar) { carriage.setAttribute("transform", translateAlong(P, [car, 0, 0])); shownCar = car; }
  FILED.forEach((_, c) => {
    if (e[c] !== shownE[c]) {
      const text = e[c] ? translateAlong(P, [0, e[c], 0]) : "";
      slides[c].forEach((node) => (text ? node.setAttribute("transform", text) : node.removeAttribute("transform")));
      shownE[c] = e[c];
    }
    if (lift[c] !== shownLift[c]) {
      if (lift[c]) lifts[c].setAttribute("transform", translateAlong(P, [0, 0, lift[c]]));
      else lifts[c].removeAttribute("transform");
      lifts[c].style.display = lift[c] ? "" : "none";
      shownLift[c] = lift[c];
    }
  });
  const c = DRAWER[sel];
  if (closed) say("closing drawers");
  else say(readoutText(TOKENS[sel], lift[c] > LIFT - 0.6 ? "shown" : "opening"));
}
const loop = figureLoop(stage, (dt, calm) => {
  clock += dt;
  pending = pending.filter((entry) => {
    if (entry.at > clock) return true;
    want[entry.c] = false;
    return false;
  });
  const target = X(DRAWER[sel]);
  car = follow(car, target, dt, 0.24, calm);
  let moving = car !== target;
  // A drawer opens once the carriage is there, and its card rises once it is out. Closing runs
  // the other way: the card sinks first, then the drawer goes in.
  FILED.forEach((_, c) => {
    const ready = c !== DRAWER[sel] || Math.abs(car - X(c)) < 2.5 || e[c] > 0.01;
    const open = want[c] && ready;
    if (ready || !want[c]) e[c] = follow(e[c], open || lift[c] > 0.05 ? OPEN : 0, dt, 0.14, calm);
    lift[c] = follow(lift[c], open && e[c] > OPEN - 1.2 ? LIFT : 0, dt, 0.16, calm);
    if (e[c] !== (want[c] ? OPEN : 0) || lift[c] !== (want[c] ? LIFT : 0)) moving = true;
  });
  if (clearing && !pending.length && !moving) clearing = false;
  if (touring) {
    const up = lift[DRAWER[sel]] > LIFT - 0.6;
    tourIdle = !moving && !pending.length ? tourIdle + dt : 0;
    if (tourPhase === "walk") {
      const dwell = tourStep === 0 && sel !== SENTENCE[0] ? 1.4 : 1.3;
      if (tourIdle >= dwell && up) {
        tourIdle = 0;
        if (tourStep < SENTENCE.length) pick(SENTENCE[tourStep++], false);
        else { want[DRAWER[PAIR[0]]] = true; closeAll(DRAWER[PAIR[0]]); tourPhase = "pair"; }
      }
    } else if (tourPhase === "pair") {
      if (tourIdle >= 0.6 && !clearing) { tourIdle = 0; pick(PAIR[1], false); tourPhase = "compare"; }
    } else if (tourPhase === "compare") {
      if (tourIdle >= 4.2 && up) { tourIdle = 0; closeAll(-1); tourPhase = "reset"; }
    } else if (tourIdle >= 0.9 && !clearing) {
      tourIdle = 0;
      tourPhase = "walk";
      tourStep = 0;
      pick(SENTENCE[tourStep++], false);
    }
  }
  draw();
  return touring || moving || pending.length > 0;
});
function steer() {
  touring = false;
  clearTimeout(resume);
  resume = setTimeout(() => { touring = !STILL.matches; tourIdle = 0; loop.kick(); }, 6000);
}
function choose(index) {
  steer();
  pick(Math.max(0, Math.min(TOKENS.length - 1, index)), true);
}
buttons.forEach((button) => button.addEventListener("click", () => choose(Number(button.dataset.token))));
stage.addEventListener("pointerdown", (event) => {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const local = point.matrixTransform(svg.getScreenCTM().inverse());
  let best = -1, near = 26;
  CENTRES.forEach(([x, y], c) => {
    const d = Math.hypot(local.x - x, local.y - y);
    if (d < near) { near = d; best = c; }
  });
  if (best >= 0) choose(FILED[best]);
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") choose(sel + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") choose(sel - 1);
  else if (event.key === "Home") choose(0);
  else if (event.key === "End") choose(TOKENS.length - 1);
  else return;
  event.preventDefault();
});
if (STILL.matches) touring = false;
describe();
draw();
`;

  const css = `
[data-fig="${id}"] .emb-void{fill:var(--anatomy-shade-0)}
[data-fig="${id}"] .emb-knob{fill:var(--anatomy-mid);stroke:none}
[data-fig="${id}"] .emb-card[data-on] .emb-knob{fill:var(--anatomy-lit)}
[data-fig="${id}"] [data-token]{text-transform:none;letter-spacing:.02em;font-size:12px}
@media (max-width:560px){
  [data-fig="${id}"] .iso-stage{overflow:hidden}
  [data-fig="${id}"] .iso-stage .iso-svg{width:116%;margin:-3% -8% -2%}
}
`;
  return { html, css, script, needs: [] };
}
