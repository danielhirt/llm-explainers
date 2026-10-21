// Fig: the agentic loop as a punched-card loop machine. The context is a row of punched cards on
// a bed. The card reader (the model) rolls its read head over every card, then punches one new
// card. The card runs down the lane to a gate. A tool call turns into the press (the harness),
// which runs the tool, punches a result card and slides both cards onto the end of the row. On
// the last lap the reader punches an answer, and the gate sends it on to the output tray.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { START, LAPS, ANSWER, cardsOf, stepsOf, tokensOf, plain, sayOf, statusOf, columnsOf } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 410;

// World units are about 1 px of the real thing: x along the machine, y toward the front, z up.
const PLATE = { x: -74, y: -42, w: 282, d: 106, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const CARD = { w: 11, d: 24, t: 0.8, cut: 2.2 };
const DECK_Z = 3; // top of the bed, the lane and the press base
const CARD_TOP = DECK_Z + CARD.t;
const PITCH = 13;
const FIRST_X = -1; // left edge of the first card in the row
const slotX = (index) => FIRST_X + PITCH * index;
const BED_Y = -12; // card y on the bed and under the die
const LANE_Y = 28; // card y on the lane

const READER = { x: -64, y: -30, w: 50, d: 87, r: 3 };
const READER_H = 30;
const FACE_X = READER.x + READER.w; // -14: the reader's right face, where new cards come out
const BED = { x: FACE_X, y: -16, w: 146, d: 32, r: 2 }; // x -14..132
const LANE = { x: FACE_X, y: 25, w: 146, d: 32, r: 2 }; // x -14..132, y 25..57
const PRESS = { x: 132, y: -22, w: 40, d: 80, r: 3 }; // base under both lanes, x 132..172
const DIE_X = 136; // card x under the die
const DIE_C = [DIE_X + CARD.w / 2, BED_Y + CARD.d / 2];
const MAG_X = 153.5; // card x in the blank magazine
const TRAY = { x: 172, y: 24, w: 30, d: 36, r: 2 };
const TRAY_X = 187; // answer card x in the tray
const EXIT_IN = FACE_X - CARD.w - 1; // a new card still inside the reader
const EXIT_OUT = -6; // a new card clear of the exit roller
const PIVOT = [150, 26.4]; // gate pivot
const FLAP_L = 22;
const FLAP_Z = [DECK_Z, 4.4];
const EXIT_BEARINGS = [LANE_Y - 2.6, LANE_Y + CARD.d + 0.4]; // y of the exit roller's two bearings

const RAIL = { x: FACE_X, y: -26.5, w: 138, d: 5, r: 1 }; // x -14..124
const RAIL_H = 7;
const HOME = -9; // read head x at rest
const HEAD_Z = 12;
const ROLLER_R = 2;
const STROKE = 8.1; // die travel down to the card
const RULER = { x: -3.4, y: 16.8, w: 129.4, d: 6.4, r: 0.8 };
const RULER_H = 4.8; // as tall as the lips, so the lane in front hides none of the scale
const TICK_X = (n) => FIRST_X - 1 + PITCH * n; // a tick at the end of n cards
const COUNTER = { x: FACE_X, y: 16.4, w: 10.6, d: 7, r: 0.8 };
const COUNTER_H = 12;
const LAP_BOX = { x: -44, y: READER.y + READER.d, w: 8, d: 2.4, r: 0.5 };

const CARDS = cardsOf();
const STEPS = stepsOf();
const ANSWER_ID = CARDS.length - 1;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners({ x: 134, y: -32, w: 16, d: 40 }, 0, 46),
    ...k.boxCorners(READER, 0, 39),
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 100) / 100;
const pathOf = (points, closed = true) => `M${points.map((p) => at(p).map(fix).join(" ")).join("L")}${closed ? "Z" : ""}`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
// A closed rectangle in the plane x = const (the reader's right face) or y = const (a front face).
const xFaceRect = (x, y0, y1, z0, z1) => pathOf([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]);
const yFaceRect = (y, x0, x1, z0, z1) => pathOf([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);

// A punched card: a thin plate with one corner cut, and holes in the columns its message fills.
const cardRing = (x, y) => [[x + CARD.cut, y], [x + CARD.w, y], [x + CARD.w, y + CARD.d], [x, y + CARD.d], [x, y + CARD.cut]];
function holesOf(index, x, y) {
  let seed = 11 + index * 37;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const out = [];
  for (let column = 0; column < columnsOf(CARDS[index].tokens); column++) {
    const cy = y + 3.4 + column * 1.6;
    const rows = new Set([Math.floor(rand() * 5)]);
    if (rand() < 0.5) rows.add(Math.floor(rand() * 5));
    for (const row of rows) {
      const cx = x + 2.6 + row * 1.55;
      out.push(k.onTop([[cx - 0.48, cy - 0.34], [cx + 0.48, cy - 0.34], [cx + 0.48, cy + 0.34], [cx - 0.48, cy + 0.34]], CARD_TOP, P, true));
    }
  }
  return out.join("");
}
function cardSvg(index, x, y) {
  const paths = k.extrude(cardRing(x, y), DECK_Z, CARD.t, P);
  return S(paths, { tone: "hi", crease: "none", lit: false, inner: `<path class="cl-holes" d="${holesOf(index, x, y)}"/>` });
}
// Where each card is built: the static deck in its slot, the cards that move at their last stop.
const homeOf = (index) => (index === ANSWER_ID ? [TRAY_X, LANE_Y] : [slotX(index), BED_Y]);

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
  // Label plate in the free corner right of the press.
  const label = { x: 177, y: -18, w: 25, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[181, -14.6, 17], [181, -12, 12], [181, -9.4, 15]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2, label.y + 2, 0.8]), at([label.x + label.w - 2, label.y + label.d - 2, 0.8])], { size: 0.42 }));
  return out.join("");
}

