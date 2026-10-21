// Fig: one agent or four workers, as a paper bench. Every stack is one context window: a stack
// 100 units tall is a full window. Left, the one agent does four jobs one after another and keeps
// every sheet it reads. Right, four workers read at the same time on a bench that is also a
// shredder. Each worker prints one result card onto a belt. Then a gate under its paper slides
// open and the paper drops into the shredder. The belt runs under a verifier, which marks one
// card. A swinging gate turns that card into a reject tray, and the rest fly into the
// orchestrator's tray. A clock and a token counter stand in front of each side.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { JOBS, PLAN, BRIEF, RESULT, WRITE, WINDOW_TOKENS, SOLO_MINUTES, TEAM_MINUTES, SOLO_END, ORCH_END, SOLO_TOKENS, TEAM_TOKENS, SOLO_STARTS, soloAt, workerAt, tokensOf } from "./model.mjs";

const WIDTH = 660;
const HEIGHT = 430;

// World units. Stack height: 1 unit is 1% of a context window.
const TRAY = 2; // tray plate; paper starts on top of it
const TOP = TRAY + 100; // the 100% line on a ruler post
const CARD = { w: 24, d: 16 }; // a result card, RESULT units thick

const BASE = { x: -198, y: -56, w: 376, d: 124, r: 8 };
const BASE_H = 12;
const FOOT_H = 5;

const SOLO = [-160, 20];
const ORCH = [-92, 20];
const BENCH = { x: 0, y: -46, w: 160, d: 50, r: 2 };
const BENCH_H = 26;
const WORKERS = [20, 60, 100, 140].map((x) => [x, -21]);
const MOUTH = { hx: 15, hy: 19 };
const BED = { x: -71, y: 6, w: 231, d: 20, r: 0.8 };
const BED_Z = 17;
const BELT_H = 21;
const ROLL_R = 2.2;
const CARD_Y = BED.y + BED.d / 2;
const X_END = BED.x - ROLL_R + CARD.w / 2; // card centre when its far edge reaches the belt's end
const BRIDGE_X = -12;
// The diverter: a blade on a post in front of the belt. It swings across the belt for a rejected card.
const PIVOT = [-64, 29.5];
const BLADE = { length: 28, half: 0.6, z: [BELT_H + 0.3, BELT_H + 3.9], swing: 50 };
const TAN = Math.tan((BLADE.swing * Math.PI) / 180);
const REJECT_Y = 43;
// A card held against the swung blade by its back-left corner has its centre on this line.
// Past the blade's root the card runs straight on, clear of the pivot post.
const slideX = (y) => Math.max(PIVOT[0] + CARD.w / 2 + (PIVOT[1] + CARD.d / 2 - y) / TAN, PIVOT[0] + CARD.w / 2 + 3.6);
const TURN_X = slideX(CARD_Y);
const REJECT = { x: slideX(REJECT_Y) - 13, y: REJECT_Y - 10.5, w: 26, d: 21, r: 1.5 };
const METERS = [
  { x: SOLO[0] + 4, y: 54 },
  { x: 96, y: 50 },
];
const METER = { w: 30, d: 16, h: 9 };
const DIAL_R = 7.2;
const DIAL_Z = METER.h + 2.4;
const dialOf = (meter) => [meter.x - 6.5, meter.y - 0.6];
const WINDOW = { w: 12.4, h: 5.2 }; // counter window on the meter's front face

// Motion, in seconds. One minute of work plays in half a second.
const RUN = { lead: 0.4, spm: 0.5, belt: 160, fly: 0.38, slide: 0.42, g: 1400, hold: 3.2, fade: 0.8 };

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [SOLO[0] - 24, SOLO[1] + 18, TOP + 5], [ORCH[0] - 24, ORCH[1] + 18, TOP + 5], [SOLO[0] + 14, SOLO[1] - 18, TRAY + SOLO_END]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 56 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 10) / 10;
const poly = (points) => `M${points.map(([x, y]) => `${fix(x)} ${fix(y)}`).join("L")}Z`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const quad = (points) => poly(points.map(at));

// ---------------------------------------------------------------- shared with the page

// A block of paper: a sheet-sized slab with the sheet edges drawn round its visible sides.
// seams are heights (from the block's base) where one document ends; they get a darker line.
function paperSvg(cx, cy, z, h, seams, tone, P) {
  if (h < 0.05) return "";
  const plan = { x: cx - 14, y: cy - 18, w: 28, d: 36, r: 0.6 };
  let sheets = "";
  let docs = "";
  for (let s = 1.6; s < h - 0.7; s += 1.6) sheets += k.sideSeam(plan, z + s, P, 2);
  for (const s of seams) if (s > 0.7 && s < h - 0.7) docs += k.sideSeam(plan, z + s, P, 2);
  const inner = k.lineSvg(sheets, { tone: "faint" }) + k.lineSvg(docs, { tone: "lo" });
  return k.solidSvg(k.slabOf(plan, z, h, P, 2), { tone, inner });
}

// Document breaks inside one job's reading: an uneven rhythm, so the paper reads as files,
// search results and logs rather than one block.
function seamsOf(height, offset) {
  const rhythm = [4.6, 2.4, 5.8, 3.2, 4.2, 2.8, 5.2, 3.6];
  const out = [];
  let s = 0;
  for (let i = offset; s < height; i++) {
    s += rhythm[i % rhythm.length];
    if (s < height - 0.7) out.push(Math.round(s * 10) / 10);
  }
  return out;
}

// The hand of a clock dial, face up. One turn is 15 minutes.
function handPath(cx, cy, z, r, minutes, P) {
  const angle = (minutes / 15) * Math.PI * 2;
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return k.lineOnTop([cx - sx * 1.6, cy - sy * 1.6], [cx + sx * r, cy + sy * r], z, P);
}

