// Fig: tokenization as a typesetter's bench. A paper strip on two spools at the back carries the
// text. The type case in the middle is the vocabulary: one numbered compartment per piece, and a
// spare box for pieces the vocabulary lacks. The composing stick at the front holds one slug per
// token, in order, with the newest slug lit. A counter on the bench shows the token count.
// Two variants share the machine: "talk" cuts what the reader types with the site's teaching
// tokenizer; "ids" sets the flagship's fixed examples, each slug showing its token ID.
import * as k from "../../kit/iso-kit.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { trainTokenizer, money, EXAMPLE_PRICE, tokenizerSource } from "../_shared/toy-tokenizer.mjs";
import { PRESETS, EXAMPLES, STICK_MAX, USES, CASE_COLS, CASE_ROWS, VOCAB_IDS, shown, costOf, extraOf, slugWidth, lineOf, cellOfId, placeIds } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 322;
const AZIMUTH = 62;

const PLATE = { x: -18, y: -110, w: 370, d: 138, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;

// Composing stick, along x at the front.
const BED = { x: -6, y: -5, w: 346, d: 22, r: 1.5 };
const BED_TOP = 4;
const XS = 2; // the head of the line
const MEASURE = 312; // room for slugs
const FOLLOW_W = 14;
const RULER = { x: 4, y: 10.6, w: 330, d: 4.8, r: 0.8 };

// Slugs: built with the left edge at x = 0, the back on the back plate, the foot on the bed.
const TYPE = { pitch: 5.2, font: 8.4, margin: 1.4, y: -2, d: 10, z: BED_TOP, r: 0.5 };
const SLUG = {
  talk: { ...TYPE, h: 13.4, base: 9.1, nick: 2.0, idPitch: 0, idFont: 0, idBase: 0 },
  ids: { ...TYPE, h: 18.4, base: 8.5, nick: 1.6, idPitch: 3.0, idFont: 4.8, idBase: 15.1 },
};

// Type case in the middle: a frame with a well of 32 × 8 compartments.
const CASE = { x: 6, y: -74, w: 268, d: 60, r: 2 };
const CASE_TOP = 8;
const FLOOR = 2.5;
const WELL = { x: 12, y: -70, w: 256, d: 52 };
const CELL_W = WELL.w / CASE_COLS;
const CELL_D = WELL.d / CASE_ROWS;
const SPARE = { x: 282, y: -54, w: 22, d: 26, r: 1.2 };
const SPARE_WELL = { x: 284.6, y: -51.4, w: 16.8, d: 20.8 };

// Counter at the back right, its windows on the front face.
const COUNTER = { x: 310, y: -68, w: 32, d: 18, r: 1.5 };
const COUNTER_H = 23;

// Paper strip on two spools at the back. It runs right to left, so a new text arrives start first.
const PAPER = { x: -4, y: -87, w: 286, d: 1, r: 0.3 };
const PAPER_Z = [3.5, 22];
const COPY_FACE = PAPER.y + PAPER.d;
const COPY_WINDOW = [8, 278]; // the strip between the spools, in world x
const COPY_FONT = 6.4;
const CHANNEL = { x: 6, y: -89.2, w: 270, d: 5.4, r: 1 };
const SPOOL_R = 7.5;
const SPOOLS = [
  [-4, PAPER.y + PAPER.d / 2 - SPOOL_R],
  [282, PAPER.y + PAPER.d / 2 - SPOOL_R],
];

const fx = (n) => Math.round(n * 100) / 100;
const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [SPOOLS[0][0] - 9, SPOOLS[0][1] - 9, 27],
    [SPOOLS[1][0] + 9, SPOOLS[1][1] - 9, 27],
    [WELL.x, WELL.y, 47],
  ],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: AZIMUTH },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const quad = (points) => k.pathOf(points.map(at), true);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// One slug, built at the head of the stick. Node draws the first line; the page draws the rest.
function slugOf(piece, S, P) {
  const f = (n) => Math.round(n * 100) / 100;
  const safe = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const chars = Array.from(piece.show);
  const idText = piece.id === null || piece.id === undefined || !S.idPitch ? "" : String(piece.id);
  const w = slugWidth(chars.length, idText.length, S);
  const plan = { x: 0, y: S.y, w, d: S.d, r: S.r };
  const nick = k.lineSvg(k.sideSeam(plan, S.z + S.nick, P, 2), { tone: "faint" });
  const body = k.solidSvg(k.slabOf(plan, S.z, S.h, P, 2, 0.35), { tone: "hi", inner: nick });
  const left = (w - chars.length * S.pitch) / 2;
  const xs = [];
  let glyphs = "";
  let space = "";
  chars.forEach((ch, index) => {
    const cx = left + (index + 0.5) * S.pitch;
    if (ch === "␣") {
      const a = S.pitch * 0.3;
      const b = S.base - 0.2;
      space += `M${f(cx - a)} ${f(b - S.font * 0.24)}V${f(b)}H${f(cx + a)}V${f(b - S.font * 0.24)}`;
    } else {
      xs.push(f(cx));
      glyphs += ch;
    }
  });
  const parts = [];
  if (glyphs) parts.push(`<text class="tc-type" x="${xs.join(" ")}" y="${S.base}" font-size="${S.font}" text-anchor="middle">${safe(glyphs)}</text>`);
  if (space) parts.push(`<path class="tc-space" d="${space}"/>`);
  if (idText) {
    const from = (w - idText.length * S.idPitch) / 2;
    const ids = Array.from(idText, (_, index) => f(from + (index + 0.5) * S.idPitch)).join(" ");
    parts.push(`<text class="tc-num" x="${ids}" y="${S.idBase}" font-size="${S.idFont}" text-anchor="middle">${idText}</text>`);
  }
  if (!piece.known) parts.push(`<path class="iso-line tc-spare" data-tone="mid" data-dashed="" d="M1 1H${f(w - 1)}V${f(S.h - S.nick - 0.9)}H1Z"/>`);
  const face = k.sideMatrix([0, S.y + S.d], S.z + S.h, P, "left");
  return { w, svg: `${body}<g transform="${face}">${parts.join("")}</g>` };
}

// The pieces as a plain list under the drawing: shown on narrow screens, where the slug type gets
// small, and read by screen readers everywhere.
function chipsHtml(pieces, withIds) {
  const safe = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return pieces
    .map((piece, index) => `<li data-tone="${index % 2 ? "b" : "a"}"${piece.known ? "" : " data-spare"}>${safe(piece.show)}${withIds ? `<span>${piece.id}</span>` : ""}</li>`)
    .join("");
}

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Label plate in the free corner between the counter and the stick.
  const label = { x: 310, y: -40, w: 30, d: 12, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[-36.6, 20], [-33.8, 14], [-31, 17]].map(([y, w]) => k.lineOnTop([314.4, y], [314.4 + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([label.x + 2.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 2.2, label.y + label.d / 2, 0.8])], { size: 0.42 }));
  return out.join("");
}