// The card reader: the model. A blank stack on its lid, a lap counter on its front, and the
// exit slot and roller on its right face, where each new card comes out onto the lane.
function reader() {
  const out = [];
  out.push(S(k.slabOf(READER, 0, READER_H, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(READER, 5, P, 6), { tone: "faint" }) }));
  const lid = k.insetPlan(READER, 3);
  out.push(S(k.slabOf(lid, READER_H, 2.4, P, 5, 0.6), { tone: "mid" }));
  const top = READER_H + 2.4;
  out.push(D(k.corners(lid, 3).map(([x, y]) => at([x, y, top])), { size: 0.45 }));
  // Blank cards for the punch, held by two posts, with the feed slot in front of them.
  const blank = { x: -53, y: -18 };
  for (const x of [blank.x - 1.3, blank.x + CARD.w + 1.3]) out.push(S(k.cylinder(x, blank.y - 1.3, 0.9, top, 6.4, P, 14), { tone: "mid" }));
  const ring = cardRing(blank.x, blank.y);
  const seams = [1, 2, 3, 4].map((n) => k.ringSeam(ring, top + n * CARD.t, P)).join("");
  out.push(S(k.extrude(ring, top, CARD.t * 5, P), { tone: "mid", crease: "faint", inner: L(seams, { tone: "faint" }) }));
  out.push(L(k.planOutline({ x: blank.x - 1, y: blank.y + CARD.d + 3, w: CARD.w + 2, d: 1.6, r: 0.6 }, top, P, 3), { tone: "lo" }));
  // An access cover on the front half of the lid.
  const cover = { x: lid.x + 5, y: 14, w: lid.w - 10, d: 32, r: 1.2 };
  out.push(L(k.planOutline(cover, top, P, 3), { tone: "lo" }));
  out.push(D(k.corners(cover, 2.2).map(([x, y]) => at([x, y, top])), { size: 0.42 }));
  // Front face: vents and the lap counter.
  const front = READER.y + READER.d;
  out.push(L([9, 12.5, 16].map((z) => yFaceRect(front, -60, -50, z, z + 1.4)).join(""), { tone: "lo" }));
  out.push(S(k.slabOf(LAP_BOX, 13, 9, P, 3, 0.3), { tone: "mid" }));
  // A maker's plate beside the counter: its rule lines stand for printed text.
  out.push(L(yFaceRect(front, -32, -18, 12, 21), { tone: "lo" }));
  out.push(L([[-30, 18.6, 9], [-30, 16.4, 6], [-30, 14.2, 8]].map(([x, z, w]) => k.segment([x, front, z], [x + w, front, z], P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([-30.6, front, 20.2]), at([-19.4, front, 12.8])], { size: 0.4 }));
  out.push(L(yFaceRect(front + LAP_BOX.d, -42.2, -37.8, 14.4, 20.6), { tone: "lo" }));
  out.push(`<g transform="${k.sideMatrix([0, front + LAP_BOX.d], 20.6, P, "left")}"><text class="iso-face-text" data-tone="hi" x="-40" y="5.1" font-size="5" text-anchor="middle" data-lap>1</text></g>`);
  // Right face: the exit slot, vents over the lane and a service plate over the bed.
  out.push(L(xFaceRect(FACE_X, LANE_Y - 1, LANE_Y + CARD.d + 1, 2.4, 5.6), { tone: "lo" }));
  out.push(L([18, 21.5, 25].map((z) => xFaceRect(FACE_X, 32, 50, z, z + 1.4)).join(""), { tone: "lo" }));
  out.push(L(xFaceRect(FACE_X, -12, 12, 15, 25), { tone: "lo" }));
  out.push(D([[-9.5, 17], [9.5, 17], [-9.5, 23], [9.5, 23]].map(([y, z]) => at([FACE_X, y, z])), { size: 0.42 }));
  return out.join("");
}

