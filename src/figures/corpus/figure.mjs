// Fig: building a training corpus, drawn as a paper-sorting line. Four hoppers feed document
// sheets onto a belt. A trimmer cuts off boilerplate, a press marks near-duplicates and a gate
// kicks every failed sheet down a chute into a bin. A reader on the caster's boom reads a small
// sample of kept sheets, the caster (the tokenizer) learns its vocabulary from them, and a bar
// locks it. The frozen caster then encodes every kept sheet, the sample too, into a tape of token
// cells, and the packer cuts the tape into rows of equal length, a divider after each document.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { SOURCES, DOCS, SEQ_LEN, VOCAB, pack, summary } from "./model.mjs";

const WIDTH = 640;
const AZIMUTH = 52;

const SUM = summary(DOCS, SEQ_LEN);
const PACK = pack(DOCS, SEQ_LEN);

// Everything the page also needs. World units are about one px: x runs down the line, y toward
// the viewer, z up.
const C = {
  ride: 30.05, // a sheet on the belt
  half: 7, // half-length of a sheet before the trimmer
  trim: 5.25, // half-length after it
  wide: 4.75, // half-width
  step: 0.6, // one sheet in a stack
  reserve: 6, // paper under the documents that this run uses
  hopperX: [-190, -168, -146, -124],
  pedTop: 32,
  stackY: -27.25,
  xt: -98, // trimmer roller
  xp: -72, // press ram
  xg: -40, // gate: a failed sheet leaves the belt here
  xr: 21, // reader head
  leave: 16, // a kept sheet starts to cross into the stack layer
  edge: 28, // a kept sheet leaves the belt end
  mag: [42, 0, 20], // kept stack centre and pedestal top
  v: 44, // belt speed, units a second
  pitch: 24, // space between sheets on the belt
  t0: 0.8, // the first sheet lands on the belt
  feed: 0.42, // seconds for a sheet to slide out of its hopper
  chute: { x: -36, y0: 11, z0: 29.9, y1: 34, z1: 8, half: 10 },
  pile: [-36, 41, 4], // pile centre and bin floor
  kick: 0.16,
  slide: 0.4,
  drop: 0.22,
  paddle: { x: -48, y: -17, len: 29, t: 1.4, z0: 31.2, z1: 35.2, swing: 62 },
  stamp: 3.45, // ram travel down to the sheet
  dip: 2.8, // reader head travel
  out: 90, // caster outlet face
  cell: 2.6, // one token along the tape
  tape: 2.25, // half-width of the tape
  tapeZ: 21.5,
  tapeH: 0.6,
  divider: 0.8,
  dividerH: 2.6,
  xc: 134, // blade plane
  slots: [32, 26, 20, 14], // crate slot centres, filled from the front
  rate: 22, // cells a second while the tape runs
  pause: 0.95, // cut, push and pusher return
  push: [0.2, 0.62],
  cut: 4.5, // blade travel
  lock: { rest: -15, on: -1.5 },
  case: { x: 63, y: -11, w: 22, d: 22, top: 35.4 },
  seq: SEQ_LEN,
  vocab: VOCAB,
  // Rule lines that stand for printed text, per paper stock: [a, b0, b1], with a along the sheet
  // and b across it. Web pages also carry an image box; papers set two columns.
  rows: [
    [[4.1, -3.9, 2.6], [3.1, -3.9, 3.6], [2.1, -3.9, 1.2], [0.6, 0.2, 3.9], [-0.4, 0.2, 3.2], [-1.4, 0.2, 3.9], [-2.4, 0.2, 2.4], [-3.6, -3.9, 3.6], [-4.6, -3.9, 1.8]],
    [4.4, 3.5, 2.6, 1.7, 0.8, -0.1, -1, -1.9, -2.8, -3.7].map((a) => [a, -3.9, 3.9]).concat([[-4.6, -3.9, 1.4]]),
    [[4.4, -3.9, 1.8], [3.4, -2.6, 2.9], [2.4, -2.6, 0.6], [1.4, -1.3, 3.5], [0.4, -1.3, 2], [-0.6, -2.6, 1.4], [-1.6, -3.9, 0.9], [-2.6, -3.9, 3.1], [-3.6, -2.6, 2.2], [-4.6, -3.9, -1.4]],
    [[4.3, -2.6, 2.6]].concat([3.1, 2.2, 1.3, 0.4, -0.5, -1.4, -2.3, -3.2].flatMap((a) => [[a, -3.9, -0.5], [a, 0.5, 3.9]]), [[-4.1, -3.9, -1.6], [-4.1, 0.5, 2.4]]),
  ],
  image: [-2.9, 1.1, -3.9, -0.6],
};

const P = k.fitProjection(
  [...k.boxCorners({ x: -206, y: -40, w: 398, d: 92 }, -14, 0), [-198, -35, 44], [-124, -35, 44], [-76, -22, 58], [16, -2, 44], [126, -11, 39]],
  WIDTH,
  1000,
  { pad: 22, azimuth: AZIMUTH },
);
// Fit the height to the drawing.
const SPAN = (() => {
  const points = [...k.boxCorners({ x: -206, y: -40, w: 398, d: 92 }, -14, 0), [-198, -35, 44], [-76, -22, 58]].map((p) => k.iso(p, P));
  const ys = points.map(([, y]) => y);
  return [Math.min(...ys), Math.max(...ys)];
})();
const HEIGHT = Math.round(SPAN[1] - SPAN[0] + 44);
P.origin = [P.origin[0], P.origin[1] - SPAN[0] + 22];

// ---------------------------------------------------------------------------------------------
// The schedule: every event time comes from the belt speed, the station positions and the model.

const slotAt = (j, x) => C.t0 + (x - C.hopperX[0] + C.pitch * j) / C.v;
const FLY = (C.mag[0] - C.edge) / C.v;
const E = [];
{
  let kept = 0;
  let dropped = 0;
  let sampled = 0;
  DOCS.forEach((doc, j) => {
    const land = slotAt(j, C.hopperX[doc.src]);
    const e = { j, src: doc.src, start: land - C.feed, land, trim0: slotAt(j, C.xt - C.trim), trim1: slotAt(j, C.xt + C.trim) };
    if (doc.drop === "dup") e.stamp = slotAt(j, C.xp);
    if (doc.drop) {
      e.gate = slotAt(j, C.xg);
      e.bin = e.gate + C.kick + C.slide + C.drop;
      e.rank = dropped++;
    } else {
      e.leave = slotAt(j, C.leave);
      e.fly = slotAt(j, C.edge);
      e.home = e.fly + FLY;
      e.rank = kept++;
      if (doc.sample) {
        e.read = slotAt(j, C.xr);
        e.sample = sampled++;
      }
    }
    E.push(e);
  });
}
const round3 = (n) => Math.round(n * 1000) / 1000;
E.forEach((e) => Object.keys(e).forEach((key) => typeof e[key] === "number" && (e[key] = round3(e[key]))));