// A spool standing on the bench: base boss, lower flange, paper roll, upper flange and hub.
function spoolLow([x, y]) {
  return [
    S(k.cylinder(x, y, 4.2, 0, 1.6, P, 24), { tone: "lo" }),
    S(k.cylinder(x, y, 9, 1.6, 1.9, P, 40, 0.3), { tone: "mid" }),
    S(k.cylinder(x, y, SPOOL_R, PAPER_Z[0], PAPER_Z[1] - PAPER_Z[0], P, 40), { tone: "mid", crease: "none", inner: L([8, 14].map((z) => k.sideArc(x, y, SPOOL_R, z, P, 24)).join(""), { tone: "faint" }) }),
  ].join("");
}
function spoolHigh([x, y]) {
  return [
    S(k.cylinder(x, y, 9, PAPER_Z[1], 1.9, P, 40, 0.3), { tone: "mid" }),
    S(k.cylinder(x, y, 2.6, PAPER_Z[1] + 1.9, 2.6, P, 20, 0.3), { tone: "mid" }),
    L(k.ring(x, y, 6.4, PAPER_Z[1] + 1.9, P, 32), { tone: "faint" }),
  ].join("");
}
// The mark on a spool's flange that turns while the strip feeds.
const MARK_Z = PAPER_Z[1] + 1.9;
function spoolMark(x, y, angle) {
  return k.lineOnTop([x + 2.6 * Math.cos(angle), y + 2.6 * Math.sin(angle)], [x + 6.4 * Math.cos(angle), y + 6.4 * Math.sin(angle)], MARK_Z, P);
}

function feed(id, text) {
  const out = [];
  for (const spool of SPOOLS) out.push(spoolLow(spool));
  out.push(S(k.slabOf(CHANNEL, 0, PAPER_Z[0], P, 3, 0.4), { tone: "mid" }));
  out.push(D([CHANNEL.x + 4, CHANNEL.x + CHANNEL.w / 2, CHANNEL.x + CHANNEL.w - 4].map((x) => at([x, CHANNEL.y + CHANNEL.d - 1, PAPER_Z[0]])), { size: 0.4 }));
  out.push(S(k.slabOf(PAPER, PAPER_Z[0], PAPER_Z[1] - PAPER_Z[0], P, 2), { tone: "lo", crease: "faint" }));
  // The copy: printed on the strip's front face, clipped to the strip between the spools.
  const face = k.sideMatrix([0, COPY_FACE], PAPER_Z[1], P, "left");
  const top = 2.2;
  const bottom = PAPER_Z[1] - PAPER_Z[0] - 1.2;
  out.push(`<defs><clipPath id="${id}-copy"><path d="M${COPY_WINDOW[0]} ${top}H${COPY_WINDOW[1]}V${bottom}H${COPY_WINDOW[0]}Z"/></clipPath><filter id="${id}-gray"><feColorMatrix type="saturate" values="0"/></filter></defs>`);
  out.push(`<g transform="${face}"><g clip-path="url(#${id}-copy)" data-part="copy"><text class="tc-copy" x="${COPY_WINDOW[0] + 3}" y="${fx((PAPER_Z[1] - PAPER_Z[0]) * 0.56)}" font-size="${COPY_FONT}" filter="url(#${id}-gray)">${esc(text)}</text></g></g>`);
  for (const spool of SPOOLS) out.push(spoolHigh(spool));
  out.push(`<g data-part="marks">${L(SPOOLS.map(([x, y]) => spoolMark(x, y, 0.6)).join(""), { tone: "mid" })}</g>`);
  return out.join("");
}

// The type case: the frame, then the compartments row by row from the back, so each row's
// front wall hides the floor behind it, then the divider tops.
function typeCase(labels) {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CASE, 3), 0, 2, P)}" style="opacity:.18"/>`];
  out.push(S(k.slabOf(CASE, 0, CASE_TOP, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CASE, 3.2, P, 4), { tone: "faint" }) }));
  for (let row = 0; row < CASE_ROWS; row++) {
    const y0 = WELL.y + row * CELL_D;
    const y1 = y0 + CELL_D;
    let floors = "";
    let backs = "";
    let sides = "";
    let text = "";
    for (let col = 0; col < CASE_COLS; col++) {
      const x0 = WELL.x + col * CELL_W;
      const x1 = x0 + CELL_W;
      floors += quad([[x0, y0, FLOOR], [x1, y0, FLOOR], [x1, y1, FLOOR], [x0, y1, FLOOR]]);
      backs += quad([[x0, y0, CASE_TOP], [x1, y0, CASE_TOP], [x1, y0, FLOOR], [x0, y0, FLOOR]]);
      sides += quad([[x0, y0, CASE_TOP], [x0, y1, CASE_TOP], [x0, y1, FLOOR], [x0, y0, FLOOR]]);
      const label = labels[row * CASE_COLS + col];
      if (label !== undefined) {
        text += `<text class="tc-cell" transform="${k.sideMatrix([x0, y0], CASE_TOP, P, "left")}" x="${fx(CELL_W / 2)}" y="2.5" font-size="2.1" text-anchor="middle">${label}</text>`;
      }
    }
    out.push(`<path class="tc-floor" d="${floors}"/><path class="iso-shade" data-shade="2" d="${backs}"/>${text}<path class="iso-shade" data-shade="0" d="${sides}"/>`);
  }
  const grid = [];
  for (let row = 1; row < CASE_ROWS; row++) grid.push(k.lineOnTop([WELL.x, WELL.y + row * CELL_D], [WELL.x + WELL.w, WELL.y + row * CELL_D], CASE_TOP, P));
  for (let col = 1; col < CASE_COLS; col++) grid.push(k.lineOnTop([WELL.x + col * CELL_W, WELL.y], [WELL.x + col * CELL_W, WELL.y + WELL.d], CASE_TOP, P));
  out.push(L(grid.join(""), { tone: "lo" }));
  out.push(L(k.planOutline({ ...WELL, r: 0 }, CASE_TOP, P, 1), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(CASE, 1.6), CASE_TOP, P, 4), { tone: "faint" }));
  out.push(`<path class="iso-line tc-pick" data-tone="hi" data-part="pick" d=""/>`);
  return out.join("");
}