// The diverter blade, turned `degrees` from the belt's edge toward the belt.
function bladeSvg(degrees, P) {
  const a = (-degrees * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const [px, py] = PIVOT;
  const n = [-uy * BLADE.half, ux * BLADE.half];
  const ring = [
    [px + n[0], py + n[1]],
    [px + n[0] + ux * BLADE.length, py + n[1] + uy * BLADE.length],
    [px - n[0] + ux * BLADE.length, py - n[1] + uy * BLADE.length],
    [px - n[0], py - n[1]],
  ];
  return k.solidSvg(k.extrude(ring, BLADE.z[0], BLADE.z[1] - BLADE.z[0], P, { bevel: 0.3 }), { tone: "mid" });
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const u = clamp01(value);
  return u * u * (3 - 2 * u);
};
const lerp = (a, b, u) => a + (b - a) * u;

// Where one result card is at time t. Each card is printed, rides the belt and flies onto the
// orchestrator's stack. The rejected card is marked under the verifier, meets the swung blade,
// slides along it off the belt and drops into the reject tray.
function cardAt(c, t) {
  // Waiting inside the bench, deep enough that no edge shows through the slot.
  const inside = BED.y - 2 - CARD.d / 2 - 6;
  if (t <= c.print) return { x: c.x0, y: inside, z: BELT_H, mark: 0, done: false };
  if (t < c.out) return { x: c.x0, y: lerp(inside, CARD_Y, ease((t - c.print) / (c.out - c.print))), z: BELT_H, mark: 0, done: false };
  const x = Math.max(c.stop, c.x0 - RUN.belt * (t - c.out));
  const mark = c.rejected ? clamp01((BRIDGE_X + 3 - x) / 6) : 0;
  if (t < c.arrive) return { x, y: CARD_Y, z: BELT_H, mark, done: false };
  if (c.rejected) {
    const u = clamp01((t - c.arrive) / RUN.slide);
    const y = lerp(CARD_Y, REJECT_Y, 1 - (1 - u) * (1 - u));
    const edge = BED.y + BED.d;
    const fall = clamp01((y - edge) / (REJECT_Y - edge));
    return { x: slideX(y), y, z: lerp(BELT_H, 3, fall * fall), mark: 1, done: u >= 1 };
  }
  const u = clamp01((t - c.arrive) / RUN.fly);
  const e = 1 - (1 - u) * (1 - u);
  return { x: lerp(c.stop, ORCH[0], e), y: lerp(CARD_Y, ORCH[1], e), z: lerp(BELT_H, c.land, u * u), mark: 0, done: u >= 1 };
}

// How far the diverter blade has turned at time t, in degrees.
function bladeAt(c, t) {
  return BLADE.swing * (ease((t - c.arrive + 0.32) / 0.22) - ease((t - c.arrive - 0.26) / 0.22));
}

// Everything the figure shows at time t (seconds into one run).
function stateAt(t, CARDS) {
  const m = Math.max(0, (t - RUN.lead) / RUN.spm);
  const solo = soloAt(m);
  const workers = JOBS.map((job, index) => {
    const w = workerAt(index, m);
    const c = CARDS[index];
    const open = ease((t - c.out - 0.05) / 0.3) - ease((t - c.out - 0.95) / 0.3);
    const fall = Math.max(0, t - c.out - 0.36);
    const drop = 0.5 * RUN.g * fall * fall;
    return { height: (job.worker - BRIEF) * w.reading, spent: w.level, reading: w.reading, reported: t >= c.out, open, drop, gone: drop > w.level + 14 };
  });
  const cards = CARDS.map((c) => cardAt(c, t));
  let landed = 0;
  let rise = 0;
  CARDS.forEach((c, index) => {
    if (c.rejected) return;
    if (cards[index].done) landed += 1;
    rise += RESULT * ease((t - c.arrive - RUN.fly) / 0.16);
  });
  const orch = PLAN + RESULT * landed;
  const spent = workers.reduce((total, w) => total + w.spent, 0) + orch;
  const rejected = CARDS.find((c) => c.rejected);
  return {
    m,
    solo,
    workers,
    cards,
    blade: bladeAt(rejected, t),
    orch,
    orchTop: PLAN + rise,
    soloMinutes: Math.min(m, SOLO_MINUTES),
    teamMinutes: Math.min(m, TEAM_MINUTES),
    soloTokens: tokensOf(solo.level),
    teamTokens: tokensOf(spent),
    marked: cards[rejected.index].mark >= 1,
    rejectedDone: cards[rejected.index].done,
    reported: workers.filter((w) => w.reported).length,
  };
}

// ---------------------------------------------------------------- the card schedule

// When each card is printed, leaves its slot, reaches its stop (the belt's end or the blade) and
// where it lands. Cards land in the order they reach the belt's end, so the first lands lowest.
function plan() {
  const cards = JOBS.map((job, index) => {
    const out = RUN.lead + job.minutes * RUN.spm;
    const x0 = WORKERS[index][0];
    const stop = job.rejected ? TURN_X : X_END;
    return { index, name: job.name, rejected: Boolean(job.rejected), x0, print: out - WRITE * RUN.spm, out, stop, arrive: out + (x0 - stop) / RUN.belt, land: 0 };
  });
  cards
    .filter((c) => !c.rejected)
    .sort((a, b) => a.arrive - b.arrive)
    .forEach((c, order) => (c.land = TRAY + PLAN + RESULT * order));
  // Two cards on the belt at once stay a card length apart, and no card reaches the blade's
  // reach while it swings.
  const reject = cards.find((c) => c.rejected);
  for (const a of cards)
    for (const b of cards) {
      if (a.index >= b.index) continue;
      for (let t = Math.max(a.out, b.out); t < Math.min(a.arrive, b.arrive); t += 0.005) {
        const gap = Math.abs(a.x0 - RUN.belt * (t - a.out) - (b.x0 - RUN.belt * (t - b.out)));
        if (gap < CARD.w + 1) throw new Error(`cards ${a.name} and ${b.name} meet on the belt at ${t.toFixed(2)} s`);
      }
    }
  for (const c of cards) {
    if (c.rejected) continue;
    for (let t = reject.arrive - 0.32; t < reject.arrive + 0.5; t += 0.005) {
      const x = c.x0 - RUN.belt * (t - c.out);
      if (t > c.out && t < c.arrive && x - CARD.w / 2 < PIVOT[0] + BLADE.length + 1 && x + CARD.w / 2 > PIVOT[0] - 2) throw new Error(`card ${c.name} meets the blade at ${t.toFixed(2)} s`);
    }
  }
  return cards;
}
const CARDS = plan();
const LANDING = CARDS.filter((c) => !c.rejected).sort((a, b) => a.arrive - b.arrive);
const T_END = RUN.lead + SOLO_MINUTES * RUN.spm + 0.3;
const CYCLE = T_END + RUN.hold + RUN.fade;

// ---------------------------------------------------------------- static parts

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 4, P, 8), { tone: "faint" }) }));
  const groove = k.insetPlan(BASE, 5);
  out.push(L(k.planOutline(groove, 0, P), { tone: "lo" }));
  // The line between the two stations runs from groove to groove.
  const split = (SOLO[0] + 17 + ORCH[0] - 24) / 2;
  out.push(L(k.lineOnTop([split, groove.y], [split, groove.y + groove.d], 0, P), { tone: "lo" }));
  const screws = k.corners(BASE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

// A tray on the base with a ruler post at its front-left corner: ticks every 5%, longer every 25%.
function station([cx, cy]) {
  const out = [];
  const tray = { x: cx - 17, y: cy - 21, w: 34, d: 42, r: 1.6 };
  out.push(S(k.slabOf(tray, 0, TRAY, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(tray, 1.6), TRAY, P, 4), { tone: "faint" }));
  const post = { x: cx - 24, y: cy + 13, w: 5, d: 5, r: 0.6 };
  const foot = { x: post.x - 1.5, y: post.y - 1.5, w: 8, d: 8, r: 1 };
  out.push(S(k.slabOf(foot, 0, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([foot.x + 1.4, foot.y + 6.6, 3]), at([foot.x + 6.6, foot.y + 6.6, 3])], { size: 0.4 }));
  const face = post.y + post.d;
  const minor = [];
  const major = [];
  for (let p = 0; p <= 100; p += 5) (p % 25 === 0 ? major : minor).push(k.segment([post.x, face, TRAY + p], [post.x + (p % 25 === 0 ? 3.4 : 1.8), face, TRAY + p], P));
  out.push(S(k.slabOf(post, 3, TOP + 2 - 3, P, 2), { tone: "mid", crease: "none", inner: L(minor.join(""), { tone: "lo" }) + L(major.join(""), { tone: "mid" }) }));
  const cap = { x: post.x - 1, y: post.y - 1, w: 7, d: 7, r: 1 };
  out.push(S(k.slabOf(cap, TOP + 2, 2.4, P, 3, 0.4), { tone: "mid" }));
  out.push(D([at([post.x + 2.5, post.y + 2.5, TOP + 4.4])], { size: 0.45 }));
  return out.join("");
}

// The cursor that rides the post at the height of the stack, built with its top at z = 0.
function cursorSvg([cx, cy]) {
  const box = { x: cx - 25.6, y: cy + 11.4, w: 8.2, d: 8.2, r: 1 };
  return S(k.slabOf(box, -3.2, 3.2, P, 3, 0.3), { tone: "hi", inner: L(k.sideSeam(box, -1.6, P, 3), { tone: "faint" }) });
}

// The plan: a pad with three rule lines of writing near its back edge.
function planSvg([cx, cy], z, h) {
  const top = z + h;
  const rules = [[-9, -14, 16], [-9, -11.4, 12], [-9, -8.8, 18]].map(([dx, dy, w]) => k.lineOnTop([cx + dx, cy + dy], [cx + dx + w, cy + dy], top, P)).join("");
  return paperSvg(cx, cy, z, h, [], "hi", P) + L(rules, { tone: "mid", free: true });
}

// A worker's brief: one sheet from the orchestrator with two rule lines.
function briefSvg([cx, cy], z) {
  const rules = [[-9, -12, 14], [-9, -9.4, 10]].map(([dx, dy, w]) => k.lineOnTop([cx + dx, cy + dy], [cx + dx + w, cy + dy], z + BRIEF, P)).join("");
  return paperSvg(cx, cy, z, BRIEF, [], "hi", P) + L(rules, { tone: "mid", free: true });
}

// A result card built at the origin: lit, its short text as rule lines. The rejected card also
// carries the verifier's cross, shown once it passes under the verifier.
function cardSvg(c) {
  const plan = { x: -CARD.w / 2, y: -CARD.d / 2, w: CARD.w, d: CARD.d, r: 0.8 };
  const rules = [[-8, -3.6, 12], [-8, -0.2, 15], [-8, 3.2, 9]].map(([dx, dy, w]) => k.lineOnTop([dx, dy], [dx + w, dy], RESULT, P)).join("");
  const inset = 0.5;
  const cross =
    k.lineOnTop([plan.x + inset, plan.y + inset], [plan.x + plan.w - inset, plan.y + plan.d - inset], RESULT, P) +
    k.lineOnTop([plan.x + plan.w - inset, plan.y + inset], [plan.x + inset, plan.y + plan.d - inset], RESULT, P);
  const mark = c.rejected ? `<g data-part="mark">${L(cross, { tone: "lit" })}</g>` : "";
  return S(k.slabOf(plan, 0, RESULT, P, 3), { tone: "hi", lit: true, inner: L(rules, { tone: "lo", free: true }) }) + mark;
}

// A screen half-plane: everything on the side of the line a–b that holds `inside`.
function halfPlane(a, b, inside) {
  const [ax, ay] = at(a);
  const [bx, by] = at(b);
  const length = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  let nx = -uy;
  let ny = ux;
  const [ix, iy] = at(inside);
  if ((ix - ax) * nx + (iy - ay) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const far = 3000;
  const p0 = [ax - ux * far, ay - uy * far];
  const p1 = [ax + ux * far, ay + uy * far];
  return poly([p0, p1, [p1[0] + nx * far, p1[1] + ny * far], [p0[0] + nx * far, p0[1] + ny * far]]);
}

const mouthOf = ([x, y]) => ({ x: x - MOUTH.hx, y: y - MOUTH.hy, w: MOUTH.hx * 2, d: MOUTH.hy * 2 });
const openingOf = (w) => {
  const m = mouthOf(w);
  return quad([[m.x, m.y, BENCH_H], [m.x + m.w, m.y, BENCH_H], [m.x + m.w, m.y + m.d, BENCH_H], [m.x, m.y + m.d, BENCH_H]]);
};
// What shows of a stack that sinks into a mouth: the opening and everything above its near rim.
const sinkClip = (w) => {
  const m = mouthOf(w);
  const lf = at([m.x, m.y + m.d, BENCH_H]);
  const rf = at([m.x + m.w, m.y + m.d, BENCH_H]);
  const rb = at([m.x + m.w, m.y, BENCH_H]);
  return poly([lf, rf, rb, [rb[0], rb[1] - 400], [lf[0], lf[1] - 400]]);
};

// The bench: a shredder with a mouth under each worker's paper and a printer slot in front of each.
function bench(id) {
  const out = [];
  const plan = BENCH;
  const right = plan.x + plan.w;
  const front = plan.y + plan.d;
  // The shred bin is a drawer in the bench's right end.
  const drawer = [[right, plan.y + 9, 4], [right, front - 9, 4], [right, front - 9, BENCH_H - 7], [right, plan.y + 9, BENCH_H - 7]];
  const slots = WORKERS.map(([x]) => quad([[x - 13, front, BELT_H - 0.4], [x + 13, front, BELT_H - 0.4], [x + 13, front, BELT_H + 2.6], [x - 13, front, BELT_H + 2.6]])).join("");
  out.push(S(k.slabOf(plan, 0, BENCH_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 4), { tone: "faint" }) + L(quad(drawer), { tone: "lo" }) + `<path class="ct-void" d="${slots}"/>` + L(slots, { tone: "lo" }) }));
  // A lamp beside each printer slot.
  out.push(D(WORKERS.map(([x]) => at([x + 15.6, front, BELT_H + 1.1])), { size: 0.55, tone: "hi" }));
  const handle = { x: right, y: plan.y + plan.d / 2 - 6, w: 1.8, d: 12, r: 0.6 };
  out.push(S(k.slabOf(handle, 11, 2.2, P, 2), { tone: "mid" }));
  // Inside each mouth: the far walls, the floor and two cutter drums, seen only through the opening.
  const inside = [];
  WORKERS.forEach((w) => {
    const m = mouthOf(w);
    const deep = BENCH_H - 13;
    inside.push(`<path class="ct-floor" d="${quad([[m.x, m.y, deep], [m.x + m.w, m.y, deep], [m.x + m.w, m.y + m.d, deep], [m.x, m.y + m.d, deep]])}"/>`);
    inside.push(`<path class="ct-wall" data-shade="1" d="${quad([[m.x, m.y, BENCH_H], [m.x + m.w, m.y, BENCH_H], [m.x + m.w, m.y, deep], [m.x, m.y, deep]])}"/>`);
    inside.push(`<path class="ct-wall" data-shade="0" d="${quad([[m.x, m.y, BENCH_H], [m.x, m.y + m.d, BENCH_H], [m.x, m.y + m.d, deep], [m.x, m.y, deep]])}"/>`);
  });
  for (const dy of [-7.5, 7.5]) {
    const F = G.frameAlong([plan.x + 3, WORKERS[0][1] + dy, BENCH_H - 8], [1, 0, 0]);
    const rings = [];
    WORKERS.forEach(([x]) => {
      for (let s = x - MOUTH.hx + 1.5 - (plan.x + 3); s < x + MOUTH.hx - (plan.x + 3); s += 3) rings.push(G.arcOf(F, s, 5.4, P));
    });
    inside.push(S(G.disc(0, plan.w - 6, 5.4, F, P), { tone: "mid", inner: L(rings.join(""), { tone: "lo" }) }));
  }
  out.push(`<g clip-path="url(#${id}-mouths)">${inside.join("")}</g>`);
  out.push(L(WORKERS.map((w) => k.planOutline({ ...mouthOf(w), r: 0.6 }, BENCH_H, P, 2)).join(""), { tone: "lo" }));
  out.push(D(k.corners(plan, 4).map(([x, y]) => at([x, y, BENCH_H])), { size: 0.45 }));
  return out.join("");
}