// The tape: it runs, stops for each cut and push, and runs again.
const TE0 = round3(Math.max(...E.filter((e) => e.home != null).map((e) => e.home)) + 0.5);
const LEAD = (C.xc - C.out) / C.cell;
const RUNS = [];
{
  let t = TE0;
  let s = 0;
  PACK.rows.forEach((_, r) => {
    const s1 = C.seq * (r + 1) + LEAD;
    const t1 = t + (s1 - s) / C.rate;
    RUNS.push([round3(t), round3(t1), round3(s), round3(s1)]);
    t = t1 + C.pause;
    s = s1;
  });
}
const T_DONE = round3(RUNS[RUNS.length - 1][1] + C.pause);
const T_HOLD = round3(T_DONE + 2.4);
const T_LOOP = round3(T_HOLD + 1.2);
const timeOfS = (s) => {
  for (const [t0, t1, s0, s1] of RUNS) if (s <= s1) return t0 + Math.max(0, s - s0) / C.rate;
  return RUNS[RUNS.length - 1][1];
};
E.forEach((e) => {
  if (e.home == null) return;
  const first = PACK.cells.findIndex((cell) => cell.doc === e.j);
  e.use = round3(timeOfS(Math.max(0, first - 2)));
});
const CELLS = PACK.cells.map((cell) => (cell.boundary ? 1 : 0));

// The sample teaches the vocabulary: each sample sheet sets its share of the matrix case.
const PEGS = [];
E.filter((e) => e.read != null).forEach((e) => {
  const share = C.vocab / SUM.sample;
  for (let m = 0; m < share; m++) PEGS.push(round3(e.read + 0.25 + 0.06 * m));
});
const FREEZE = round3(PEGS[PEGS.length - 1] + 0.35);

// The idle tour lights the station to watch. Stations: 0 sources, 1 trimmer, 2 press, 3 gate,
// 4 tokenizer, 5 packer.
const TOUR = (() => {
  const first = (list) => Math.min(...list);
  const last = (list) => Math.max(...list);
  const reads = E.filter((e) => e.read != null).map((e) => e.read);
  const gates = E.filter((e) => e.gate != null).map((e) => e.gate);
  const keys = [
    [0, 0],
    [E[0].trim0 - 0.6, 1],
    [first(E.filter((e) => e.stamp != null).map((e) => e.stamp)) - 0.7, 2],
    [first(gates) - 0.7, 3],
    [reads[0] - 0.7, 4],
    [reads[0] + 1.6, 3],
    [reads[1] - 0.7, 4],
    [FREEZE + 1, 3],
    [last(gates) + 0.7, 4],
    [RUNS[0][1] - 0.8, 5],
  ];
  return keys.filter((key, index) => index === 0 || key[0] > keys[index - 1][0]).map(([t, s]) => [round3(t), s]);
})();

// Phase lines for screen readers.
const PHASES = [
  [0, "Sheets enter the line and pass the filters."],
  [E.find((e) => e.read != null).read - 0.2, "The tokenizer reads a sample sheet."],
  [FREEZE, "The tokenizer is frozen."],
  [TE0, "The frozen tokenizer encodes the kept sheets."],
  [RUNS[0][1], "The packer cuts fixed-length sequences."],
  [T_DONE, `Done: ${SUM.sequences} sequences of ${SEQ_LEN} tokens.`],
].map(([t, text]) => [round3(t), text]);

const STATIONS = [
  { name: "sources", job: `sources · web, books, code, papers · ${SUM.total} in` },
  { name: "trimmer", job: "trimmer · keeps the text, cuts boilerplate" },
  { name: "press", job: `press · marks ${SUM.byReason.dup} near-duplicates` },
  { name: "gate", job: `gate · drops ${SUM.rejected} of ${SUM.total}: marked or failed` },
  { name: "tokenizer", job: `tokenizer · learns from ${SUM.sample} sheets, encodes ${SUM.kept}` },
  { name: "packer", job: `packer · cuts ${SUM.sequences} sequences of ${SEQ_LEN} tokens` },
];
const STATION_SAY = [
  `Sources. Four hoppers hold web pages, books, code, and papers. ${SUM.total} documents go in.`,
  "Trimmer. It keeps the main text and cuts off boilerplate such as menus and footers.",
  `Press. It marks the ${SUM.byReason.dup} documents that are near-duplicates of earlier ones.`,
  `Gate. It drops marked, low-quality, unsafe, and off-mix documents: ${SUM.rejected} of ${SUM.total}.`,
  `Tokenizer. It learns its vocabulary from a sample of ${SUM.sample} kept documents, freezes, and then encodes all ${SUM.kept}.`,
  `Packer. It cuts the token stream into ${SUM.sequences} sequences of ${SEQ_LEN} tokens, with a divider after each document.`,
];

// ---------------------------------------------------------------------------------------------
// Pure functions of time. The page runs these same functions, so the build's first frame and
// the live frames agree.

function ease(u) {
  return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
}
function easeOut(u) {
  return u <= 0 ? 0 : u >= 1 ? 1 : 1 - (1 - u) * (1 - u);
}
function mix3(a, b, u) {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}
function unit(a) {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}
// 0 → 1 over `rise` seconds before an event, holds for `hold`, back to 0 over `fall`.
function bump(u, rise, hold, fall) {
  return ease((u + rise) / rise) * (1 - ease((u - hold) / fall));
}
function chuteFrame() {
  const ch = C.chute;
  const alpha = Math.atan2(ch.z0 - ch.z1, ch.y1 - ch.y0);
  const down = [0, Math.cos(alpha), -Math.sin(alpha)];
  const normal = [0, Math.sin(alpha), Math.cos(alpha)];
  const length = (ch.y1 - ch.y0) / Math.cos(alpha);
  const at = (c) => [ch.x, ch.y0 + down[1] * c + normal[1] * 0.06, ch.z0 + down[2] * c + normal[2] * 0.06];
  return { alpha, down, normal, length, at };
}