function spareBox() {
  const out = [S(k.slabOf(SPARE, 0, CASE_TOP, P, 3, 0.6), { tone: "mid" })];
  const { x, y, w, d } = SPARE_WELL;
  out.push(`<path class="tc-floor" d="${quad([[x, y, FLOOR], [x + w, y, FLOOR], [x + w, y + d, FLOOR], [x, y + d, FLOOR]])}"/>`);
  out.push(`<path class="iso-shade" data-shade="2" d="${quad([[x, y, CASE_TOP], [x + w, y, CASE_TOP], [x + w, y, FLOOR], [x, y, FLOOR]])}"/>`);
  out.push(`<path class="iso-shade" data-shade="0" d="${quad([[x, y, CASE_TOP], [x, y + d, CASE_TOP], [x, y + d, FLOOR], [x, y, FLOOR]])}"/>`);
  out.push(L(k.planOutline({ ...SPARE_WELL, r: 0 }, CASE_TOP, P, 1), { tone: "mid" }));
  // Blank slugs lying in the box.
  for (const [dx, dy] of [[3, 4], [9.6, 7]]) out.push(S(k.slabOf({ x: x + dx, y: y + dy, w: 5.2, d: 9, r: 0.4 }, FLOOR, 2.6, P, 2), { tone: "mid" }));
  return out.join("");
}

const COUNTER_FACE = COUNTER.y + COUNTER.d;
const DIGIT = { w: 5.4, h: 8.6, gap: 0.8, font: 7, z: 16.8 };
function counter() {
  const out = [S(k.slabOf(k.insetPlan(COUNTER, -1.4), 0, 2, P, 4, 0.4), { tone: "lo" })];
  out.push(S(k.slabOf(COUNTER, 2, COUNTER_H - 2, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(COUNTER, 6.5, P, 4), { tone: "faint" }) }));
  const face = k.sideMatrix([COUNTER.x, COUNTER_FACE], DIGIT.z, P, "left");
  const span = 3 * DIGIT.w + 2 * DIGIT.gap;
  const left = (COUNTER.w - span) / 2;
  const windows = [0, 1, 2].map((i) => `M${fx(left + i * (DIGIT.w + DIGIT.gap))} 0h${DIGIT.w}v${DIGIT.h}h${-DIGIT.w}Z`).join("");
  const digits = [0, 1, 2].map((i) => `<text class="tc-digit" data-digit="${i}" x="${fx(left + i * (DIGIT.w + DIGIT.gap) + DIGIT.w / 2)}" y="${fx(DIGIT.h - 1.5)}" font-size="${DIGIT.font}" text-anchor="middle">0</text>`).join("");
  out.push(`<g transform="${face}"><path class="tc-window" d="${windows}"/>${digits}${L(windows, { tone: "lo" })}${L(`M${fx(left - 1.2)} -1.2h${fx(span + 2.4)}v${fx(DIGIT.h + 2.4)}h${fx(-span - 2.4)}Z`, { tone: "faint" })}<text class="iso-face-text" x="${fx(COUNTER.w / 2)}" y="${fx(DIGIT.h + 5.6)}" font-size="3" text-anchor="middle" data-tone="mid">TOKENS</text></g>`);
  out.push(D([at([COUNTER.x + 2.4, COUNTER_FACE, 4.4]), at([COUNTER.x + COUNTER.w - 2.4, COUNTER_FACE, 4.4])], { size: 0.45 }));
  const knob = [COUNTER.x + COUNTER.w - 7, COUNTER.y + 7];
  out.push(S(k.cylinder(knob[0], knob[1], 3, COUNTER_H, 3.4, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(knob[0], knob[1], 3, COUNTER_H, COUNTER_H + 3.4, 22, P), { tone: "lo" }));
  out.push(D([at([knob[0], knob[1], COUNTER_H + 3.4])], { size: 0.5, tone: "hi" }));
  out.push(L(k.planOutline({ x: COUNTER.x + 3, y: COUNTER.y + 3, w: 10, d: 8, r: 1 }, COUNTER_H, P, 3), { tone: "faint" }));
  return out.join("");
}

function stickBack(SL) {
  const top = SL.z + SL.h + 2.5;
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BED, 2), 0, 2, P)}" style="opacity:.2"/>`];
  out.push(S(k.slabOf(BED, 0, BED_TOP, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BED, 1.6, P, 4), { tone: "faint" }) }));
  const back = { x: BED.x, y: BED.y, w: BED.w, d: 3, r: 0.5 };
  out.push(S(k.slabOf(back, BED_TOP, top - BED_TOP, P, 2, 0.4), { tone: "mid" }));
  out.push(D([BED.x + 12, 110, 220, BED.x + BED.w - 4].map((x) => at([x, back.y + 1.5, top])), { size: 0.42 }));
  // Ruler strip: one tick per character cell, a major tick every ten.
  out.push(S(k.slabOf(RULER, BED_TOP, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(XS, XS + MEASURE, SL.pitch, 10, RULER.y + 0.02, BED_TOP + 0.6, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([RULER.x + 0.9, RULER.y + 2.4, BED_TOP + 0.6]), at([RULER.x + RULER.w - 0.9, RULER.y + 2.4, BED_TOP + 0.6])], { size: 0.38 }));
  // Head knee at the left end.
  const knee = { x: BED.x, y: -2, w: XS - BED.x, d: 13, r: 0.8 };
  out.push(S(k.slabOf(knee, BED_TOP, top - BED_TOP, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([BED.x + 4, 4, top])], { size: 0.45 }));
  return out.join("");
}

// The follower rides on the bed behind the last slug; its window shows the pieces that don't fit.
function follower(SL) {
  const top = SL.z + SL.h + 0.6;
  const plan = { x: 0, y: -2, w: FOLLOW_W, d: 12, r: 0.8 };
  const out = [S(k.slabOf(plan, BED_TOP, top - BED_TOP, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, BED_TOP + 2, P, 3), { tone: "faint" }) })];
  const face = k.sideMatrix([0, 10], top, P, "left");
  out.push(`<g transform="${face}"><path class="tc-window" d="M1.4 2.4H12.6V9H1.4Z"/><text class="tc-digit" data-part="overflow" x="7" y="7.6" font-size="5" text-anchor="middle"></text>${L("M1.4 2.4H12.6V9H1.4Z", { tone: "lo" })}</g>`);
  out.push(S(k.cylinder(7, 4, 2.4, top, 3.2, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(7, 4, 2.4, top, top + 3.2, 18, P), { tone: "lo" }));
  return out.join("");
}

// Model output for one variant: the pieces to set, as the page will compute them.
function piecesOf(variant, index, tokenizer) {
  if (variant === "ids") return EXAMPLES[index].pieces.map((piece) => ({ show: shown(piece.text), id: piece.id, known: true, byte: !!piece.byte }));
  return tokenizer.encode(PRESETS[index].text).map((piece) => ({ show: shown(piece), id: tokenizer.idOf(piece), known: tokenizer.known(piece) }));
}