// The press frame behind the back lane: column, flywheel and the magazine's back posts.
function pressBack() {
  const out = [];
  const column = { x: 134, y: -32, w: 16, d: 10, r: 2 };
  out.push(S(k.slabOf(column, 0, 38, P, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(column, 6, P, 4), { tone: "faint" }) }));
  const front = column.y + column.d;
  out.push(L(yFaceRect(front, column.x + 3, column.x + column.w - 3, 12, 32), { tone: "lo" }));
  out.push(D([[column.x + 4.6, 13.6], [column.x + column.w - 4.6, 13.6], [column.x + 4.6, 30.4], [column.x + column.w - 4.6, 30.4]].map(([x, z]) => at([x, front, z])), { size: 0.42 }));
  const F = G.frameAlong([150, -27, 26], [1, 0, 0]);
  const ribs = G.ribsOf(F, 0, 2.6, 8.5, 56, P, { fade: [0.08, 0.5] });
  out.push(S(G.disc(0, 2.6, 8.5, F, P), { tone: "mid", inner: k.fadedSvg(ribs, { tone: "lo" }) }));
  out.push(L(G.circleOf(F, 2.6, 6.2, P), { tone: "faint" }));
  out.push(S(G.disc(2.6, 4.2, 2.4, F, P), { tone: "mid" }));
  out.push(D([at([154.2, -27, 26])], { size: 0.55, tone: "hi" }));
  for (const x of [MAG_X - 1.3, MAG_X + CARD.w + 1.3]) out.push(S(k.cylinder(x, BED_Y - 1.4, 1, DECK_Z, 7.4, P, 14), { tone: "mid" }));
  return out.join("");
}

function rail() {
  const out = [S(k.slabOf(RAIL, 0, RAIL_H, P, 3, 0.5), { tone: "mid" })];
  out.push(L(k.lineOnTop([RAIL.x, RAIL.y + RAIL.d / 2], [RAIL.x + RAIL.w, RAIL.y + RAIL.d / 2], RAIL_H, P), { tone: "faint" }));
  out.push(D([RAIL.x + 30, RAIL.x + 70, RAIL.x + 110].map((x) => at([x, RAIL.y + 1.2, RAIL_H])), { size: 0.4 }));
  const stop = { x: RAIL.x + RAIL.w, y: RAIL.y - 1, w: 4, d: RAIL.d + 2, r: 1 };
  out.push(S(k.slabOf(stop, 0, RAIL_H + 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([stop.x + 2, stop.y + stop.d / 2, RAIL_H + 3])], { size: 0.45 }));
  return out.join("");
}

// The read head, built at HOME. The carriage rides the rail; the arm reaches over the bed and
// holds the read roller on the cards.
function carriage() {
  const block = { x: HOME - 5, y: RAIL.y - 1, w: 10, d: RAIL.d + 2, r: 1 };
  return S(k.slabOf(block, RAIL_H, HEAD_Z - RAIL_H, P, 3, 0.5), { tone: "mid" }) + D([at([HOME - 3, block.y + 3.5, HEAD_Z]), at([HOME + 3, block.y + 3.5, HEAD_Z])], { size: 0.4 });
}
function head() {
  const out = [];
  const axle = CARD_TOP + ROLLER_R;
  const span = [BED_Y - 0.8, BED_Y + CARD.d + 0.8];
  out.push(S(k.slabOf({ x: HOME - 1.6, y: span[0] - 1.4, w: 3.2, d: 1.4, r: 0.4 }, axle - 1.2, HEAD_Z - axle + 1.2, P, 2), { tone: "mid" }));
  const F = G.frameAlong([HOME, span[0], axle], [0, 1, 0]);
  out.push(S(G.disc(0, span[1] - span[0], ROLLER_R, F, P), { tone: "mid", inner: L([0.6, span[1] - span[0] - 0.6].map((s) => G.arcOf(F, s, ROLLER_R, P)).join(""), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: HOME - 1.6, y: span[1], w: 3.2, d: 1.4, r: 0.4 }, axle - 1.2, HEAD_Z - axle + 1.2, P, 2), { tone: "mid" }));
  out.push(D([at([HOME, span[1] + 1.4, axle])], { size: 0.42 }));
  const arm = { x: HOME - 2, y: RAIL.y + 0.5, w: 4, d: span[1] + 1.4 - RAIL.y - 0.5, r: 0.8 };
  out.push(S(k.slabOf(arm, HEAD_Z, 2.4, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([HOME, arm.y + 2.4, HEAD_Z + 2.4]), at([HOME, arm.y + arm.d - 2, HEAD_Z + 2.4])], { size: 0.4 }));
  return out.join("");
}