// Where one document's sheet is at time t, or null while it sits in a stack.
// Layers: 0 belt, 1 chute, 2 bin, 3 kept stack.
function sheetAt(e, t) {
  if (t < e.start) return null;
  const flat = { e, src: e.src, ex: [1, 0, 0], ey: [0, 1, 0], front: C.half, back: C.half, mark: e.stamp != null && t >= e.stamp, clip: null };
  if (t < e.land) {
    const y = C.stackY + (0 - C.stackY) * ease((t - e.start) / C.feed);
    const z = C.ride + (C.pedTop + 0.05 - C.ride) * (1 - ease((y + 7) / 7));
    return { ...flat, layer: 0, c: [C.hopperX[e.src], y, z], clip: C.stackY + C.wide };
  }
  const x = C.hopperX[0] + C.v * (t - C.t0) - C.pitch * e.j;
  const sheet = { ...flat, front: t >= e.trim0 ? C.trim : C.half, back: t >= e.trim1 ? C.trim : C.half };
  if (e.gate != null && t >= e.gate) {
    const g = t - e.gate;
    const kicked = [C.xg + 4, 13, C.ride];
    if (g < C.kick) {
      const u = easeOut(g / C.kick);
      return { ...sheet, layer: 0, c: [C.xg + 4 * u, 13 * u, C.ride] };
    }
    const ch = chuteFrame();
    const c0 = (13 - C.chute.y0) / Math.cos(ch.alpha);
    const c1 = ch.length - C.wide - 0.4;
    if (g < C.kick + C.slide) {
      const u = (g - C.kick) / C.slide;
      const w = ease(u / 0.3);
      return { ...sheet, layer: 1, c: mix3(kicked, ch.at(c0 + (c1 - c0) * u * u), w), ey: unit(mix3([0, 1, 0], ch.down, w)) };
    }
    if (g < C.kick + C.slide + C.drop) {
      const u = ease((g - C.kick - C.slide) / C.drop);
      const land = [C.pile[0], C.pile[1], C.pile[2] + C.step * (e.rank + 1) + 0.02];
      const c = mix3(ch.at(c1), land, u);
      c[2] += Math.sin(u * Math.PI) * 1.2;
      return { ...sheet, layer: 2, c, ey: unit(mix3(ch.down, [0, 1, 0], u)) };
    }
    return null;
  }
  if (e.fly != null && t >= e.fly) {
    const u = (t - e.fly) / (e.home - e.fly);
    if (u >= 1) return null;
    const top = C.mag[2] + C.step * (e.rank + 1) + 0.02;
    return { ...sheet, layer: 3, c: [C.edge + C.v * (t - e.fly), 0, C.ride - (C.ride - top) * u * u] };
  }
  return { ...sheet, layer: e.leave != null && t >= e.leave ? 3 : 0, c: [x, 0, C.ride] };
}

// Cuts a world polygon to y ≥ y0.
function clipY(points, y0) {
  const out = [];
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const inA = a[1] >= y0;
    const inB = b[1] >= y0;
    if (inA) out.push(a);
    if (inA !== inB) {
      const u = (y0 - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * u, y0, a[2] + (b[2] - a[2]) * u]);
    }
  }
  return out;
}

// One sheet: paper, the boilerplate bands it still carries, rule lines for its text, the press
// mark, and its edge. A sheet on top of a stack (bare) has no fill or edge of its own.
function sheetSvg(s, bare) {
  const point = (a, b) => [s.c[0] + s.ex[0] * a + s.ey[0] * b, s.c[1] + s.ex[1] * a + s.ey[1] * b, s.c[2] + s.ex[2] * a + s.ey[2] * b];
  const flat = (list) => list.map((p) => k.iso(p, P));
  const cut = (list) => (s.clip == null ? list : clipY(list, s.clip));
  const quad = (a0, a1, b0, b1) => cut([point(a0, b0), point(a1, b0), point(a1, b1), point(a0, b1)]);
  const area = (list) => (list.length > 2 ? k.pathOf(flat(list), true) : "");
  const paper = area(quad(-s.back, s.front, -C.wide, C.wide));
  if (!paper) return "";
  let bands = "";
  if (s.front > C.trim + 0.01) bands += area(quad(C.trim + 0.25, s.front - 0.35, -C.wide + 0.6, C.wide - 0.6));
  if (s.back > C.trim + 0.01) bands += area(quad(-s.back + 0.35, -C.trim - 0.25, -C.wide + 0.6, C.wide - 0.6));
  const lines = [];
  for (const [a, b0, b1] of C.rows[s.src]) {
    let p0 = point(a, b0);
    let p1 = point(a, b1);
    if (s.clip != null) {
      if (p0[1] < s.clip && p1[1] < s.clip) continue;
      if (p0[1] < s.clip) p0 = mix3(p0, p1, (s.clip - p0[1]) / (p1[1] - p0[1]));
      if (p1[1] < s.clip) p1 = mix3(p1, p0, (s.clip - p1[1]) / (p0[1] - p1[1]));
    }
    lines.push(k.pathOf(flat([p0, p1])));
  }
  if (s.src === 0) {
    const [a0, a1, b0, b1] = C.image;
    const box = quad(a0, a1, b0, b1);
    if (box.length > 2) lines.push(k.pathOf(flat(box), true));
  }
  let mark = "";
  if (s.mark) {
    const ring = Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      return point(0.6 + 1.7 * Math.cos(angle), 1.7 * Math.sin(angle));
    });
    mark = `<path class="cp-stamp" d="${k.pathOf(flat(ring), true)}"/>`;
  }
  return (
    (bare ? "" : `<path class="iso-top" d="${paper}"/>`) +
    (bands ? `<path class="cp-boiler" d="${bands}"/>` : "") +
    k.lineSvg(lines.join(""), { tone: "lo", free: true }) +
    mark +
    (bare ? "" : `<path class="iso-line iso-edge" data-tone="hi" d="${paper}"/>`)
  );
}

// A stack of sheets: a block of paper with page edges on its sides and the top sheet's text.
function stackSvg(cx, cy, z, h, half, src, mark) {
  if (h < 0.05) return "";
  const plan = { x: cx - half, y: cy - C.wide, w: half * 2, d: C.wide * 2, r: 0 };
  const seams = [];
  for (let s = z + 1.2; s < z + h - 0.4; s += 1.2) seams.push(k.sideSeam(plan, s, P, 2));
  const inner = seams.length ? k.lineSvg(seams.join(""), { tone: "faint" }) : "";
  const top = { src, c: [cx, cy, z + h], ex: [1, 0, 0], ey: [0, 1, 0], front: half, back: half, mark, clip: null };
  return k.solidSvg(k.slabOf(plan, z, h, P, 2), { tone: "hi", crease: "lo", inner }) + sheetSvg(top, true);
}

// Tape position: cells out of the caster.
function tapeAt(t) {
  for (const [t0, t1, s0, s1] of RUNS) {
    if (t <= t0) return s0;
    if (t < t1) return s0 + (t - t0) * C.rate;
  }
  return RUNS[RUNS.length - 1][3];
}

// A strip of token cells from x0 to x1 at y: cell lines on top and a divider plate on each
// boundary cell.
function stripSvg(x0, x1, y, lines, dividers) {
  if (x1 - x0 < 0.05) return "";
  const top = C.tapeZ + C.tapeH;
  const inner = lines.length ? k.lineSvg(lines.map((x) => k.lineOnTop([x, y - C.tape], [x, y + C.tape], top, P)).join(""), { tone: "lo" }) : "";
  let out = k.solidSvg(k.slabOf({ x: x0, y: y - C.tape, w: x1 - x0, d: C.tape * 2, r: 0 }, C.tapeZ, C.tapeH, P, 2), { tone: "hi", crease: "lo", inner });
  for (const [a, b] of dividers) {
    if (b - a > 0.05) out += k.solidSvg(k.slabOf({ x: a, y: y - C.tape, w: b - a, d: C.tape * 2, r: 0 }, top, C.dividerH, P, 2), { tone: "hi", crease: "lo" });
  }
  return out;
}