export function build({ fig = "Fig 1", id = "typecase", variant = "talk" } = {}) {
  const ids = variant === "ids";
  const SL = SLUG[ids ? "ids" : "talk"];
  const tokenizer = ids ? null : trainTokenizer();
  const placed = placeIds(EXAMPLES.flatMap((example) => example.pieces.map((piece) => piece.id)), CASE_COLS * CASE_ROWS, VOCAB_IDS);
  // Compartment labels: the talk case is numbered 0 to 246, one per vocabulary entry; the ids
  // case shows the 23 IDs its examples use.
  const labels = {};
  if (ids) for (const [tokenId, cell] of Object.entries(placed)) labels[cell] = tokenId;
  else for (let n = 0; n < tokenizer.vocabularySize; n++) labels[n] = n;

  // The resting line for the first sample, drawn by the build.
  const first = piecesOf(variant, 0, tokenizer);
  const built = first.map((piece) => slugOf(piece, SL, P));
  const line = lineOf(built.map((slug) => slug.w), XS, MEASURE, STICK_MAX);
  const slugs = line.xs
    .map((x, index) => {
      const last = index === line.xs.length - 1;
      return `<g class="tc-slug" data-tone="${index % 2 ? "b" : "a"}"${last ? " data-new" : ""} transform="${k.translateAlong(P, [x, 0, 0])}">${last ? built[index].svg.replace('class="iso-solid"', 'class="iso-solid" data-lit=""') : built[index].svg}</g>`;
    })
    .join("");
  const count = first.length;
  const overflow = count - line.xs.length;
  const text = ids ? EXAMPLES[0].text : PRESETS[0].text;

  const counterSvg = counter().replace(/data-digit="(\d)"([^>]*)>0</g, (match, digit, rest) => `data-digit="${digit}"${rest}>${String(count).padStart(3, "0")[Number(digit)]}<`);
  const followerSvg = follower(SL).replace("></text>", `>${overflow > 0 ? "+" + overflow : ""}</text>`);

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: ids
      ? "A typesetter's bench. A paper strip on two spools at the back carries a string. A type case in the middle has numbered compartments, one for each token ID. A composing stick at the front holds one metal slug per token, in order. Each slug shows its piece of text and its ID, and a counter shows the token count."
      : "A typesetter's bench. A paper strip on two spools at the back carries the text. A type case in the middle has one numbered compartment for each piece in the vocabulary, and a spare box holds pieces the vocabulary lacks. A composing stick at the front holds one metal slug per token, in order, and a counter shows the token count.",
    body: [
      bench(),
      feed(id, text),
      typeCase(labels),
      spareBox(),
      counterSvg,
      `<g data-part="rise"></g>`,
      stickBack(SL),
      `<g data-part="slugs">${slugs}</g>`,
      `<g data-part="follower" transform="${k.translateAlong(P, [line.end, 0, 0])}">${followerSvg}</g>`,
    ],
  });

  const readout = ids ? `${count} tokens · ids ${EXAMPLES[0].pieces.slice(0, 3).map((piece) => piece.id).join(" ")} …` : `${count} tokens · ${tokenizer.wordCount(text)} words`;
  const stage = stageHtml({
    svg,
    label: ids
      ? "Typesetter's bench. Press 1 to 4, or the arrow keys, to pick an example."
      : "Typesetter's bench. Press 1 to 4, or the arrow keys, to pick a sample. Type in the text field to set your own text.",
    role: "slider",
    attrs: `aria-valuemin="1" aria-valuemax="4" aria-valuenow="1" aria-valuetext="${esc(ids ? `${EXAMPLES[0].label}: ${count} tokens, IDs ${EXAMPLES[0].pieces.map((piece) => piece.id).join(", ")}` : `${PRESETS[0].label}: ${count} tokens, ${tokenizer.wordCount(text)} words`)}"`,
  });

  let controls;
  if (ids) {
    controls = `<div class="fig-controls" role="group" aria-label="Example">${EXAMPLES.map((example, index) => `<button class="btn" type="button" data-pick="${index}" aria-pressed="${index === 0}">${esc(example.label)}</button>`).join("")}</div>
<ol class="tc-chips" aria-label="Pieces and their IDs">${chipsHtml(first, true)}</ol>
<p class="sr-only" role="status" aria-live="polite" data-status></p>`;
  } else {
    const words = tokenizer.wordCount(text);
    const cost = (rate) => USES.map((use) => `<td data-cost="${rate}-${use.n}">${money(costOf(count, use.n, EXAMPLE_PRICE[rate]))}</td>`).join("");
    controls = `<label class="sr-only" for="${id}-text">Text to cut into tokens</label>
<input class="field tc-field" id="${id}-text" type="text" maxlength="240" spellcheck="false" autocomplete="off" autocapitalize="off" value="${esc(text)}">
<ol class="tc-chips" aria-label="Pieces">${chipsHtml(first, false)}</ol>
<div class="fig-controls" role="group" aria-label="Samples">${PRESETS.map((preset, index) => `<button class="btn" type="button" data-pick="${index}" aria-pressed="${index === 0}">${esc(preset.label)}</button>`).join("")}</div>
<p class="tc-note" data-note>${esc(PRESETS[0].note)}</p>
<dl class="fig-meter"><div><dt>Words</dt><dd data-out="words">${words}</dd></div><div><dt>Tokens</dt><dd data-out="tokens">${count}</dd></div><div><dt>Extra pieces</dt><dd data-out="extra">${extraOf(count, words)}</dd></div></dl>
<div class="tc-cost"><table><thead><tr><th scope="col"><span class="sr-only">Cost at the example rates</span></th>${USES.map((use) => `<th scope="col">${use.label}</th>`).join("")}</tr></thead><tbody><tr><th scope="row">To send this text<span>$${EXAMPLE_PRICE.input} per million tokens</span></th>${cost("input")}</tr><tr><th scope="row">To write this much<span>$${EXAMPLE_PRICE.output} per million tokens</span></th>${cost("output")}</tr></tbody></table></div>
<p class="sr-only" role="status" aria-live="polite" data-status></p>`;
  }

  const html = plate({
    id,
    fig,
    title: ids ? "Strings become token IDs" : "See the cut",
    hint: ids ? "Pick an example" : "Type, or pick a sample",
    readout,
    keys: ids
      ? [
          { mark: "lit", label: "Lit slug: the newest token" },
          { mark: "raised", label: "Slugs: one token each, with its ID" },
          { mark: "flat", label: "Type case: one numbered compartment per token ID" },
        ]
      : [
          { mark: "lit", label: "Lit slug: the newest token" },
          { mark: "raised", label: "Slugs: one token each, in two tones" },
          { mark: "flat", label: "Type case: the vocabulary, one compartment per piece" },
          { mark: "dashed", label: "Dashed slug: the vocabulary lacks this piece, but it is still one token" },
        ],
    caption: ids
      ? "This is a toy vocabulary. The boundaries and IDs are illustrative. An ID is an address in the vocabulary. It does not measure meaning. Different strings give very different token counts."
      : `The tokenizer cuts the text into pieces. Each piece is one token, and each token is one slug. The stick holds up to ${STICK_MAX} slugs. The window on its follower counts the rest. This page uses a small toy tokenizer that learned from English text. Costs use the site's example rates: $${EXAMPLE_PRICE.input} per million input tokens and $${EXAMPLE_PRICE.output} per million output tokens.`,
    stage,
    controls,
  });

  const LAYOUT = {
    XS,
    MEASURE,
    STICK_MAX,
    FOLLOW_W,
    COLS: CASE_COLS,
    WELL,
    CELL_W,
    CELL_D,
    CASE_TOP,
    SPARE_WELL,
    TRAVEL: SL.z + SL.h + 2.5 + 2.5,
    COPY_WINDOW,
    SPOOLS,
  };

  const script = `
const P = ${JSON.stringify(P)};
const SL = ${JSON.stringify(SL)};
const LAYOUT = ${JSON.stringify(LAYOUT)};
const VARIANT = ${JSON.stringify(ids ? "ids" : "talk")};
const PLACED = ${JSON.stringify(placed)};
const MARK_Z = ${MARK_Z};
${ids ? `const EXAMPLES = ${JSON.stringify(EXAMPLES)};` : `${tokenizerSource()}\nconst PRESETS = ${JSON.stringify(PRESETS)};\nconst USES = ${JSON.stringify(USES)};\nconst TOK = trainTokenizer();`}
const shown = ${shown.toString()};
const costOf = ${costOf.toString()};
const extraOf = ${extraOf.toString()};
${slugWidth.toString()}
${lineOf.toString()}
${slugOf.toString()}
${chipsHtml.toString()}
const spoolMark = ${spoolMarkSource()};
${LIVE}
`;

  const css = `
[data-fig="${id}"] .tc-type{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:500}
[data-fig="${id}"] .tc-num{fill:var(--anatomy-mid);font-family:var(--anatomy-mono)}
[data-fig="${id}"] .tc-space{fill:none;stroke:var(--anatomy-mid);stroke-width:.9px;stroke-linecap:round;stroke-linejoin:round}
[data-fig="${id}"] .tc-copy{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);white-space:pre}
[data-fig="${id}"] .tc-cell{fill:var(--anatomy-lo);font-family:var(--anatomy-mono)}
[data-fig="${id}"] .tc-digit{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-variant-numeric:tabular-nums}
[data-fig="${id}"] .tc-window{fill:var(--anatomy-shade-1);stroke:none}
[data-fig="${id}"] .tc-floor{fill:var(--anatomy-shade-1);stroke:none}
[data-fig="${id}"] .tc-pick{stroke-width:1.1px}
[data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-shade[data-shade="2"],[data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-shade[data-shade="3"]{fill:var(--anatomy-faint)}
[data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-shade[data-shade="0"],[data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-shade[data-shade="1"]{fill:var(--anatomy-lo)}
[data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-top{fill:var(--anatomy-shade-0)}
.iso[data-theme="dark"] [data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-top{fill:var(--anatomy-lo)}
.iso[data-theme="dark"] [data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-shade[data-shade="0"],.iso[data-theme="dark"] [data-fig="${id}"] .tc-slug[data-tone="b"]>.iso-solid:not([data-lit])>.iso-shade[data-shade="1"]{fill:var(--anatomy-top)}
[data-fig="${id}"] .tc-slug[data-new] .tc-type{fill:var(--anatomy-lit)}
[data-fig="${id}"] .tc-slug[data-new] .tc-space{stroke:var(--anatomy-lit)}
[data-fig="${id}"] .tc-field{margin:14px 0 0}
[data-fig="${id}"] .tc-note{min-height:1.6em;margin:10px 0 0;color:var(--anatomy-muted);font-size:14px;line-height:1.5}
[data-fig="${id}"] .tc-cost{margin:14px 0 0;overflow-x:auto}
[data-fig="${id}"] .tc-cost table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.35}
[data-fig="${id}"] .tc-cost th,[data-fig="${id}"] .tc-cost td{padding:8px 10px;border:1px solid var(--anatomy-faint);background:var(--anatomy-card);vertical-align:top}
[data-fig="${id}"] .fig-meter{grid-template-columns:repeat(3,minmax(0,1fr))}
[data-fig="${id}"] .tc-chips{display:flex;flex-wrap:wrap;gap:4px;margin:12px 0 0;padding:0;list-style:none}
[data-fig="${id}"] .tc-chips li{margin:0;padding:3px 7px;font:13px/1.4 var(--anatomy-mono);color:var(--anatomy-strong);background:var(--anatomy-card);box-shadow:inset 0 0 0 1px var(--anatomy-lo);white-space:pre}
[data-fig="${id}"] .tc-chips li[data-tone="b"]{background:var(--anatomy-faint)}
[data-fig="${id}"] .tc-chips li[data-spare]{box-shadow:none;outline:1px dashed var(--anatomy-mid);outline-offset:-1px}
[data-fig="${id}"] .tc-chips li span{margin-left:7px;color:var(--anatomy-muted);font-size:11px}
@media (min-width:561px){[data-fig="${id}"] .tc-chips{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
[data-fig="${id}"] .tc-cost thead th{font:10px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);text-align:right}
[data-fig="${id}"] .tc-cost tbody th{font:10px/1.3 var(--anatomy-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted);text-align:left;font-weight:400;white-space:normal}
[data-fig="${id}"] .tc-cost tbody th span{display:block;margin-top:3px;letter-spacing:.02em;text-transform:none}
[data-fig="${id}"] .tc-cost td{color:var(--anatomy-strong);font:15px/1.3 var(--anatomy-mono);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
@media (max-width:560px){[data-fig="${id}"] .tc-cost th,[data-fig="${id}"] .tc-cost td{padding:7px 6px}[data-fig="${id}"] .tc-cost td{font-size:13px}}
`;
  return { html, css, script, needs: [] };
}