function bed() {
  const out = [S(k.slabOf(BED, 0, DECK_Z, P, 4, 0.4), { tone: "mid" })];
  // A seat for each card position, so the free length of the bed reads as room to grow.
  const seats = Array.from({ length: 10 }, (_, n) => k.planOutline({ x: slotX(n) - 0.7, y: BED_Y - 0.7, w: CARD.w + 1.4, d: CARD.d + 1.4, r: 0.6 }, DECK_Z, P, 2)).join("");
  out.push(L(seats, { tone: "faint" }));
  out.push(S(k.slabOf({ x: BED.x, y: BED.y, w: BED.w, d: 1.6, r: 0.4 }, DECK_Z, 1.6, P, 2), { tone: "mid" }));
  // The press base, with the die's seat marked on it.
  out.push(S(k.slabOf(PRESS, 0, DECK_Z, P, 5, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline({ x: DIE_X - 1.4, y: BED_Y - 1.4, w: CARD.w + 2.8, d: CARD.d + 2.8, r: 1 }, DECK_Z, P, 3), { tone: "faint" }));
  out.push(D(k.corners(PRESS, 3).map(([x, y]) => at([x, y, DECK_Z])), { size: 0.45 }));
  return out.join("");
}

function bedFront() {
  const out = [S(k.slabOf({ x: BED.x, y: BED.y + BED.d - 1.6, w: BED.w, d: 1.6, r: 0.4 }, DECK_Z, 1.6, P, 2), { tone: "mid" })];
  // The ruler bar: one tick per card in the context, a major tick every five, the zero in hi.
  out.push(S(k.slabOf(RULER, 0, RULER_H, P, 3, 0.4), { tone: "mid" }));
  const edge = RULER.y + 0.01;
  const ticks = { minor: "", major: "" };
  for (let n = 1; n <= 10; n++) ticks[n % 5 === 0 ? "major" : "minor"] += k.lineOnTop([TICK_X(n), edge], [TICK_X(n), edge + (n % 5 === 0 ? 4 : 2.4)], RULER_H, P);
  out.push(L(ticks.minor, { tone: "mid" }), L(ticks.major, { tone: "hi" }));
  out.push(L(k.lineOnTop([TICK_X(0), edge], [TICK_X(0), edge + 4], RULER_H, P), { tone: "hi" }));
  out.push(D([at([RULER.x + RULER.w - 1.6, RULER.y + RULER.d - 1.6, RULER_H])], { size: 0.42 }));
  // The card counter at the zero end of the ruler.
  out.push(S(k.slabOf(COUNTER, 0, COUNTER_H, P, 3, 0.4), { tone: "mid" }));
  const face = COUNTER.y + COUNTER.d;
  out.push(L([0, 1].map((n) => yFaceRect(face, COUNTER.x + 1 + n * 4.4, COUNTER.x + 5.2 + n * 4.4, 4.4, 10.4)).join(""), { tone: "lo" }));
  out.push(`<g transform="${k.sideMatrix([0, face], 10.4, P, "left")}">${[0, 1].map((n) => `<text class="iso-face-text" data-tone="hi" x="${fix(COUNTER.x + 3.1 + n * 4.4)}" y="4.55" font-size="4" text-anchor="middle" data-deck-digit="${n}">${n ? "3" : "0"}</text>`).join("")}</g>`);
  out.push(D([at([COUNTER.x + 2, COUNTER.y + 2, COUNTER_H]), at([COUNTER.x + COUNTER.w - 2, COUNTER.y + COUNTER.d - 2, COUNTER_H])], { size: 0.4 }));
  return out.join("");
}

// The press head, guide, die and blank magazine, drawn over the back lane.
function ramSvg() {
  const die = { x: DIE_X - 1, y: BED_Y - 0.5, w: CARD.w + 2, d: CARD.d + 1, r: 1 };
  const bottom = CARD_TOP + STROKE + 0.05;
  return S(k.slabOf(die, bottom, 2.5, P, 3, 0.4), { tone: "mid" }) + S(k.cylinder(DIE_C[0], DIE_C[1], 2.4, bottom + 2.5, 40 - bottom - 2.5, P, 20), { tone: "mid", crease: "none" });
}
function pressFront() {
  const out = [];
  out.push(`<g data-part="ram">${ramSvg()}</g>`);
  out.push(S(k.cylinder(DIE_C[0], DIE_C[1], 4.2, 32, 6, P, 28, 0.4), { tone: "mid" }));
  const head = { x: 134, y: -32, w: 16, d: 40, r: 2.5 };
  out.push(S(k.slabOf(head, 38, 8, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(head, 42, P, 4), { tone: "faint" }) }));
  out.push(D([[138, -28], [146, -28], [138, 4], [146, 4]].map(([x, y]) => at([x, y, 46])), { size: 0.45 }));
  // Blank result cards, stacked in the magazine; the result card slides out from under them.
  const ring = cardRing(MAG_X, BED_Y);
  const seams = [1, 2, 3, 4, 5, 6].map((n) => k.ringSeam(ring, DECK_Z + n * CARD.t, P)).join("");
  out.push(S(k.extrude(ring, DECK_Z, CARD.t * 7, P), { tone: "mid", crease: "faint", inner: L(seams, { tone: "faint" }) }));
  for (const x of [MAG_X - 1.3, MAG_X + CARD.w + 1.3]) out.push(S(k.cylinder(x, BED_Y + CARD.d + 1.4, 1, DECK_Z, 7.4, P, 14), { tone: "mid" }));
  return out.join("");
}

// A drive roller showing through a slot in the lane, its crest running end to end.
function rollerSlot(x) {
  const slot = { x: x - 1.3, y: LANE_Y + 4, w: 2.6, d: CARD.d - 8, r: 1.3 };
  return L(k.planOutline(slot, DECK_Z, P, 4), { tone: "lo" }) + L(k.lineOnTop([x, slot.y], [x, slot.y + slot.d], DECK_Z, P), { tone: "faint" });
}
function lane() {
  const out = [S(k.slabOf(LANE, 0, DECK_Z, P, 4, 0.4), { tone: "mid" })];
  out.push([14, 42, 70, 98, 124, 159].map(rollerSlot).join(""));
  out.push(L(k.planOutline({ x: DIE_X - 0.7, y: LANE_Y - 0.7, w: CARD.w + 1.4, d: CARD.d + 1.4, r: 0.6 }, DECK_Z, P, 2), { tone: "faint" }));
  out.push(S(k.slabOf({ x: FACE_X + 4.4, y: LANE.y, w: LANE.w - 4.4, d: 1.5, r: 0.4 }, DECK_Z, 1.6, P, 2), { tone: "mid" }));
  // The tray floor and back wall, behind the answer card.
  out.push(S(k.slabOf(TRAY, 0, DECK_Z, P, 4, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y, w: TRAY.w, d: 1.6, r: 0.4 }, DECK_Z, 5, P, 2, 0.3), { tone: "mid" }));
  // The exit roller's back bearing stands behind the card's path.
  out.push(S(k.slabOf({ x: FACE_X, y: EXIT_BEARINGS[0], w: 3.6, d: 2.2, r: 0.4 }, DECK_Z, 5.8, P, 2), { tone: "mid" }));
  // The gate sits here while the answer card runs past in front of it.
  out.push(`<g data-slot="gate-back"></g>`);
  return out.join("");
}