// The uncut tape between the caster outlet and the blade.
function tapeSvg(t) {
  const s = tapeAt(t);
  const cut = RUNS.filter((run) => t >= run[1]).length;
  const from = C.seq * cut;
  if (from >= CELLS.length) return "";
  const lead = (j) => C.out + (s - j) * C.cell;
  const x1 = Math.min(lead(from), C.xc + C.seq * C.cell);
  const x0 = Math.max(C.out, lead(CELLS.length));
  if (x1 <= C.out + 0.05) return "";
  const lines = [];
  const dividers = [];
  for (let j = from; j < CELLS.length; j++) {
    const x = lead(j);
    if (j > from && x > x0 + 0.05 && x < x1 - 0.05) lines.push(x);
    if (CELLS[j]) {
      const middle = x - C.cell / 2;
      const a = Math.max(x0, middle - C.divider / 2);
      const b = Math.min(x1, middle + C.divider / 2);
      if (b > a) dividers.push([a, b]);
    }
  }
  return stripSvg(x0, x1, 0, lines, dividers);
}

// One cut row, at y.
function rowSvg(r, y) {
  const lines = [];
  const dividers = [];
  for (let i = 0; i < C.seq; i++) {
    const x = C.xc + (C.seq - i) * C.cell;
    if (i > 0) lines.push(x);
    if (CELLS[C.seq * r + i]) dividers.push([x - C.cell / 2 - C.divider / 2, x - C.cell / 2 + C.divider / 2]);
  }
  return stripSvg(C.xc, C.xc + C.seq * C.cell, y, lines, dividers);
}

// Where row r is at time t: null before its cut, then pushed from the track into its slot.
function rowY(r, t) {
  const cutAt = RUNS[r][1];
  if (t < cutAt) return null;
  return C.slots[r] * ease((t - cutAt - C.push[0]) / (C.push[1] - C.push[0]));
}

// The gate paddle, swung by angle degrees about its post, with the hub that pins it.
function paddleSvg(angle) {
  const p = C.paddle;
  const a = (angle * Math.PI) / 180;
  const d = [Math.cos(a), Math.sin(a)];
  const n = [-Math.sin(a) * (p.t / 2), Math.cos(a) * (p.t / 2)];
  const ring = [
    [p.x - n[0], p.y - n[1]],
    [p.x + d[0] * p.len - n[0], p.y + d[1] * p.len - n[1]],
    [p.x + d[0] * p.len + n[0], p.y + d[1] * p.len + n[1]],
    [p.x + n[0], p.y + n[1]],
  ];
  return k.solidSvg(k.extrude(ring, p.z0, p.z1 - p.z0, P, { bevel: 0.3 }), { tone: "mid" }) + k.solidSvg(k.cylinder(p.x, p.y, 2.2, p.z1, 1.2, P, 18, 0.3), { tone: "mid" });
}

function paddleAt(t) {
  let swing = 0;
  for (const e of E) if (e.gate != null) swing = Math.max(swing, bump(t - e.gate, 0.1, C.kick, 0.18));
  return C.paddle.swing * swing;
}

function countsAt(t) {
  let fed = 0;
  let kept = 0;
  let rejected = 0;
  for (const e of E) {
    if (t >= e.land) fed++;
    if (e.home != null && t >= e.home) kept++;
    if (e.bin != null && t >= e.bin) rejected++;
  }
  const rows = RUNS.filter((run) => t >= run[1]).length;
  return { fed, kept, rejected, rows };
}

// Every live part at time t, as markup and offsets. The page writes these into the drawing.
function frameAt(t) {
  const reset = ease((t - T_HOLD) / (T_LOOP - T_HOLD));
  const layers = ["", "", "", ""];
  const sheets = E.map((e) => sheetAt(e, t)).filter(Boolean);
  sheets.sort((a, b) => k.depthOf(a.c, P) - k.depthOf(b.c, P));
  for (const s of sheets) layers[s.layer] += sheetSvg(s, false);
  // Hopper stacks lose a sheet as each one slides out, and refill during the reset.
  const hoppers = C.hopperX.map((cx, h) => {
    const all = E.filter((e) => e.src === h);
    const left = all.filter((e) => t < e.start + C.feed / 2).length;
    const height = C.reserve + C.step * (reset > 0 ? left + (all.length - left) * reset : left);
    return stackSvg(cx, C.stackY, C.pedTop, height, C.half, h, false);
  });
  // The kept stack fills from the belt and empties into the caster from the bottom.
  const home = E.filter((e) => e.home != null && t >= e.home);
  const used = home.filter((e) => t >= e.use).length;
  const topDoc = home.length ? home.reduce((a, b) => (b.home > a.home ? b : a)) : null;
  const kept = topDoc ? stackSvg(C.mag[0], C.mag[1], C.mag[2], C.step * (home.length - used), C.trim, topDoc.src, false) : "";
  // The bin pile.
  const landed = E.filter((e) => e.bin != null && t >= e.bin);
  const pileTop = landed.length ? landed.reduce((a, b) => (b.bin > a.bin ? b : a)) : null;
  const pile = pileTop ? stackSvg(C.pile[0], C.pile[1], C.pile[2], C.step * landed.length, C.trim, pileTop.src, pileTop.stamp != null) : "";
  // Rows in the crate, the one being pushed included.
  let crate = "";
  const order = RUNS.map((_, r) => [r, rowY(r, t)]).filter(([, y]) => y != null && y > 0.001);
  order.sort((a, b) => a[1] - b[1]);
  for (const [r, y] of order) crate += rowSvg(r, y);
  // Actuators.
  let ram = 0;
  let head = 0;
  for (const e of E) {
    if (e.stamp != null) ram = Math.max(ram, bump(t - e.stamp, 0.08, 0.02, 0.16));
    if (e.read != null) head = Math.max(head, bump(t - e.read, 0.16, 0.06, 0.3));
  }
  let blade = 0;
  let pusher = -4;
  RUNS.forEach(([, cutAt], r) => {
    blade = Math.max(blade, bump(t - cutAt, 0.1, 0.04, 0.14));
    const out = ease((t - cutAt - C.push[0]) / (C.push[1] - C.push[0]));
    const back = ease((t - cutAt - C.push[1]) / (C.pause - C.push[1]));
    if (t >= cutAt + C.push[0] && t < cutAt + C.pause) pusher = -4 + (C.slots[r] - C.tape + 4) * out * (1 - back);
  });
  const lock = ease((t - FREEZE) / 0.6) * (1 - reset);
  const pegs = PEGS.map((at) => ease((t - at) / 0.18) * (1 - reset));
  return {
    layers,
    hoppers,
    kept,
    pile,
    crate,
    tape: tapeSvg(t),
    paddle: paddleAt(t),
    ram: -C.stamp * ram,
    head: -C.dip * head,
    blade: -C.cut * blade,
    pusher: pusher + 4,
    lock: (C.lock.on - C.lock.rest) * lock,
    pegs,
    fade: 1 - reset,
  };
}

// ---------------------------------------------------------------------------------------------
// The static machine.

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const at = (point) => k.iso(point, P);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const st = (index, body) => `<g data-st="${index}">${body}</g>`;