// The gate under a worker's paper: one plate that slides left under the bench top.
function gateSvg(w) {
  const m = mouthOf(w);
  const grip = { x: m.x + m.w - 6, y: m.y + m.d / 2 - 5, w: 2.4, d: 10, r: 1.2 };
  return S(k.slabOf({ ...m, r: 0.5 }, BENCH_H - 1.2, 1.2, P, 2), { tone: "lo", crease: "none", inner: L(k.planOutline(grip, BENCH_H, P, 4), { tone: "lo" }) }) + D([at([m.x + 2.4, m.y + 3, BENCH_H]), at([m.x + 2.4, m.y + m.d - 3, BENCH_H])], { size: 0.42 });
}

// The belt: a bed on three legs with a roller at each end and slats across its top.
function belt() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(BED, 2), 0, 0.1, P)}" style="filter:blur(4px)"/>`];
  for (const x of [BED.x + 6, 60, BED.x + BED.w - 8]) out.push(S(k.slabOf({ x: x - 2, y: BED.y + 8, w: 4, d: 4, r: 0.6 }, 0, BED_Z, P, 2), { tone: "mid" }));
  const slats = [];
  for (let x = BED.x + 4; x < BED.x + BED.w - 2; x += 8) slats.push(k.lineOnTop([x, BED.y], [x, BED.y + BED.d], BELT_H, P));
  out.push(S(k.slabOf(BED, BED_Z, BELT_H - BED_Z, P, 2, 0.4), { tone: "mid", inner: L(slats.join(""), { tone: "faint" }) }));
  for (const x of [BED.x, BED.x + BED.w]) {
    const F = G.frameAlong([x, BED.y, BELT_H - ROLL_R], [0, 1, 0]);
    out.push(S(G.disc(0, BED.d, ROLL_R, F, P), { tone: "mid", inner: L(G.circleOf(F, BED.d, ROLL_R - 0.8, P), { tone: "faint" }) }));
  }
  return out.join("");
}