function spoolMarkSource() {
  return `(x, y, angle) => lineOnTop([x + 2.6 * Math.cos(angle), y + 2.6 * Math.sin(angle)], [x + 6.4 * Math.cos(angle), y + 6.4 * Math.sin(angle)], MARK_Z, P)`;
}

// The page's live code: the slugs fly from the case to the stick, the follower and the counter
// follow them, and the strip feeds in a new text.
const LIVE = String.raw`
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const part = (name) => svg.querySelector('[data-part="' + name + '"]');
const riseLayer = part("rise");
const slugLayer = part("slugs");
const followerEl = part("follower");
const overflowEl = part("overflow");
const pickEl = part("pick");
const copyEl = part("copy");
const marksEl = part("marks");
const digits = [...svg.querySelectorAll("[data-digit]")];
const buttons = [...root.querySelectorAll("[data-pick]")];
const field = root.querySelector(".tc-field");
const note = root.querySelector("[data-note]");
const status = root.querySelector("[data-status]");
const chipsEl = root.querySelector(".tc-chips");
const out = (name) => root.querySelector('[data-out="' + name + '"]');
const say = readoutOf(root);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const f2 = (n) => Math.round(n * 100) / 100;

// Where a piece lives in the case: its compartment, or the spare box when the case lacks it.
function homeOf(piece) {
  if (!piece.known) {
    const w = LAYOUT.SPARE_WELL;
    return { x: w.x + w.w / 2, y: w.y + w.d / 2, spare: true };
  }
  const index = VARIANT === "ids" ? PLACED[piece.id] : piece.id;
  const row = Math.floor(index / LAYOUT.COLS);
  const col = index % LAYOUT.COLS;
  return { x: LAYOUT.WELL.x + (col + 0.5) * LAYOUT.CELL_W, y: LAYOUT.WELL.y + (row + 0.5) * LAYOUT.CELL_D, col, row };
}
function cellOutline(home) {
  if (home.spare) {
    const w = LAYOUT.SPARE_WELL;
    return onTop([[w.x, w.y], [w.x + w.w, w.y], [w.x + w.w, w.y + w.d], [w.x, w.y + w.d]], LAYOUT.CASE_TOP, P, true);
  }
  const x0 = LAYOUT.WELL.x + home.col * LAYOUT.CELL_W;
  const y0 = LAYOUT.WELL.y + home.row * LAYOUT.CELL_D;
  return onTop([[x0, y0], [x0 + LAYOUT.CELL_W, y0], [x0 + LAYOUT.CELL_W, y0 + LAYOUT.CELL_D], [x0, y0 + LAYOUT.CELL_D]], LAYOUT.CASE_TOP, P, true);
}

// The slugs on the bench, in token order. Each one flies in (from the case) or out (back to it).
let slugs = [];
let leaving = [];
let clock = 0;
let total = 0;
let words = 0;
let shownCount = 0;
let overflowAt = [];
let overflowCount = 0;
let followerX = 0;
let followerTarget = 0;
let mode = "type";
let feedState = null;
let current = { kind: "pick", index: 0 };

const timing = {
  show: { rise: 0.3, glide: 0.42, drop: 0.28, gap: 0.24, lead: 0.42, out: 0.035 },
  type: { rise: 0.12, glide: 0.2, drop: 0.14, gap: 0.03, lead: 0.1, out: 0.02 },
};

function piecesFor(text, index) {
  if (VARIANT === "ids") return EXAMPLES[index].pieces.map((piece) => ({ show: shown(piece.text), id: piece.id, known: true }));
  return TOK.encode(text).map((piece) => ({ show: shown(piece), id: TOK.idOf(piece), known: TOK.known(piece) }));
}

function makeSlug(piece, slot, x) {
  const built = slugOf(piece, SL, P);
  const el = document.createElementNS("http://www.w3.org/2000/svg", "g");
  el.setAttribute("class", "tc-slug");
  el.innerHTML = built.svg;
  return { piece, slot, x, w: built.w, el, home: homeOf(piece), state: "set", t: 0, delay: 0, tm: timing.type };
}

// Offsets of a slug from its built position, in world units.
function restOffset(slug) {
  return [slug.x, 0, 0];
}
function caseOffset(slug) {
  return [slug.home.x - slug.w / 2, slug.home.y - (SL.y + SL.d / 2), LAYOUT.CASE_TOP - SL.z];
}
const lerp = (a, b, t) => a + (b - a) * t;

// Position, opacity and layer of a moving slug at time t of its flight.
function flight(slug) {
  const tm = slug.tm;
  const t = slug.t - slug.delay;
  const up = LAYOUT.TRAVEL - SL.z;
  const inCase = caseOffset(slug);
  const inStick = restOffset(slug);
  const total = tm.rise + tm.glide + tm.drop;
  if (slug.state === "in") {
    if (t <= 0) return { at: [inCase[0], inCase[1], inCase[2]], alpha: 0, layer: "rise", done: false, picking: false };
    if (t < tm.rise) { const e = ease(t / tm.rise); return { at: [inCase[0], inCase[1], lerp(inCase[2], up, e)], alpha: clamp01(t / (tm.rise * 0.7)), layer: "rise", done: false, picking: true }; }
    if (t < tm.rise + tm.glide) { const e = ease((t - tm.rise) / tm.glide); return { at: [lerp(inCase[0], inStick[0], e), lerp(inCase[1], inStick[1], e), up], alpha: 1, layer: "slugs", done: false }; }
    if (t < total) { const e = ease((t - tm.rise - tm.glide) / tm.drop); return { at: [inStick[0], inStick[1], lerp(up, 0, e)], alpha: 1, layer: "slugs", done: false }; }
    return { at: inStick, alpha: 1, layer: "slugs", done: true };
  }
  // Out: lift from the stick, glide back over the case, sink into the compartment and fade.
  if (t <= 0) return { at: inStick, alpha: 1, layer: "slugs", done: false };
  if (t < tm.drop) { const e = ease(t / tm.drop); return { at: [inStick[0], inStick[1], lerp(0, up, e)], alpha: 1, layer: "slugs", done: false }; }
  if (t < tm.drop + tm.glide) { const e = ease((t - tm.drop) / tm.glide); return { at: [lerp(inStick[0], inCase[0], e), lerp(inStick[1], inCase[1], e), up], alpha: 1, layer: "slugs", done: false }; }
  if (t < total) { const e = ease((t - tm.drop - tm.glide) / tm.rise); return { at: [inCase[0], inCase[1], lerp(up, inCase[2], e)], alpha: 1 - clamp01((e - 0.3) / 0.7), layer: "rise", done: false, picking: true }; }
  return { at: inCase, alpha: 0, layer: "rise", done: true };
}

let order = "";
function place() {
  const picks = [];
  const live = [];
  for (const slug of [...leaving, ...slugs]) {
    let pose;
    if (slug.state === "set") pose = { at: restOffset(slug), alpha: 1, layer: "slugs", done: true };
    else if (slug.state === "fade") pose = { ...slug.frozen, alpha: slug.frozen.alpha * (1 - clamp01(slug.t / 0.18)), done: slug.t >= 0.18, picking: false };
    else pose = flight(slug);
    if (pose.picking) picks.push(cellOutline(slug.home));
    slug.pose = pose;
    const t = translateAlong(P, pose.at);
    if (slug.transform !== t) { slug.el.setAttribute("transform", t); slug.transform = t; }
    const opacity = pose.alpha >= 1 ? "" : String(f2(pose.alpha));
    if (slug.opacity !== opacity) { slug.el.style.opacity = opacity; slug.opacity = opacity; }
    live.push(slug);
  }
  pickEl.setAttribute("d", picks.join(""));
  // Layers: rising and sinking slugs sit between the case and the stick; the rest sit in the
  // stick in token order, a leaving slug before the one that replaces it.
  // A slug whose foot clears the type in the stick is above everything there, so it paints last,
  // nearest last; the rest paint in token order.
  const high = (slug) => slug.pose.layer === "slugs" && slug.pose.at[2] >= SL.h;
  const depth = (slug) => depthOf([slug.pose.at[0] + slug.w / 2, slug.pose.at[1] + SL.y + SL.d / 2, slug.pose.at[2] + SL.z + SL.h / 2], P);
  const setting = live.filter((slug) => slug.pose.layer === "slugs").sort((a, b) => (high(a) - high(b)) || (high(a) ? depth(a) - depth(b) : a.slot - b.slot || (a.state === "out" ? -1 : 1)));
  const key = live.filter((slug) => slug.pose.layer === "rise").map((slug) => "r" + slug.slot).join(",") + "|" + setting.map((slug) => slug.slot + slug.state).join(",");
  if (key !== order) {
    order = key;
    const rising = live.filter((slug) => slug.pose.layer === "rise");
    for (const slug of rising) riseLayer.appendChild(slug.el);
    for (const slug of setting) slugLayer.appendChild(slug.el);
  }
}

function setTones() {
  slugs.forEach((slug, index) => {
    slug.el.setAttribute("data-tone", index % 2 ? "b" : "a");
    const last = index === slugs.length - 1;
    slug.el.toggleAttribute("data-new", last);
    const solid = slug.el.firstElementChild;
    if (solid) solid.toggleAttribute("data-lit", last);
  });
}

function landed() {
  return slugs.filter((slug) => slug.state === "set").length;
}

function drawCounter() {
  const counted = landed() + overflowAt.filter((at) => clock >= at).length;
  if (counted !== shownCount) {
    shownCount = counted;
    const text = String(Math.min(999, counted)).padStart(3, "0");
    digits.forEach((node, index) => { if (node.textContent !== text[index]) node.textContent = text[index]; });
  }
  const over = slugs.length && landed() === slugs.length ? overflowAt.filter((at) => clock >= at).length : 0;
  const label = over > 0 ? "+" + over : "";
  if (overflowEl.textContent !== label) overflowEl.textContent = label;
  return counted;
}

// Puts a new text on the bench. "show" sets the slugs one by one, as for a sample; "type"
// replaces only what changed, quickly, as the reader types.
function setPieces(pieces, how) {
  mode = how;
  const tm = timing[how];
  const built = pieces.map((piece) => ({ piece, w: slugWidth(Array.from(piece.show).length, piece.id === null || piece.id === undefined || !SL.idPitch ? 0 : String(piece.id).length, SL) }));
  const line = lineOf(built.map((entry) => entry.w), LAYOUT.XS, LAYOUT.MEASURE, LAYOUT.STICK_MAX);
  const fits = line.xs.length;
  let keep = 0;
  const still = STILL.matches;
  if (how === "type") {
    while (keep < slugs.length && keep < fits && slugs[keep].piece.show === pieces[keep].show && slugs[keep].piece.id === pieces[keep].id && slugs[keep].state !== "out") keep++;
  }
  const going = slugs.slice(keep);
  going.forEach((slug, index) => {
    if (still || (slug.state === "in" && slug.t <= slug.delay)) { slug.el.remove(); return; }
    if (slug.state === "in") {
      slug.frozen = flight(slug);
      slug.state = "fade";
      slug.t = 0;
      leaving.push(slug);
      return;
    }
    slug.state = "out";
    slug.tm = tm;
    slug.t = 0;
    slug.delay = (going.length - 1 - index) * tm.out;
    leaving.push(slug);
  });
  const lead = going.length && !still ? tm.lead + Math.min(going.length, 12) * tm.out : 0;
  const kept = slugs.slice(0, keep);
  // Kept slugs still waiting on a slower schedule move to this one.
  let waiting = 0;
  for (const slug of kept) {
    if (slug.state !== "in" || slug.t > slug.delay) continue;
    slug.tm = tm;
    slug.delay = slug.t + waiting++ * tm.gap;
  }
  const added = [];
  for (let index = keep; index < fits; index++) {
    const slug = makeSlug(pieces[index], index, line.xs[index]);
    slug.state = still ? "set" : "in";
    slug.tm = tm;
    slug.t = 0;
    slug.delay = lead + (index - keep) * tm.gap;
    added.push(slug);
  }
  slugs = kept.concat(added);
  for (const slug of added) slugLayer.appendChild(slug.el);
  order = "";
  setTones();
  total = pieces.length;
  chipsEl.innerHTML = chipsHtml(pieces, VARIANT === "ids");
  const lastLanding = added.length ? added[added.length - 1].delay + tm.rise + tm.glide + tm.drop : 0;
  overflowAt = Array.from({ length: pieces.length - fits }, (_, index) => (still || how === "type" ? clock : clock + lastLanding + 0.12 * (index + 1)));
  followerTarget = line.end;
  if (still) followerX = followerTarget;
  place();
  drawCounter();
  loop.kick();
}

// The strip: the old text winds onto the left spool while the new text comes off the right one.
function feedText(text, animate) {
  const old = copyEl.querySelector("text");
  const next = old.cloneNode(false);
  next.textContent = text;
  if (!animate || STILL.matches) {
    copyEl.replaceChildren(next);
    feedState = null;
    return;
  }
  for (const node of [...copyEl.querySelectorAll("text")].slice(0, -1)) node.remove();
  copyEl.appendChild(next);
  feedState = { t: 0, old: copyEl.querySelector("text"), next, span: LAYOUT.COPY_WINDOW[1] - LAYOUT.COPY_WINDOW[0] + 20 };
}
function drawFeed(dt) {
  if (!feedState) return false;
  feedState.t += dt;
  const e = ease(feedState.t / 0.9);
  const shift = e * feedState.span;
  feedState.old.setAttribute("transform", "translate(" + f2(-shift) + " 0)");
  feedState.next.setAttribute("transform", "translate(" + f2(feedState.span - shift) + " 0)");
  const angle = 0.6 - shift / 7.5;
  marksEl.firstElementChild.setAttribute("d", LAYOUT.SPOOLS.map(([x, y]) => spoolMark(x, y, angle)).join(""));
  if (feedState.t >= 0.9) {
    feedState.old.remove();
    feedState.next.removeAttribute("transform");
    feedState = null;
  }
  return true;
}

const loop = figureLoop(stage, (dt, calm) => {
  clock += dt;
  if (touring) tour(dt);
  let moving = false;
  for (const slug of [...leaving, ...slugs]) {
    if (slug.state === "set") continue;
    slug.t += dt;
    if (slug.state === "fade") {
      if (slug.t >= 0.18) slug.state = "gone";
      else moving = true;
      continue;
    }
    const pose = flight(slug);
    if (pose.done) {
      if (slug.state === "in") slug.state = "set";
      else slug.state = "gone";
    } else moving = true;
  }
  for (const slug of leaving) if (slug.state === "gone") slug.el.remove();
  leaving = leaving.filter((slug) => slug.state !== "gone");
  // The follower never slides into a slug that still stands in the stick.
  let blocked = followerTarget;
  for (const slug of [...leaving, ...slugs]) {
    const low = slug.state === "set" || (slug.pose && slug.pose.layer === "slugs" && slug.pose.at[2] < SL.h);
    if (low) blocked = Math.max(blocked, slug.pose ? slug.pose.at[0] + slug.w : slug.x + slug.w);
  }
  followerX = follow(followerX, blocked, dt, mode === "show" ? 0.35 : 0.14, calm);
  followerEl.setAttribute("transform", translateAlong(P, [followerX, 0, 0]));
  place();
  const counted = drawCounter();
  const feeding = drawFeed(dt);
  const busy = moving || feeding || followerX !== blocked || followerX !== followerTarget || counted !== total;
  settled = !busy;
  report(moving || counted !== total);
  return touring || busy;
});

// Readout, meter and costs.
let lastReport = "";
function report(busy) {
  let text;
  if (busy && mode === "show") text = "setting · " + shownCount + " of " + total;
  else if (VARIANT === "ids") {
    const ids = EXAMPLES[current.index].pieces.map((piece) => piece.id);
    text = total + " tokens · ids " + ids.slice(0, 3).join(" ") + (ids.length > 3 ? " …" : "");
  } else text = total + (total === 1 ? " token · " : " tokens · ") + words + (words === 1 ? " word" : " words");
  if (text !== lastReport) { lastReport = text; say(text); }
}
function meter() {
  if (VARIANT === "ids") return;
  out("words").textContent = String(words);
  out("tokens").textContent = String(total);
  out("extra").textContent = String(extraOf(total, words));
  for (const rate of ["input", "output"]) {
    for (const use of USES) root.querySelector('[data-cost="' + rate + "-" + use.n + '"]').textContent = money(costOf(total, use.n, EXAMPLE_PRICE[rate]));
  }
}
function describe() {
  let text;
  if (VARIANT === "ids") text = EXAMPLES[current.index].label + ": " + total + " tokens, IDs " + EXAMPLES[current.index].pieces.map((piece) => piece.id).join(", ");
  else text = (current.kind === "pick" ? PRESETS[current.index].label : "your text") + ": " + total + (total === 1 ? " token, " : " tokens, ") + words + (words === 1 ? " word" : " words");
  if (current.kind === "pick") stage.setAttribute("aria-valuenow", String(current.index + 1));
  stage.setAttribute("aria-valuetext", text);
}
let announceTimer = 0;
function announce(now) {
  describe();
  clearTimeout(announceTimer);
  const text = VARIANT === "ids"
    ? EXAMPLES[current.index].label + ": " + total + " tokens. IDs " + EXAMPLES[current.index].pieces.map((piece) => piece.id).join(", ") + "."
    : total + (total === 1 ? " token, " : " tokens, ") + words + (words === 1 ? " word." : " words.");
  announceTimer = setTimeout(() => { status.textContent = text; }, now ? 0 : 700);
}

function choose(index, how) {
  current = { kind: "pick", index };
  buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  if (VARIANT === "ids") {
    feedText(EXAMPLES[index].text, how === "show");
    words = 0;
    setPieces(piecesFor("", index), how);
  } else {
    const preset = PRESETS[index];
    if (field.value !== preset.text) field.value = preset.text;
    note.textContent = preset.note;
    feedText(preset.text, how === "show");
    words = TOK.wordCount(preset.text);
    setPieces(piecesFor(preset.text), how);
    meter();
  }
  announce(how === "show");
}

function typed() {
  const text = field.value;
  const match = PRESETS.findIndex((preset) => preset.text === text);
  buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === match)));
  current = match >= 0 ? { kind: "pick", index: match } : { kind: "text" };
  note.textContent = match >= 0 ? PRESETS[match].note : "";
  feedText(text, false);
  words = TOK.wordCount(text);
  setPieces(piecesFor(text), "type");
  meter();
  announce(false);
}

// Idle tour: after a pause, step through the samples. Any input stops it; it comes back after
// six quiet seconds unless the reader has typed a text of their own.
const HOLD = 4.2;
let touring = !STILL.matches;
let tourClock = HOLD - 1.4;
let tourBeat = 0;
let settled = true;
let idleTimer = 0;
const PICKS = VARIANT === "ids" ? EXAMPLES.length : PRESETS.length;
function tour(dt) {
  if (settled) tourClock += dt;
  if (tourClock < HOLD) return;
  tourClock = 0;
  const here = current.kind === "pick" ? current.index : -1;
  choose(tourBeat++ === 0 && here >= 0 ? here : (here + 1) % PICKS, "show");
}
function steer() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (STILL.matches || current.kind !== "pick" || (field && document.activeElement === field)) return;
    touring = true;
    tourClock = 0;
    loop.kick();
  }, 6000);
}

buttons.forEach((button) => button.addEventListener("click", () => { steer(); choose(Number(button.dataset.pick), "show"); }));
if (field) {
  field.addEventListener("input", () => { steer(); typed(); });
  field.addEventListener("focus", steer);
}
stage.addEventListener("pointerdown", steer);
stage.addEventListener("keydown", (event) => {
  let next = null;
  const here = current.kind === "pick" ? current.index : -1;
  if (/^[1-9]$/.test(event.key) && Number(event.key) <= PICKS) next = Number(event.key) - 1;
  else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (here + 1) % PICKS;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (here - 1 + PICKS) % PICKS;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = PICKS - 1;
  if (next === null) return;
  event.preventDefault();
  steer();
  choose(next, "show");
});

// A read-only view of the machine for checks (drive.mjs eval).
root.__typecase = () => ({
  slugs: slugs.map((slug) => [slug.piece.show, slug.state, Math.round(slug.t * 100) / 100, Math.round(slug.delay * 100) / 100]),
  leaving: leaving.map((slug) => [slug.piece.show, slug.state, Math.round(slug.t * 100) / 100]),
  touring,
  counted: shownCount,
  total,
});

// Adopt the line the build drew, then start.
for (const node of [...slugLayer.children]) node.remove();
{
  const pieces = VARIANT === "ids" ? piecesFor("", 0) : piecesFor(PRESETS[0].text);
  words = VARIANT === "ids" ? 0 : TOK.wordCount(PRESETS[0].text);
  const built = pieces.map((piece) => ({ piece, w: slugWidth(Array.from(piece.show).length, piece.id === null || piece.id === undefined || !SL.idPitch ? 0 : String(piece.id).length, SL) }));
  const line = lineOf(built.map((entry) => entry.w), LAYOUT.XS, LAYOUT.MEASURE, LAYOUT.STICK_MAX);
  slugs = line.xs.map((x, index) => makeSlug(pieces[index], index, x));
  for (const slug of slugs) slugLayer.appendChild(slug.el);
  setTones();
  total = pieces.length;
  overflowAt = Array.from({ length: pieces.length - line.xs.length }, () => -1);
  followerX = followerTarget = line.end;
  place();
  drawCounter();
  report(false);
}
`;