const PLATE = { x: -206, y: -40, w: 398, d: 92, r: 8 };
const PLATE_H = 10;
const FOOT_H = 4;

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Label plate at the front left.
  const label = { x: -196, y: 36, w: 32, d: 11, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[-192, 39.6, 21], [-192, 42, 15], [-192, 44.4, 18]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(Dots([at([label.x + 2.2, label.y + label.d / 2, 0.8]), at([label.x + label.w - 2.2, label.y + label.d / 2, 0.8])], { size: 0.42 }));
  return out.join("");
}

function hopper(h) {
  const cx = C.hopperX[h];
  const ped = { x: cx - 8.5, y: -35, w: 17, d: 16, r: 1.5 };
  const panel = [[cx - 5.5, -19, 8], [cx + 5.5, -19, 8], [cx + 5.5, -19, 24], [cx - 5.5, -19, 24]];
  const inner = L(k.sideSeam(ped, 4, P, 4), { tone: "faint" }) + L(path3(panel, true), { tone: "faint" });
  return st(0, S(k.slabOf(ped, 0, C.pedTop, P, 4, 0.8), { tone: "mid", inner }) + Dots([at([cx - 6.5, -32.5, C.pedTop]), at([cx + 6.5, -32.5, C.pedTop])], { size: 0.42 }));
}

const leg = (x, y) => S(k.slabOf({ x, y, w: 4, d: 4, r: 0.6 }, 0, 18, P, 2, 0.3), { tone: "mid" });
const frameBar = (x0, x1, y) => S(k.slabOf({ x: x0, y, w: x1 - x0, d: 4, r: 0.8 }, 18, 13, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam({ x: x0, y, w: x1 - x0, d: 4, r: 0.8 }, 22, P, 3), { tone: "faint" }) });

function backRow() {
  const out = [];
  out.push(leg(-196, -15), leg(22, -15));
  out.push(st(2, S(k.slabOf({ x: -75, y: -21, w: 6, d: 4, r: 0.8 }, 0, 52, P, 3, 0.5), { tone: "mid" })));
  out.push(st(3, S(k.cylinder(C.paddle.x, C.paddle.y, 1.8, 0, C.paddle.z0, P, 18, 0.3), { tone: "mid" })));
  out.push(frameBar(-202, 34, -15));
  out.push(Dots([-196, -150, -104, -58, -12, 26].map((x) => at([x, -13, 31])), { size: 0.4 }));
  out.push(S(k.slabOf({ x: -198, y: -11, w: 228, d: 22, r: 0 }, 26, 4, P, 2), { tone: "lo" }));
  out.push(st(1, S(k.slabOf({ x: -102, y: -15, w: 8, d: 4, r: 0.8 }, 31, 8, P, 3, 0.4), { tone: "mid" })));
  return out.join("");
}

// Trimmer roller, front cheek and the bar that ties the cheeks.
function trimmer() {
  const F = G.frameAlong([C.xt, -11, 33.85], [0, 1, 0]);
  const roller = S(G.disc(0, 22, 2.75, F, P), { tone: "mid", inner: L(G.arcOf(F, 3, 2.75, P) + G.arcOf(F, 19, 2.75, P), { tone: "faint" }) });
  const cheek = S(k.slabOf({ x: -102, y: 11, w: 8, d: 4, r: 0.8 }, 31, 8, P, 3, 0.4), { tone: "mid" });
  const hub = L(k.sideRing([C.xt, 15, 33.85], 1.3, "y", P, 16), { tone: "lo" }) + Dots([at([C.xt, 15, 33.85])], { size: 0.45 });
  const bolts = Dots([at([C.xt - 2.4, 13, 39]), at([C.xt + 2.4, 13, 39])], { size: 0.42 });
  return st(1, roller + cheek + hub + bolts);
}

// Press: the ram and its stamp foot ride in the crown.
function ram() {
  const rod = S(k.cylinder(C.xp, 0, 2.2, 36, 20, P, 20), { tone: "mid", crease: "none" });
  const foot = S(k.slabOf({ x: C.xp - 3, y: -4, w: 6, d: 8, r: 0.8 }, 33.6, 2.4, P, 3, 0.3), { tone: "mid" });
  return foot + rod;
}
function pressFront() {
  const post = S(k.slabOf({ x: -75, y: 17, w: 6, d: 4, r: 0.8 }, 0, 52, P, 3, 0.5), { tone: "mid" });
  const crownPlan = { x: -76, y: -22, w: 8, d: 44, r: 1.2 };
  const crown = S(k.slabOf(crownPlan, 52, 6, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(crownPlan, 54, P, 3), { tone: "faint" }) });
  const bolts = Dots([at([-72, -19, 58]), at([-72, 19, 58]), at([-72, 0, 58])], { size: 0.45 });
  return st(2, post + crown + bolts);
}

function frontRow() {
  const out = [];
  out.push(frameBar(-202, C.chute.x - C.chute.half - 1, 11));
  out.push(frameBar(C.chute.x + C.chute.half + 1, 34, 11));
  out.push(Dots([-196, -150, -104, -58, -12, 26].map((x) => at([x, 13, 31])), { size: 0.4 }));
  out.push(leg(-196, 11), leg(22, 11));
  return out.join("");
}

// Bin with its recess, drawn before the pile; its front lip is drawn after the pile.
const BIN = { x: -50, y: 30, w: 28, d: 20, r: 1.5 };
const BIN_TOP = 7;
function binBody(id) {
  const open = k.insetPlan(BIN, 1.6);
  const ring = k.ringOf(open, 3);
  const rim = ring.map(([x, y]) => at([x, y, BIN_TOP]));
  const x0 = open.x;
  const y0 = open.y;
  const x1 = open.x + open.w;
  const y1 = open.y + open.d;
  const floor = C.pile[2];
  const quad = (points) => path3(points, true);
  const far = quad([[x0, y0, BIN_TOP], [x1, y0, BIN_TOP], [x1, y0, floor], [x0, y0, floor]]);
  const left = quad([[x0, y0, BIN_TOP], [x0, y1, BIN_TOP], [x0, y1, floor], [x0, y0, floor]]);
  const bottom = quad([[x0, y0, floor], [x1, y0, floor], [x1, y1, floor], [x0, y1, floor]]);
  const clip = `<clipPath id="${id}-bin"><path d="${k.pathOf(rim, true)}"/></clipPath>`;
  const recess = `<g clip-path="url(#${id}-bin)"><path class="iso-shade" data-shade="1" d="${bottom}"/><path class="iso-shade" data-shade="2" d="${far}"/><path class="iso-shade" data-shade="0" d="${left}"/>${L(path3([[x0, y0, floor], [x1, y0, floor]]) + path3([[x0, y0, floor], [x0, y1, floor]]) + path3([[x0, y0, floor], [x0, y0, BIN_TOP]]), { tone: "faint" })}</g>`;
  const body = S(k.slabOf(BIN, 0, BIN_TOP, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(BIN, 2.5, P, 3), { tone: "faint" }) });
  return { defs: clip, svg: st(3, body + recess + L(k.pathOf(rim, true), { tone: "lo" })) };
}
function binLip() {
  const lip = { x: BIN.x, y: BIN.y + BIN.d - 1.6, w: BIN.w, d: 1.6, r: 0.6 };
  return st(3, S(k.slabOf(lip, 0, BIN_TOP, P, 2), { tone: "mid", crease: "none", inner: L(k.sideSeam(lip, 2.5, P, 2), { tone: "faint" }) }));
}