const LEG = { w: 6, d: 3.4 };
function bridgeBack() {
  return S(k.slabOf({ x: BRIDGE_X - LEG.w / 2, y: BED.y - 5, w: LEG.w, d: LEG.d, r: 0.6 }, 0, 33, P, 2), { tone: "mid" });
}
function bridgeFront() {
  const out = [];
  const beam = { x: BRIDGE_X - 5, y: BED.y - 6, w: 10, d: BED.d + 12.4, r: 1 };
  const head = { x: BRIDGE_X - 3.4, y: CARD_Y - 5, w: 6.8, d: 10, r: 1 };
  out.push(S(k.slabOf(head, BELT_H + 6, 33 - BELT_H - 6, P, 3, 0.3), { tone: "mid", inner: L(k.sideSeam(head, BELT_H + 8, P, 3), { tone: "faint" }) }));
  out.push(D([at([BRIDGE_X, head.y + head.d, BELT_H + 10.4])], { size: 0.6, tone: "hi" }));
  out.push(S(k.slabOf(beam, 33, 4.6, P, 3, 0.5), { tone: "mid" }));
  out.push(D([at([BRIDGE_X, beam.y + 2.2, 37.6]), at([BRIDGE_X, beam.y + beam.d - 2.2, 37.6])], { size: 0.45 }));
  out.push(S(k.slabOf({ x: BRIDGE_X - LEG.w / 2, y: BED.y + BED.d + 1.6, w: LEG.w, d: LEG.d, r: 0.6 }, 0, 33, P, 2), { tone: "mid" }));
  return out.join("");
}