// The gate flap at an angle: 0 lies across the lane (a call turns into the press), 90 lies
// along the back edge (the answer runs on to the tray). The page runs this same function.
function flapAt(degrees) {
  const t = (degrees * Math.PI) / 180;
  const d = [Math.sin(t), Math.cos(t)];
  const n = [Math.cos(t) * 0.6, -Math.sin(t) * 0.6];
  const [px, py] = PIVOT;
  const ring = [
    [px + n[0], py + n[1]],
    [px + d[0] * FLAP_L + n[0], py + d[1] * FLAP_L + n[1]],
    [px + d[0] * FLAP_L - n[0], py + d[1] * FLAP_L - n[1]],
    [px - n[0], py - n[1]],
  ];
  return k.solidSvg(k.extrude(ring, FLAP_Z[0], FLAP_Z[1], P), { tone: "mid" });
}

function laneFront() {
  const out = [];
  // Exit roller between two bearings on the reader's right face.
  const axle = CARD_TOP + ROLLER_R + 0.05;
  const ys = EXIT_BEARINGS;
  const F = G.frameAlong([FACE_X + 2.2, ys[0] + 2.2, axle], [0, 1, 0]);
  const length = ys[1] - ys[0] - 2.2;
  out.push(S(G.disc(0, length, ROLLER_R, F, P), { tone: "mid", inner: L([0.6, length - 0.6].map((s) => G.arcOf(F, s, ROLLER_R, P)).join(""), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: FACE_X, y: ys[1], w: 3.6, d: 2.2, r: 0.4 }, DECK_Z, 5.8, P, 2), { tone: "mid" }));
  out.push(D([at([FACE_X + 2.2, ys[1] + 2.2, axle])], { size: 0.42 }));
  // Front lip of the lane, running on over the press base to the tray.
  out.push(S(k.slabOf({ x: FACE_X + 4.4, y: LANE_Y + CARD.d + 1.5, w: TRAY.x - FACE_X - 4.4, d: 1.5, r: 0.4 }, DECK_Z, 1.6, P, 2), { tone: "mid" }));
  // The gate: a flap on a post. It sits in front of a call card that stops before it.
  const post = S(k.cylinder(PIVOT[0], PIVOT[1], 1.4, DECK_Z, 6.4, P, 16), { tone: "mid" }) + S(k.cylinder(PIVOT[0], PIVOT[1], 2.1, DECK_Z + 6.4, 1.2, P, 18, 0.3), { tone: "mid" });
  out.push(`<g data-slot="gate-front"><g data-part="gate"><g data-part="flap">${flapAt(0)}</g>${post}</g></g>`);
  // Tray side and front walls, in front of the answer card.
  out.push(S(k.slabOf({ x: TRAY.x + TRAY.w - 1.6, y: TRAY.y, w: 1.6, d: TRAY.d, r: 0.4 }, DECK_Z, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: TRAY.x, y: TRAY.y + TRAY.d - 1.6, w: TRAY.w, d: 1.6, r: 0.4 }, DECK_Z, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(D([at([TRAY.x + TRAY.w - 0.8, TRAY.y + 4, DECK_Z + 5]), at([TRAY.x + TRAY.w - 0.8, TRAY.y + TRAY.d - 4, DECK_Z + 5])], { size: 0.4 }));
  return out.join("");
}

// The half-plane in front of the reader's right face, so a card coming out of the slot shows
// only the part that has left the reader.
function exitClip() {
  const a = at([FACE_X, -400, CARD_TOP]);
  const b = at([FACE_X, 400, CARD_TOP]);
  const [ux, uy] = k.axisVector(P, [1, 0, 0]);
  const s = 2000 / Math.hypot(ux, uy);
  return `M${fix(a[0])} ${fix(a[1])}L${fix(b[0])} ${fix(b[1])}L${fix(b[0] + ux * s)} ${fix(b[1] + uy * s)}L${fix(a[0] + ux * s)} ${fix(a[1] + uy * s)}Z`;
}

export function build({ fig = "Fig 1", id = "card-loop" } = {}) {
  const cards = CARDS.map((card, index) => {
    const [x, y] = homeOf(index);
    const moves = index >= START.length;
    return `<g data-card="${index}"${moves ? ' style="display:none"' : ""}>${cardSvg(index, x, y)}</g>`;
  });
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A punched-card loop machine on a base plate. Context cards lie in a row on a bed beside a ruler. A card reader, the model, rolls a read head over every card in the row and then punches one new card. The card runs down a lane to a gate. A tool call turns into a press, the harness, which runs the tool, punches a result card and slides both cards onto the end of the row. On the last lap the reader punches an answer, and the gate sends it on to an output tray.",
    body: [
      `<defs><clipPath id="${id}-exit"><path d="${exitClip()}"/></clipPath></defs>`,
      base(),
      reader(),
      pressBack(),
      rail(),
      `<g data-part="carriage">${carriage()}</g>`,
      bed(),
      `<g data-part="deck">${cards.slice(0, START.length).join("")}</g>`,
      `<g data-slot="back">${cards.slice(START.length, ANSWER_ID).join("")}</g>`,
      bedFront(),
      `<g data-part="head">${head()}</g>`,
      pressFront(),
      lane(),
      `<g clip-path="url(#${id}-exit)"><g data-slot="lane">${cards[ANSWER_ID]}</g></g>`,
      laneFront(),
    ],
  });

  const stage = stageHtml({
    svg,
    label: "The agentic loop as a card machine. Space plays or pauses. The right arrow key moves one step forward and the left arrow key one step back.",
    role: "slider",
    attrs: `aria-valuemin="1" aria-valuemax="${STEPS.length + 1}" aria-valuenow="1" aria-valuetext="${statusOf(STEPS[0]).replace(/"/g, "&quot;")}"`,
  });

  const controls = `<div class="fig-controls" role="group" aria-label="Animation controls"><button class="btn" type="button" data-act="play">Pause</button><button class="btn" type="button" data-act="replay">Replay</button><button class="btn" type="button" data-act="step">Step</button></div>
<p class="cl-status" data-status>${statusOf(STEPS[0])}</p>`;

  const html = plate({
    id,
    fig,
    title: "The agentic loop",
    hint: "Follow one lap",
    readout: sayOf(STEPS[0], START.length),
    keys: [
      { mark: "lit", label: "The card that moves now" },
      { mark: "raised", label: "Cards on the bed: the context" },
      { mark: "edge", label: "Card reader: the model" },
      { mark: "flat", label: "Press: the harness, which runs the tool" },
    ],
    caption:
      "Each lap, the model reads every card in the context and writes one card. For a tool call, the harness runs the tool and adds the call and the result to the context. The context grows on every lap. The model ends the loop when it writes an answer instead of a tool call. Token counts are illustrative.",
    stage,
    controls,
  });

  const script = `
const P = ${JSON.stringify(P)};
const START = ${JSON.stringify(START)}, LAPS = ${JSON.stringify(LAPS)}, ANSWER = ${JSON.stringify(ANSWER)};
const plain = ${plain.toString()};
const columnsOf = ${columnsOf.toString()};
${cardsOf.toString()}
${stepsOf.toString()}
${tokensOf.toString()}
${sayOf.toString()}
${statusOf.toString()}
const CARD = ${JSON.stringify(CARD)}, PITCH = ${PITCH}, FIRST_X = ${FIRST_X}, BED_Y = ${BED_Y}, LANE_Y = ${LANE_Y};
const DIE_X = ${DIE_X}, MAG_X = ${MAG_X}, TRAY_X = ${TRAY_X}, EXIT_IN = ${EXIT_IN}, EXIT_OUT = ${EXIT_OUT}, HOME = ${HOME}, STROKE = ${STROKE};
const PIVOT = ${JSON.stringify(PIVOT)}, FLAP_L = ${FLAP_L}, FLAP_Z = ${JSON.stringify(FLAP_Z)};
const slotX = ${slotX.toString()};
${flapAt.toString()}
const CARDS = cardsOf();
const ANSWER_ID = CARDS.length - 1;
const STEPS = [...stepsOf(), { kind: "end", lap: LAPS.length + 1, deck: START.length + 2 * LAPS.length, card: ANSWER_ID, answer: true }];
const LAST = STEPS.length - 1;
const ANSWER_STEP = LAST - 1;
const homeOf = (index) => (index === ANSWER_ID ? [TRAY_X, LANE_Y] : [slotX(index), BED_Y]);
const firstOf = CARDS.map((_, c) => STEPS.findIndex((st) => st.card === c));
const lastOf = CARDS.map((_, c) => { for (let s = ANSWER_STEP; s >= 0; s--) if (STEPS[s].card === c) return s; return -1; });

// Seconds per step. Reading takes longer as the deck grows.
const READ_EACH = 0.36, READ_BACK = 0.6, READ_PAUSE = 0.15;
const forwardOf = (st) => READ_EACH * st.deck + 0.35;
const DUR = STEPS.map((st) => ({
  start: 1.4,
  read: forwardOf(st) + READ_PAUSE + READ_BACK,
  write: st.answer ? 1.4 : 0.9,
  route: 1.9,
  run: 1.0,
  addCall: 0.55 + (DIE_X - slotX(st.card)) / 150,
  result: 1.45,
  addResult: 0.55 + (DIE_X - slotX(st.card)) / 150,
  answer: 1.9,
  end: 5.2,
})[st.kind]);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
// Eased start and stop with an even speed between.
const glide = (v, a = 0.3) => {
  const p = clamp01(v), top = 1 / (1 - a);
  if (p < a) return (0.5 * top * p * p) / a;
  if (p > 1 - a) { const q = 1 - p; return 1 - (0.5 * top * q * q) / a; }
  return 0.5 * top * a + top * (p - a);
};
// The die: down fast, a short dwell, back up.
const stamp = (v) => { const p = clamp01(v); if (p < 0.28) return (p / 0.28) ** 2; if (p < 0.42) return 1; return 1 - smooth((p - 0.42) / 0.58); };

// Where card c is at step s, progress u.
function placeOf(c, s, u) {
  const st = STEPS[s];
  if (c < START.length) return { x: slotX(c), y: BED_Y, slot: "deck", show: 1 };
  if (s < firstOf[c]) return { show: 0 };
  const rest = { x: homeOf(c)[0], y: homeOf(c)[1], slot: c === ANSWER_ID ? "lane" : "back", show: 1 };
  if (st.kind === "end") return { ...rest, show: 1 - smooth((u - 0.82) / 0.18) };
  if (s > lastOf[c]) return rest;
  switch (st.kind) {
    case "write": {
      const v = st.answer ? glide((u - 0.4) / 0.6) : glide(u);
      return { x: EXIT_IN + (EXIT_OUT - EXIT_IN) * v, y: LANE_Y, slot: "lane", show: 1 };
    }
    case "route": {
      if (u < 0.72) return { x: EXIT_OUT + (DIE_X - EXIT_OUT) * glide(u / 0.72), y: LANE_Y, slot: "lane", show: 1 };
      return { x: DIE_X, y: LANE_Y + (BED_Y - LANE_Y) * glide((u - 0.72) / 0.28), slot: "back", show: 1 };
    }
    case "run":
      return { x: DIE_X, y: BED_Y, slot: "back", show: 1 };
    case "result":
      return { x: MAG_X + (DIE_X - MAG_X) * glide(u / 0.42), y: BED_Y, slot: "back", show: 1 };
    case "addCall":
    case "addResult":
      return { x: DIE_X + (slotX(c) - DIE_X) * glide(u), y: BED_Y, slot: "back", show: 1 };
    case "answer":
      return { x: EXIT_OUT + (TRAY_X - EXIT_OUT) * glide(u), y: LANE_Y, slot: "lane", show: 1 };
  }
  return rest;
}
// Read head x, and the card under it while it reads.
function headOf(s, u) {
  const st = STEPS[s];
  if (st.kind !== "read") return { x: HOME, card: -1 };
  const t = u * DUR[s], forward = forwardOf(st);
  const far = slotX(st.deck - 1) + CARD.w + 3;
  let x = far, reading = true;
  if (t <= forward) x = HOME + (far - HOME) * glide(t / forward, 0.12);
  else if (t > forward + READ_PAUSE) { x = far + (HOME - far) * glide((t - forward - READ_PAUSE) / READ_BACK); reading = false; }
  const index = Math.round((x - slotX(0) - CARD.w / 2) / PITCH);
  const card = reading && index >= 0 && index < st.deck && Math.abs(x - slotX(index) - CARD.w / 2) <= PITCH / 2 ? index : -1;
  return { x, card };
}
function ramOf(s, u) {
  const kind = STEPS[s].kind;
  if (kind === "run") return stamp((u - 0.12) / 0.76);
  if (kind === "result") return stamp((u - 0.46) / 0.54);
  return 0;
}
function flapOf(s, u) {
  const st = STEPS[s];
  if (s < ANSWER_STEP - 1) return 0;
  if (st.kind === "write") return 90 * smooth(u / 0.36);
  if (st.kind === "end") return 90 * (1 - smooth((u - 0.82) / 0.18));
  return 90;
}
function litOf(s, u, head) {
  const st = STEPS[s];
  if (st.kind === "start") return START.length - 1;
  if (st.kind === "read") return head.card;
  return st.card;
}
// Cards that rest in the context now.
function deckOf(s, u) {
  let n = START.length;
  for (let c = START.length; c < ANSWER_ID; c++) if (s > lastOf[c] || (s === lastOf[c] && u >= 1)) n++;
  return n;
}

const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const slots = { deck: part("deck"), back: svg.querySelector('[data-slot="back"]'), lane: svg.querySelector('[data-slot="lane"]') };
const nodes = CARDS.map((_, c) => svg.querySelector('[data-card="' + c + '"]'));
const solids = nodes.map((node) => node.querySelector(".iso-solid"));
const carriage = part("carriage"), headPart = part("head"), ram = part("ram"), flap = part("flap"), gate = part("gate");
const gateSlots = { back: svg.querySelector('[data-slot="gate-back"]'), front: svg.querySelector('[data-slot="gate-front"]') };
let gateAt = "front";
const lapDigit = svg.querySelector("[data-lap]");
const deckDigits = [...svg.querySelectorAll("[data-deck-digit]")];
const status = root.querySelector("[data-status]");
const playButton = root.querySelector('[data-act="play"]');
const say = readoutOf(root);
const where = nodes.map((node) => (node.parentNode === slots.back ? "back" : node.parentNode === slots.lane ? "lane" : "deck"));
let lastFlap = 0, lastStep = -1;

function pose(s, u) {
  const head = headOf(s, u);
  const lit = litOf(s, u, head);
  CARDS.forEach((_, c) => {
    const place = placeOf(c, s, u);
    const node = nodes[c];
    if (!place.show) { if (node.style.display !== "none") node.style.display = "none"; return; }
    if (node.style.display === "none") node.style.display = "";
    node.style.opacity = place.show < 1 ? String(place.show) : "";
    if (place.slot !== where[c]) { slots[place.slot].appendChild(node); where[c] = place.slot; }
    const [hx, hy] = homeOf(c);
    const dx = place.x - hx, dy = place.y - hy;
    node.setAttribute("transform", dx || dy ? translateAlong(P, [dx, dy, 0]) : "");
    solids[c].toggleAttribute("data-lit", c === lit);
  });
  const move = head.x === HOME ? "" : translateAlong(P, [head.x - HOME, 0, 0]);
  carriage.setAttribute("transform", move);
  headPart.setAttribute("transform", move);
  const press = ramOf(s, u);
  ram.setAttribute("transform", press ? translateAlong(P, [0, 0, -STROKE * press]) : "");
  // The answer card runs past in front of the gate; a call card stops behind it.
  const side = s >= ANSWER_STEP ? "back" : "front";
  if (side !== gateAt) { gateSlots[side].appendChild(gate); gateAt = side; }
  const angle = Math.round(flapOf(s, u) * 2) / 2;
  if (angle !== lastFlap) { flap.innerHTML = flapAt(angle); lastFlap = angle; }
  const st = STEPS[s];
  const deck = deckOf(s, u);
  const shown = st.kind === "end" ? STEPS[ANSWER_STEP] : st;
  if (lapDigit.textContent !== String(st.lap)) lapDigit.textContent = String(st.lap);
  const digits = String(deck).padStart(2, "0");
  deckDigits.forEach((node, index) => { if (node.textContent !== digits[index]) node.textContent = digits[index]; });
  say(sayOf(shown, deck));
  if (s !== lastStep) {
    lastStep = s;
    const text = statusOf(shown);
    status.textContent = text;
    stage.setAttribute("aria-valuenow", String(s + 1));
    stage.setAttribute("aria-valuetext", text);
  }
}

let s = 0, u = 0, playing = !STILL.matches, stopAt = -1;
if (STILL.matches) { s = ANSWER_STEP; u = 1; }
const label = () => { playButton.textContent = playing ? "Pause" : "Play"; };
const loop = figureLoop(stage, (dt, calm) => {
  if (playing || stopAt >= 0) {
    u += dt / (calm ? 1.6 : DUR[s]);
    if (u >= 1) {
      if (stopAt >= 0 && s >= stopAt) { u = 1; stopAt = -1; }
      else if (playing || stopAt >= 0) { s = s === LAST ? 0 : s + 1; u = 0; }
      else u = 1;
    }
  }
  pose(s, calm ? 1 : u);
  return playing || stopAt >= 0;
});
function hold() { playing = false; label(); }
function step() {
  hold();
  if (STEPS[s].kind === "end" || (s === ANSWER_STEP && u >= 1)) { s = 0; u = 1; stopAt = -1; pose(s, u); return; }
  if (stopAt >= 0) { if (stopAt < ANSWER_STEP) stopAt += 1; }
  else if (u > 0 && u < 1) stopAt = s;
  else { if (u >= 1) { s += 1; u = 0; } stopAt = s; }
  if (STILL.matches) { s = stopAt; u = 1; stopAt = -1; pose(s, u); return; }
  loop.kick();
}
function back() {
  hold();
  stopAt = -1;
  s = Math.max(0, s - 1);
  u = 1;
  pose(s, u);
}
function replay() { s = 0; u = 0; stopAt = -1; playing = true; label(); pose(s, STILL.matches ? 1 : u); loop.kick(); }
function toggle() {
  if (playing) { hold(); return; }
  stopAt = -1;
  if (STEPS[s].kind === "end" && u >= 1) { s = 0; u = 0; }
  playing = true; label(); loop.kick();
}
root.querySelector('[data-act="play"]').addEventListener("click", toggle);
root.querySelector('[data-act="replay"]').addEventListener("click", replay);
root.querySelector('[data-act="step"]').addEventListener("click", step);
stage.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Spacebar") toggle();
  else if (event.key === "ArrowRight") step();
  else if (event.key === "ArrowLeft") back();
  else if (event.key === "Home") replay();
  else if (event.key === "End") { hold(); stopAt = -1; s = ANSWER_STEP; u = 1; pose(s, u); }
  else return;
  event.preventDefault();
});
label();
pose(s, u);
`;

  const css = `
[data-fig="${id}"] .cl-holes{fill:var(--anatomy-lo);stroke:none}
[data-fig="${id}"] .iso-solid[data-lit] .cl-holes{fill:var(--anatomy-hi)}
[data-fig="${id}"] [data-card] .iso-solid[data-lit]>.iso-edge{stroke-width:1.15px}
[data-fig="${id}"] .cl-status{margin:12px 0 0;min-height:3.2em;color:var(--anatomy-strong);font-size:15px;line-height:1.55;text-wrap:pretty}
@media (max-width:560px){[data-fig="${id}"] .cl-status{font-size:14.5px}}
`;
  return { html, css, script, needs: [] };
}