// Chute: a floor plate and two walls along the slope.
function chute(part) {
  const ch = chuteFrame();
  const F = G.frameOf([C.chute.x, C.chute.y0, C.chute.z0], ch.down, [1, 0, 0], ch.normal);
  const half = C.chute.half;
  if (part === "floor") return st(3, S(G.prismOf(F, [[-half, -1], [half, -1], [half, 0], [-half, 0]], 0, ch.length, P), { tone: "mid" }));
  const x = part === "left" ? -half : half - 1;
  return st(3, S(G.prismOf(F, [[x, 0], [x + 1, 0], [x + 1, 3.5], [x, 3.5]], 0, ch.length, P), { tone: "mid" }));
}

// Tokenizer: the magazine pedestal for the kept stack, the caster with its matrix case, the
// lock bar, and the boom with the reader head.
function magazine() {
  const ped = { x: 34, y: -8, w: 16, d: 16, r: 1.2 };
  return st(4, S(k.slabOf(ped, 0, C.mag[2], P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(ped, 4, P, 3), { tone: "faint" }) }) + Dots([at([36.4, 5.6, C.mag[2]]), at([47.6, 5.6, C.mag[2]])], { size: 0.42 }));
}
const CASTER = { x: 54, y: -16, w: 36, d: 32, r: 2.5 };
const CASTER_TOP = 34;
function caster() {
  const panel = [[59, 16, 6], [85, 16, 6], [85, 16, 27], [59, 16, 27]];
  const vents = [12, 15, 18].map((z) => path3([[63, 16, z], [81, 16, z], [81, 16, z + 1.2], [63, 16, z + 1.2]], true)).join("");
  const slot = path3([[90, -3.2, 21.4], [90, 3.2, 21.4], [90, 3.2, 23.4], [90, -3.2, 23.4]], true);
  const inner = L(k.sideSeam(CASTER, 4, P, 6), { tone: "faint" }) + L(path3(panel, true), { tone: "lo" }) + L(vents, { tone: "faint" }) + L(slot, { tone: "lo" });
  const body = S(k.slabOf(CASTER, 0, CASTER_TOP, P, 6, 1.2), { tone: "mid", inner });
  const screws = Dots([[60.6, 16, 8], [83.4, 16, 8], [60.6, 16, 25], [83.4, 16, 25]].map(at), { size: 0.42 });
  const cs = C.case;
  const casePlan = { x: cs.x, y: cs.y, w: cs.w, d: cs.d, r: 1 };
  const grid = [];
  for (let i = 1; i < 4; i++) {
    const gx = cs.x + (cs.w * i) / 4;
    const gy = cs.y + (cs.d * i) / 4;
    grid.push(k.lineOnTop([gx, cs.y], [gx, cs.y + cs.d], cs.top, P), k.lineOnTop([cs.x, gy], [cs.x + cs.w, gy], cs.top, P));
  }
  const matrix = S(k.slabOf(casePlan, CASTER_TOP, cs.top - CASTER_TOP, P, 3, 0.4), { tone: "mid", inner: L(grid.join(""), { tone: "faint" }) });
  return st(4, body + screws + matrix);
}
// Peg centres in the matrix case, filled row by row.
const PEG_AT = Array.from({ length: VOCAB }, (_, m) => {
  const cs = C.case;
  const col = m % 4;
  const row = Math.floor(m / 4);
  return at([cs.x + (cs.w * (col + 0.5)) / 4, cs.y + (cs.d * (row + 0.5)) / 4, cs.top]);
});
function lockBar() {
  const y = C.lock.rest;
  const bar = S(k.slabOf({ x: 61, y, w: 26, d: 3, r: 0.6 }, C.case.top, 1.8, P, 2, 0.3), { tone: "mid" });
  const feet = [61, 85].map((x) => S(k.slabOf({ x, y, w: 2, d: 3, r: 0.3 }, CASTER_TOP, C.case.top - CASTER_TOP, P, 2), { tone: "mid" })).join("");
  return feet + bar + Dots([at([62, y + 1.5, C.case.top + 1.8]), at([86, y + 1.5, C.case.top + 1.8])], { size: 0.4 });
}
function readerHead() {
  const head = S(k.slabOf({ x: C.xr - 4, y: -4, w: 8, d: 8, r: 1 }, 35, 6, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam({ x: C.xr - 4, y: -4, w: 8, d: 8, r: 1 }, 36.4, P, 3), { tone: "faint" }) });
  const rod = S(k.cylinder(C.xr, 0, 1.1, 41, 2.9, P, 16), { tone: "mid", crease: "none" });
  return head + rod;
}
function boom() {
  const plan = { x: C.xr - 5, y: -2, w: 63 - C.xr, d: 4, r: 0.8 };
  const arm = S(k.slabOf(plan, 41, 3, P, 3, 0.4), { tone: "mid" });
  const root = S(k.slabOf({ x: 54.5, y: -4, w: 5.5, d: 8, r: 0.8 }, CASTER_TOP, 11, P, 3, 0.4), { tone: "mid" });
  return st(4, arm + Dots([at([C.xr - 2.5, 0, 44]), at([C.xr + 14, 0, 44])], { size: 0.4 }) + root + Dots([at([57.2, -2, 45]), at([57.2, 2, 45])], { size: 0.42 }));
}