function pivotSvg() {
  const [x, y] = PIVOT;
  return S(k.cylinder(x, y, 1.6, 0, BLADE.z[1] + 0.8, P, 20), { tone: "mid", crease: "none" }) + S(k.cylinder(x, y, 2.4, BLADE.z[1] + 0.8, 1.2, P, 24, 0.3), { tone: "mid" });
}

function rejectTray() {
  return S(k.slabOf(REJECT, 0, 3, P, 3, 0.4), { tone: "mid" }) + L(k.planOutline(k.insetPlan(REJECT, 1.8), 3, P, 3), { tone: "faint" });
}

// A meter box: a clock dial on top, a token counter in a window on its front face.
function meterSvg(meter, side, end) {
  const out = [];
  const box = { x: meter.x - METER.w / 2, y: meter.y - METER.d / 2, w: METER.w, d: METER.d, r: 1.5 };
  out.push(S(k.slabOf(box, 0, METER.h, P, 4, 0.6), { tone: "mid" }));
  const [cx, cy] = dialOf(meter);
  out.push(S(k.cylinder(cx, cy, DIAL_R, METER.h, DIAL_Z - METER.h, P, 48, 0.4), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(cx, cy, DIAL_R - 1.2, DIAL_Z, P, 48), { tone: "lo" }));
  const ticks = k.radialTicks(cx, cy, DIAL_R - 1.2, 15, 5, DIAL_Z, [1, 2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(`<path data-part="hand-${side}" class="iso-line" data-tone="hi" data-free="start" d="${handPath(cx, cy, DIAL_Z + 0.1, DIAL_R - 2.4, end.minutes, P)}" style="stroke-width:1"/>`);
  out.push(D([at([cx, cy, DIAL_Z + 0.1])], { size: 0.6, tone: "hi" }));
  const face = box.y + box.d;
  const matrix = k.sideMatrix([meter.x + 1.6, face], METER.h - 1.8, P, "left");
  out.push(`<g transform="${matrix}"><rect class="ct-window" x="0" y="0" width="${WINDOW.w}" height="${WINDOW.h}" rx="0.6"/><text class="iso-face-text" data-tone="hi" data-part="count-${side}" x="${WINDOW.w / 2}" y="${WINDOW.h - 1.25}" font-size="3.6" text-anchor="middle">${Math.round(end.tokens / 1000)}k</text></g>`);
  out.push(D([at([box.x + 2, box.y + 2, METER.h]), at([box.x + box.w - 2, box.y + 2, METER.h])], { size: 0.4 }));
  return out.join("");
}

// A label plate on the base: three rule lines stand for its printing.
function labelPlate() {
  const plan = { x: 128, y: 40, w: 34, d: 14, r: 1.2 };
  const out = [S(k.slabOf(plan, 0, 0.8, P, 4), { tone: "lo" })];
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), 0.8, P, 4), { tone: "faint" }));
  out.push(L([[133, 44.4, 24], [133, 47.2, 18], [133, 50, 21]].map(([x, y, w]) => k.lineOnTop([x, y], [x + w, y], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([plan.x + 2.2, plan.y + plan.d / 2, 0.8]), at([plan.x + plan.w - 2.2, plan.y + plan.d / 2, 0.8])], { size: 0.42 }));
  return out.join("");
}

// ---------------------------------------------------------------- words

const pct = (n) => `${Math.round(n)}%`;
const kTokens = (n) => `${Math.round(n / 1000)}k`;

export function build({ fig = "Fig 1", id = "context-trays" } = {}) {
  const end = stateAt(T_END, CARDS);
  const body = [];
  body.push(`<defs>
<clipPath id="${id}-slot"><path d="${halfPlane([-300, BENCH.y + BENCH.d, BELT_H + RESULT], [300, BENCH.y + BENCH.d, BELT_H + RESULT], [0, CARD_Y + 20, BELT_H + RESULT])}"/></clipPath>
<clipPath id="${id}-mouths"><path d="${WORKERS.map(openingOf).join("")}"/></clipPath>
${WORKERS.map((w, index) => `<clipPath id="${id}-open-${index}"><path d="${openingOf(w)}"/></clipPath><clipPath id="${id}-sink-${index}"><path d="${sinkClip(w)}"/></clipPath>`).join("\n")}
</defs>`);
  body.push(base());
  body.push(labelPlate());

  // The one agent: plan, then each job's paper with a lit tab for its result.
  body.push(station(SOLO));
  body.push(`<g data-part="solo-cursor" transform="${k.translateAlong(P, [0, 0, TRAY + end.solo.level])}">${cursorSvg(SOLO)}</g>`);
  body.push(planSvg(SOLO, TRAY, PLAN));
  let z = TRAY + PLAN;
  JOBS.forEach((job, index) => {
    const h = end.solo.jobs[index].height;
    body.push(`<g data-part="solo-job" data-z="${z}" data-seams="${seamsOf(job.solo, index * 3).join(" ")}">${paperSvg(SOLO[0], SOLO[1], z, h, seamsOf(job.solo, index * 3), "mid", P)}</g>`);
    const tab = { x: SOLO[0] - 9, y: SOLO[1] + 18, w: 18, d: 4, r: 0.5 };
    body.push(`<g data-part="solo-tab" style="opacity:${end.solo.jobs[index].writing}">${S(k.slabOf(tab, z + job.solo + 0.6, 0.8, P, 2), { tone: "hi", lit: true })}</g>`);
    z += job.solo + RESULT;
  });

  // The orchestrator: its plan. Its result cards are drawn with the belt.
  body.push(station(ORCH));
  body.push(`<g data-part="orch-cursor" transform="${k.translateAlong(P, [0, 0, TRAY + end.orchTop])}">${cursorSvg(ORCH)}</g>`);
  body.push(planSvg(ORCH, TRAY, PLAN));
  body.push(bridgeBack());

  // The workers' bench, the gates and each worker's paper.
  body.push(bench(id));
  WORKERS.forEach((w, index) => body.push(`<g clip-path="url(#${id}-open-${index})"><g data-part="gate" transform="${k.translateAlong(P, [-2 * MOUTH.hx * end.workers[index].open, 0, 0])}">${gateSvg(w)}</g></g>`));
  WORKERS.forEach((w, index) => {
    const state = end.workers[index];
    const seams = seamsOf(JOBS[index].worker - BRIEF, index * 2 + 1);
    body.push(`<g clip-path="url(#${id}-sink-${index})"><g data-part="worker" transform="${k.translateAlong(P, [0, 0, -state.drop])}" style="opacity:${state.gone ? 0 : 1}">${briefSvg(w, BENCH_H)}<g data-part="worker-paper" data-seams="${seams.join(" ")}">${paperSvg(w[0], w[1], BENCH_H + BRIEF, state.height, seams, "mid", P)}</g></g></g>`);
  });

  // Belt and reject tray; the passing cards; the diverter; the rejected card; the verifier over all.
  body.push(belt());
  body.push(rejectTray());
  const cardGroup = (c) => {
    const s = end.cards[c.index];
    return `<g data-part="card" data-index="${c.index}" transform="${k.translateAlong(P, [s.x, s.y, s.z])}">${cardSvg(c)}</g>`;
  };
  body.push(`<g clip-path="url(#${id}-slot)">${LANDING.map(cardGroup).join("")}</g>`);
  body.push(`<g data-part="blade">${bladeSvg(end.blade, P)}</g>`);
  body.push(pivotSvg());
  body.push(`<g clip-path="url(#${id}-slot)">${CARDS.filter((c) => c.rejected).map(cardGroup).join("")}</g>`);
  body.push(bridgeFront());

  // Clocks and counters.
  body.push(meterSvg(METERS[0], "solo", { minutes: end.soloMinutes, tokens: end.soloTokens }));
  body.push(meterSvg(METERS[1], "team", { minutes: end.teamMinutes, tokens: end.teamTokens }));

  const reject = JOBS.find((job) => job.rejected);
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `A paper bench with two stations. Each stack of paper is one context window. A ruler post beside it reads 0 to 100%. On the left, one agent does four jobs one after another. Its stack climbs to ${SOLO_END}%. On the right, four workers read at the same time on a shredder bench. Each worker prints a result card onto a belt. Then its paper drops into the shredder. A verifier marks the ${reject.name} card. A swinging gate turns that card into a reject tray. The orchestrator's tray holds its plan and three results, ${ORCH_END}%. A clock and a token counter stand in front of each side.`,
    body,
  });
  const stage = stageHtml({
    svg: svg + `<span class="sr-only" aria-live="polite" data-out="live"></span>`,
    label: "One agent or four workers. Space plays or pauses. R replays. Left and right arrow keys step through the run. Home and End go to the start and the end.",
    role: "slider",
    attrs: `aria-valuemin="0" aria-valuemax="${Math.round(SOLO_MINUTES * 10) / 10}" aria-valuenow="${SOLO_MINUTES}" aria-valuetext="The orchestrator holds its plan and three results, ${ORCH_END} percent of its window. The workers took ${TEAM_MINUTES} minutes. The one agent is done after ${SOLO_MINUTES} minutes, ${SOLO_END} percent full."`,
  });
  const controls = `<div class="fig-controls"><button class="btn" type="button" data-act="play">Pause</button><button class="btn" type="button" data-act="replay">Replay</button></div>
<dl class="fig-meter"><div><dt>One agent · time</dt><dd data-out="solo-time">${SOLO_MINUTES.toFixed(1)} min</dd></div><div><dt>Orchestrated · time</dt><dd data-out="team-time">${TEAM_MINUTES.toFixed(1)} min</dd></div><div><dt>One agent · tokens</dt><dd data-out="solo-tokens">${kTokens(SOLO_TOKENS)}</dd></div><div><dt>Orchestrated · tokens</dt><dd data-out="team-tokens">${kTokens(TEAM_TOKENS)}</dd></div></dl>`;
  const html = plate({
    id,
    fig,
    title: "One agent or four workers",
    hint: "Compare the two stacks",
    readout: `one agent ${pct(SOLO_END)} · orchestrator ${pct(ORCH_END)}`,
    keys: [
      { mark: "lit", label: "Result cards. The verifier rejects one." },
      { mark: "raised", label: "Paper: what each agent has read" },
      { mark: "flat", label: "Ruler posts: 0 to 100% of one context window" },
    ],
    caption: `Each stack is one context window. The one agent works through the four jobs in turn and keeps all of its reading. The four workers run at the same time. Each worker prints one result card, and then its paper goes to the shredder. The verifier rejects one card, so the orchestrator keeps its plan and three results. The workers' clock stops when the slowest worker reports. Each token counter adds up the contexts on its side. A real bill is higher on both sides, because every lap sends the context again. All numbers are illustrative.`,
    stage,
    controls,
  });

  const script = `
const P = ${JSON.stringify(P)};
const JOBS = ${JSON.stringify(JOBS)};
const PLAN = ${PLAN}, BRIEF = ${BRIEF}, RESULT = ${RESULT}, WRITE = ${WRITE}, WINDOW_TOKENS = ${WINDOW_TOKENS};
const SOLO_MINUTES = ${SOLO_MINUTES}, TEAM_MINUTES = ${TEAM_MINUTES}, SOLO_STARTS = ${JSON.stringify(SOLO_STARTS)};
const SOLO_END = ${SOLO_END}, ORCH_END = ${ORCH_END};
const TRAY = ${TRAY}, CARD = ${JSON.stringify(CARD)}, BENCH_H = ${BENCH_H}, BELT_H = ${BELT_H}, CARD_Y = ${CARD_Y};
const BED = ${JSON.stringify(BED)}, BRIDGE_X = ${BRIDGE_X}, PIVOT = ${JSON.stringify(PIVOT)}, BLADE = ${JSON.stringify(BLADE)}, TAN = ${TAN}, REJECT_Y = ${REJECT_Y};
const SOLO = ${JSON.stringify(SOLO)}, ORCH = ${JSON.stringify(ORCH)}, WORKERS = ${JSON.stringify(WORKERS)}, MOUTH = ${JSON.stringify(MOUTH)};
const METERS = ${JSON.stringify(METERS)}, DIAL_R = ${DIAL_R}, DIAL_Z = ${DIAL_Z};
const RUN = ${JSON.stringify(RUN)};
const CARDS = ${JSON.stringify(CARDS)};
const T_END = ${T_END}, CYCLE = ${CYCLE};
const tokensOf = ${tokensOf.toString()};
const clamp01 = ${clamp01.toString()};
const ease = ${ease.toString()};
const lerp = ${lerp.toString()};
const slideX = (y) => Math.max(PIVOT[0] + CARD.w / 2 + (PIVOT[1] + CARD.d / 2 - y) / TAN, PIVOT[0] + CARD.w / 2 + 3.6);
const dialOf = (meter) => [meter.x - 6.5, meter.y - 0.6];
${soloAt.toString()}
${workerAt.toString()}
${paperSvg.toString()}
${seamsOf.toString()}
${handPath.toString()}
${bladeSvg.toString()}
${cardAt.toString()}
${bladeAt.toString()}
${stateAt.toString()}
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const all = (name) => [...svg.querySelectorAll('[data-part="' + name + '"]')];
const one = (name) => svg.querySelector('[data-part="' + name + '"]');
const soloJobs = all("solo-job");
const soloTabs = all("solo-tab");
const workers = all("worker");
const workerPaper = all("worker-paper");
const gates = all("gate");
const cards = [];
all("card").forEach((node) => (cards[Number(node.dataset.index)] = node));
const marks = cards.map((node) => node.querySelector('[data-part="mark"]'));
const blade = one("blade");
const soloCursor = one("solo-cursor");
const orchCursor = one("orch-cursor");
const hands = { solo: one("hand-solo"), team: one("hand-team") };
const counts = { solo: one("count-solo"), team: one("count-team") };
const out = (name) => root.querySelector('[data-out="' + name + '"]');
const liveRegion = out("live");
const playButton = root.querySelector('[data-act="play"]');
const replayButton = root.querySelector('[data-act="replay"]');
const say = readoutOf(root);
const written = new Map();
const put = (node, key, value, write) => { const id = node; const last = written.get(id) || {}; if (last[key] === value) return; last[key] = value; written.set(id, last); write(value); };
const shift = (node, by) => put(node, "t", translateAlong(P, by), (v) => node.setAttribute("transform", v));
const fade = (node, value) => put(node, "o", value.toFixed(3), (v) => (node.style.opacity = v));
const soloSeams = soloJobs.map((node) => (node.dataset.seams ? node.dataset.seams.split(" ").map(Number) : []));
const workerSeams = workerPaper.map((node) => (node.dataset.seams ? node.dataset.seams.split(" ").map(Number) : []));
const soloBase = soloJobs.map((node) => Number(node.dataset.z));
let t = CYCLE - RUN.fade - 1.4;
let playing = !STILL.matches;
let held = false;
let resume = 0;
let appear = 1;
let phase = "";
const word = (n) => ["No", "One", "Two", "Three", "Four"][n] || String(n);
function phaseOf(s) {
  const team = s.workers.every((w) => w.gone) && s.orch === ${ORCH_END}
    ? "The orchestrator holds its plan and three results, " + s.orch + " percent of its window. The workers took " + TEAM_MINUTES + " minutes."
    : s.marked && !s.rejectedDone ? "The verifier rejects the " + JOBS[CARDS.find((c) => c.rejected).index].name + " result."
    : s.reported ? word(s.reported) + " of four workers reported."
    : "Four workers read at the same time.";
  const job = s.solo.jobs.findIndex((j) => j.writing < 1);
  const solo = job < 0 ? "The one agent is done after " + SOLO_MINUTES + " minutes, " + Math.round(s.solo.level) + " percent full." : "The one agent is on job " + (job + 1) + " of four.";
  return team + " " + solo;
}
function draw() {
  const ending = t > T_END + RUN.hold;
  const away = ending ? ease((t - T_END - RUN.hold) / RUN.fade) : 0;
  const s = stateAt(Math.min(t, T_END), CARDS);
  // One agent.
  s.solo.jobs.forEach((job, index) => {
    const h = Math.round(job.height * 20) / 20;
    put(soloJobs[index], "h", h, () => (soloJobs[index].innerHTML = paperSvg(SOLO[0], SOLO[1], soloBase[index], h, soloSeams[index], "mid", P)));
    fade(soloJobs[index], 1 - away);
    fade(soloTabs[index], job.writing * (1 - away));
  });
  shift(soloCursor, [0, 0, TRAY + PLAN + (s.solo.level - PLAN) * (1 - away)]);
  // Workers.
  s.workers.forEach((w, index) => {
    const h = Math.round(w.height * 20) / 20;
    put(workerPaper[index], "h", h, () => (workerPaper[index].innerHTML = paperSvg(WORKERS[index][0], WORKERS[index][1], BENCH_H + BRIEF, h, workerSeams[index], "mid", P)));
    shift(workers[index], [0, 0, -w.drop]);
    fade(workers[index], w.gone ? 0 : appear);
    shift(gates[index], [-2 * MOUTH.hx * w.open, 0, 0]);
  });
  // Cards, blade, orchestrator.
  s.cards.forEach((c, index) => {
    shift(cards[index], [c.x, c.y, c.z]);
    fade(cards[index], c.done ? 1 - away : 1);
    if (marks[index]) fade(marks[index], c.mark);
  });
  const angle = Math.round(s.blade * 4) / 4;
  put(blade, "a", angle, () => (blade.innerHTML = bladeSvg(angle, P)));
  shift(orchCursor, [0, 0, TRAY + PLAN + (s.orchTop - PLAN) * (1 - away)]);
  // Clocks and counters run back to zero while the run fades.
  const back = 1 - away;
  const soloMin = s.soloMinutes * back;
  const teamMin = s.teamMinutes * back;
  const soloTokens = tokensOf(PLAN + (s.solo.level - PLAN) * back);
  const teamTokens = tokensOf(PLAN + BRIEF * 4 + ((s.teamTokens / WINDOW_TOKENS) * 100 - PLAN - BRIEF * 4) * back);
  [["solo", soloMin, 0], ["team", teamMin, 1]].forEach(([side, minutes, i]) => {
    const [cx, cy] = dialOf(METERS[i]);
    const m = Math.round(minutes * 40) / 40;
    put(hands[side], "m", m, () => hands[side].setAttribute("d", handPath(cx, cy, DIAL_Z + 0.1, DIAL_R - 2.4, m, P)));
  });
  const k1 = Math.round(soloTokens / 1000) + "k";
  const k2 = Math.round(teamTokens / 1000) + "k";
  put(counts.solo, "x", k1, (v) => (counts.solo.textContent = v));
  put(counts.team, "x", k2, (v) => (counts.team.textContent = v));
  put(out("solo-time"), "x", soloMin.toFixed(1) + " min", (v) => (out("solo-time").textContent = v));
  put(out("team-time"), "x", teamMin.toFixed(1) + " min", (v) => (out("team-time").textContent = v));
  put(out("solo-tokens"), "x", k1, (v) => (out("solo-tokens").textContent = v));
  put(out("team-tokens"), "x", k2, (v) => (out("team-tokens").textContent = v));
  const soloPct = Math.round(PLAN + (s.solo.level - PLAN) * back);
  const orchPct = Math.round(PLAN + (s.orch - PLAN) * back);
  say("one agent " + soloPct + "% · orchestrator " + orchPct + "%");
  const line = phaseOf(s);
  if (line !== phase) {
    phase = line;
    stage.setAttribute("aria-valuenow", Math.min(s.m, SOLO_MINUTES).toFixed(1));
    stage.setAttribute("aria-valuetext", line);
    if (document.activeElement === stage && liveRegion) liveRegion.textContent = line;
  }
}
const loop = figureLoop(stage, (dt, calm) => {
  if (playing && !held && !calm) {
    t += dt;
    if (t >= CYCLE) {
      t -= CYCLE;
      appear = 0;
    }
  }
  if (appear < 1) appear = calm ? 1 : Math.min(1, appear + dt / 0.35);
  draw();
  return playing && !held && !calm;
});
function setPlaying(next) {
  playing = next && !STILL.matches;
  held = false;
  clearTimeout(resume);
  playButton.textContent = playing ? "Pause" : "Play";
  loop.kick();
}
function replay() {
  svg.classList.add("ct-dim");
  setTimeout(() => {
    t = 0;
    appear = 0;
    written.clear();
    draw();
    svg.classList.remove("ct-dim");
    setPlaying(true);
  }, 200);
}
function step(to) {
  t = Math.max(0, Math.min(T_END, to));
  appear = 1;
  if (playing) {
    held = true;
    clearTimeout(resume);
    resume = setTimeout(() => { held = false; loop.kick(); }, 6000);
  }
  draw();
}
playButton.addEventListener("click", () => setPlaying(!playing));
replayButton.addEventListener("click", replay);
stage.addEventListener("keydown", (event) => {
  const now = Math.min(t, T_END);
  if (event.key === " ") setPlaying(!playing);
  else if (event.key === "r" || event.key === "R") replay();
  else if (event.key === "ArrowRight" || event.key === "ArrowUp") step(now + 0.5);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") step(now - 0.5);
  else if (event.key === "Home") step(0);
  else if (event.key === "End") step(T_END);
  else return;
  event.preventDefault();
});
stage.addEventListener("focus", () => { if (liveRegion) liveRegion.textContent = phase; });
if (STILL.matches) {
  t = T_END;
  playButton.disabled = true;
  replayButton.disabled = true;
}
draw();
`;

  const css = `
[data-fig="${id}"] .iso-svg{transition:opacity .2s}
[data-fig="${id}"] .iso-svg.ct-dim{opacity:.2}
[data-fig="${id}"] .ct-void{fill:var(--anatomy-shade-0);stroke:none}
[data-fig="${id}"] .ct-floor{fill:var(--anatomy-shade-0);stroke:none}
[data-fig="${id}"] .ct-wall{stroke:none}
[data-fig="${id}"] .ct-wall[data-shade="0"]{fill:var(--anatomy-shade-0)}
[data-fig="${id}"] .ct-wall[data-shade="1"]{fill:var(--anatomy-shade-1)}
[data-fig="${id}"] .ct-window{fill:var(--anatomy-shade-1);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
`;
  return { html, css, script, needs: [] };
}