// Packer: track plate on two supports, cutter, pusher and crate.
function packerBack() {
  const out = [];
  for (const x of [98, 178]) out.push(S(k.slabOf({ x, y: -5, w: 6, d: 14, r: 0.8 }, 0, 18, P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 127, y: -10, w: 6, d: 4, r: 0.8 }, 0, 36, P, 3, 0.4), { tone: "mid" }));
  const track = { x: C.out, y: -6, w: 98, d: 17, r: 1 };
  out.push(S(k.slabOf(track, 18, C.tapeZ - 18, P, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(track, 19.6, P, 3), { tone: "faint" }) }));
  out.push(L(k.lineOnTop([C.out, -C.tape - 0.8], [C.xc - 0.6, -C.tape - 0.8], C.tapeZ, P) + k.lineOnTop([C.out, C.tape + 0.8], [126.8, C.tape + 0.8], C.tapeZ, P), { tone: "faint" }));
  out.push(Dots([at([96, -4, C.tapeZ]), at([184, -4, C.tapeZ]), at([96, 9, C.tapeZ]), at([184, 9, C.tapeZ])], { size: 0.42 }));
  return st(5, out.join(""));
}
function pusher() {
  return S(k.slabOf({ x: C.xc + 1.5, y: -6, w: 39, d: 2, r: 0.4 }, C.tapeZ, 3, P, 2, 0.3), { tone: "mid" });
}
const CRATE = { x: C.xc, y: 11, w: 44, d: 26, r: 1.2 };
function crate() {
  const slots = C.slots.map((y) => k.planOutline({ x: C.xc + 0.4, y: y - C.tape - 0.5, w: C.seq * C.cell - 0.8, d: (C.tape + 0.5) * 2, r: 0.5 }, C.tapeZ, P, 2)).join("");
  const inner = L(k.sideSeam(CRATE, 4, P, 3), { tone: "faint" }) + L(path3([[140, 37, 7], [172, 37, 7], [172, 37, 16], [140, 37, 16]], true), { tone: "lo" });
  return st(5, S(k.slabOf(CRATE, 0, C.tapeZ, P, 3, 0.8), { tone: "mid", inner }) + L(slots, { tone: "faint" }) + Dots([[142.4, 37, 9], [169.6, 37, 9], [142.4, 37, 14], [169.6, 37, 14]].map(at), { size: 0.42 }));
}
function blade() {
  return S(k.slabOf({ x: C.xc - 0.8, y: -3, w: 0.8, d: 6, r: 0 }, 26, 14.6, P, 2), { tone: "mid" });
}
function cutterFront() {
  const post = S(k.slabOf({ x: 127, y: 6, w: 6, d: 4, r: 0.8 }, C.tapeZ, 36 - C.tapeZ, P, 3, 0.4), { tone: "mid" });
  const bar = S(k.slabOf({ x: 126, y: -11, w: 9, d: 22, r: 1 }, 36, 3, P, 3, 0.5), { tone: "mid" });
  return st(5, post + bar + Dots([at([130, -8, 39]), at([130, 8, 39])], { size: 0.42 }));
}

// Hit areas: one convex outline per station, from its world bounds.
const HIT = [
  [[-199, -36, 0], [-115, -18, 46]],
  [[-103, -16, 18], [-93, 16, 40]],
  [[-77, -23, 0], [-67, 23, 59]],
  [[-51, -19, 0], [-21, 51, 37]],
  [[14, -17, 0], [91, 17, 46]],
  [[91, -11, 0], [189, 38, 40]],
];
const hitPath = ([lo, hi]) => {
  const points = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) points.push(at([x, y, z]));
  return k.pathOf(G.hullOf(points), true);
};

export function build({ fig = "Fig 2", id = "corpus" } = {}) {
  const first = frameAt(0);
  const bin = binBody(id);
  const live = (name, inner = "") => `<g data-live="${name}">${inner}</g>`;
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `A paper-sorting line that builds a training corpus. Four hoppers hold web pages, books, code, and papers. Their sheets ride a belt through a trimmer, a press that marks near-duplicates, and a gate that kicks failed sheets down a chute into a bin. A reader on a boom samples ${SUM.sample} kept sheets for the caster, which learns its vocabulary and locks. The kept sheets stack up, the caster encodes them into a tape of token cells, and a cutter packs the tape into ${SUM.sequences} rows of ${SEQ_LEN} cells in a crate, with a divider plate after each document.`,
    body: [
      `<defs>${bin.defs}</defs>`,
      base(),
      C.hopperX.map((_, h) => hopper(h) + live(`hopper-${h}`, first.hoppers[h])).join(""),
      backRow(),
      live("belt", first.layers[0]),
      frontRow(),
      trimmer(),
      st(2, `<g data-live="ram">${ram()}</g>`),
      pressFront(),
      st(3, live("paddle", paddleSvg(first.paddle))),
      bin.svg,
      chute("left"),
      chute("floor"),
      live("chute", first.layers[1]),
      chute("right"),
      live("pile", first.pile),
      live("bin", first.layers[2]),
      binLip(),
      magazine(),
      live("kept", first.kept),
      live("fall", first.layers[3]),
      caster(),
      `<g class="cp-pegs">${PEG_AT.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.95" data-peg opacity="0"/>`).join("")}</g>`,
      st(4, `<g data-live="lock">${lockBar()}</g>`),
      st(4, `<g data-live="head">${readerHead()}</g>`),
      boom(),
      packerBack(),
      st(5, `<g data-live="pusher">${pusher()}</g>`),
      live("tape", first.tape),
      crate(),
      live("crate", first.crate),
      st(5, `<g data-live="blade">${blade()}</g>`),
      cutterFront(),
      `<g class="cp-hits">${HIT.map((box, index) => `<path data-hit="${index}" d="${hitPath(box)}"/>`).join("")}</g>`,
    ],
  });

  const stage = stageHtml({
    svg: svg + `<span class="sr-only" role="status" aria-live="polite" data-status></span>`,
    label: "Corpus sorting line. Left and right arrow keys move between the stations and name each job. Space pauses or plays.",
    role: "group",
  });
  const controls = `<div class="fig-controls"><button class="btn" type="button" data-play>Pause</button><button class="btn" type="button" data-replay>Replay</button></div><p class="fig-status" data-status-line>${PHASES[0][1]}</p>`;
  const html = plate({
    id,
    fig,
    title: "From documents to batches",
    hint: "Hover a station",
    readout: `in 0 · kept 0 · rejected 0 · 0 sequences`,
    keys: [
      { mark: "lit", label: "Lit: the station at work now" },
      { mark: "raised", label: "Sheets: one document each" },
      { mark: "flat", label: `Rows: ${SEQ_LEN} token IDs, a divider after each document` },
    ],
    caption: `Schematic, not to scale. The counts are illustrative. The filters reject ${SUM.rejected} of ${SUM.total} documents. The tokenizer trains on a sample of ${SUM.sample} kept documents and then freezes. The frozen tokenizer then encodes all ${SUM.kept} kept documents, including the ${SUM.sample} in the sample. The packer cuts the token stream into ${SUM.sequences} sequences of ${SEQ_LEN} tokens and puts a divider token after each document. The model trains on these rows of token IDs, not on the documents. Corpus choices decide what the model can learn.`,
    stage,
    controls,
  });

  const script = `
const P = ${JSON.stringify(P)};
const C = ${JSON.stringify(C)};
const E = ${JSON.stringify(E)};
const RUNS = ${JSON.stringify(RUNS)};
const CELLS = ${JSON.stringify(CELLS)};
const PEGS = ${JSON.stringify(PEGS)};
const TOUR = ${JSON.stringify(TOUR)};
const PHASES = ${JSON.stringify(PHASES)};
const STATIONS = ${JSON.stringify(STATIONS)};
const STATION_SAY = ${JSON.stringify(STATION_SAY)};
const FREEZE = ${FREEZE}, T_HOLD = ${T_HOLD}, T_LOOP = ${T_LOOP}, T_DONE = ${T_DONE};
${ease.toString()}
${easeOut.toString()}
${mix3.toString()}
${unit.toString()}
${bump.toString()}
${chuteFrame.toString()}
${sheetAt.toString()}
${clipY.toString()}
${sheetSvg.toString()}
${stackSvg.toString()}
${tapeAt.toString()}
${stripSvg.toString()}
${tapeSvg.toString()}
${rowSvg.toString()}
${rowY.toString()}
${paddleSvg.toString()}
${paddleAt.toString()}
${countsAt.toString()}
${frameAt.toString()}
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const live = (name) => svg.querySelector('[data-live="' + name + '"]');
const parts = {
  belt: live("belt"), chute: live("chute"), bin: live("bin"), fall: live("fall"), pile: live("pile"), kept: live("kept"),
  crate: live("crate"), tape: live("tape"), paddle: live("paddle"), ram: live("ram"), head: live("head"),
  blade: live("blade"), pusher: live("pusher"), lock: live("lock"),
  hoppers: C.hopperX.map((_, h) => live("hopper-" + h)),
};
const pegs = [...svg.querySelectorAll("[data-peg]")];
const stations = [0, 1, 2, 3, 4, 5].map((i) => [...svg.querySelectorAll('[data-st="' + i + '"]')]);
const hits = [...svg.querySelectorAll("[data-hit]")];
const status = stage.querySelector("[data-status]");
const statusLine = root.querySelector("[data-status-line]");
const playButton = root.querySelector("[data-play]");
const replayButton = root.querySelector("[data-replay]");
const say = readoutOf(root);
const written = new Map();
const put = (node, html) => { if (written.get(node) !== html) { written.set(node, html); node.innerHTML = html; } };
const shift = (node, by) => { const text = translateAlong(P, by); if (written.get(node) !== text) { written.set(node, text); node.setAttribute("transform", text); } };
let t = STILL.matches ? T_DONE : 0;
let playing = !STILL.matches;
let chosen = null;
let lit = -1;
let resume = 0;
let phase = "";
let paddleAngle = null;
function tourAt(time) {
  let station = 0;
  for (const [at, index] of TOUR) if (time >= at) station = index;
  return time >= T_HOLD ? 0 : station;
}
function light(index) {
  if (index === lit) return;
  lit = index;
  stations.forEach((list, i) => list.forEach((node) => node.toggleAttribute("data-on", i === index)));
}
function draw() {
  const f = frameAt(t);
  put(parts.belt, f.layers[0]);
  put(parts.chute, f.layers[1]);
  put(parts.bin, f.layers[2]);
  put(parts.fall, f.layers[3]);
  put(parts.pile, f.pile);
  put(parts.kept, f.kept);
  put(parts.crate, f.crate);
  put(parts.tape, f.tape);
  f.hoppers.forEach((html, h) => put(parts.hoppers[h], html));
  parts.pile.setAttribute("opacity", f.fade.toFixed(3));
  parts.crate.setAttribute("opacity", f.fade.toFixed(3));
  const angle = Math.round(f.paddle * 10) / 10;
  if (angle !== paddleAngle) { paddleAngle = angle; parts.paddle.innerHTML = paddleSvg(angle); }
  shift(parts.ram, [0, 0, f.ram]);
  shift(parts.head, [0, 0, f.head]);
  shift(parts.blade, [0, 0, f.blade]);
  shift(parts.pusher, [0, f.pusher, 0]);
  shift(parts.lock, [0, f.lock, 0]);
  pegs.forEach((node, m) => { const o = f.pegs[m].toFixed(2); if (node.getAttribute("opacity") !== o) node.setAttribute("opacity", o); });
  const c = countsAt(t >= T_HOLD ? T_DONE : t);
  light(chosen ?? tourAt(t));
  say(chosen != null ? STATIONS[chosen].job : "in " + c.fed + " · kept " + c.kept + " · rejected " + c.rejected + " · " + c.rows + " sequence" + (c.rows === 1 ? "" : "s"));
  let line = "";
  for (const [at, text] of PHASES) if (t >= at) line = text;
  if (line !== phase && chosen == null) { phase = line; if (document.activeElement === stage && status) status.textContent = line; }
  const visible = chosen != null ? STATION_SAY[chosen] : line;
  if (statusLine && statusLine.textContent !== visible) statusLine.textContent = visible;
}
const loop = figureLoop(stage, (dt, calm) => {
  if (playing && !calm) {
    t += dt;
    if (t >= T_LOOP) t -= T_LOOP;
  }
  draw();
  return playing && !calm;
});
function setPlaying(next) {
  playing = next && !STILL.matches;
  playButton.textContent = playing ? "Pause" : "Play";
  loop.kick();
}
function choose(index) {
  chosen = index;
  clearTimeout(resume);
  if (index != null && status) status.textContent = STATION_SAY[index];
  draw();
}
function release(delay) {
  clearTimeout(resume);
  resume = setTimeout(() => { chosen = null; draw(); }, delay);
}
playButton.addEventListener("click", () => setPlaying(!playing));
replayButton.addEventListener("click", () => {
  svg.classList.add("cp-dim");
  setTimeout(() => { t = 0; written.clear(); paddleAngle = null; draw(); svg.classList.remove("cp-dim"); setPlaying(true); }, 220);
});
hits.forEach((node) => {
  const index = Number(node.dataset.hit);
  node.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") choose(index); });
  node.addEventListener("pointerdown", () => { choose(index); release(6000); });
});
stage.addEventListener("pointerleave", () => release(1400));
stage.addEventListener("keydown", (event) => {
  const from = chosen ?? lit;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (from + 1) % STATIONS.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (from + STATIONS.length - 1) % STATIONS.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = STATIONS.length - 1;
  else if (event.key === " ") { event.preventDefault(); setPlaying(!playing); return; }
  else if (event.key === "Escape") { clearTimeout(resume); chosen = null; draw(); return; }
  else return;
  event.preventDefault();
  choose(next);
  release(6000);
});
stage.addEventListener("focus", () => { if (status) status.textContent = chosen != null ? STATION_SAY[chosen] : phase; });
if (STILL.matches) { playButton.disabled = true; replayButton.disabled = true; }
draw();
`;

  const css = `
[data-fig="${id}"] [data-st] .iso-solid>path{transition:stroke .35s,fill .35s}
[data-fig="${id}"] [data-st][data-on] .iso-solid>.iso-edge{stroke:var(--anatomy-lit)}
[data-fig="${id}"] [data-st][data-on] .iso-solid>.iso-top{fill:var(--anatomy-lit-top)}
[data-fig="${id}"] [data-st][data-on] .iso-solid>.iso-shade{fill:var(--anatomy-lit-shade)}
[data-fig="${id}"] [data-st][data-on] .iso-solid>.iso-fill{fill:var(--anatomy-face)}
[data-fig="${id}"] .cp-boiler{fill:var(--anatomy-faint);stroke:none}
[data-fig="${id}"] .cp-stamp{fill:var(--anatomy-mid);stroke:none}
[data-fig="${id}"] .cp-pegs circle{fill:var(--anatomy-hi);stroke:none}
[data-fig="${id}"] .cp-hits path{fill:transparent;stroke:none;cursor:pointer}
[data-fig="${id}"] [data-live]{pointer-events:none}
[data-fig="${id}"] .iso-svg{transition:opacity .2s}
[data-fig="${id}"] .iso-svg.cp-dim{opacity:.15}
@media (prefers-reduced-motion:reduce){[data-fig="${id}"] .iso-svg{transition:none}}
`;
  return { html, css, script, needs: [] };
}
