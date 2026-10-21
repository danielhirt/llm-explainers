// Fig: lower the monthly bill, as a coin bank. Three glass tubes stand on a cabinet, one per
// part of each request: repeated instructions, background material and answers. Each tube's
// coin stack is that part's monthly cost, one coin for every $3,750. A lever on the cabinet
// front makes one change: thrown, it drops that part's saving through the cabinet and down a
// chute into a cup on the tray. A rod on the right rises as tall as the total bill, and a blade
// on its head points at a ruler with a band at the $55,000 target.
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import { REQUESTS_PER_DAY, DAYS, RATES, TARGET, COIN, PARTS, costOf, partCost, savingOf, billOf, coinsOf, dollars, verdictOf } from "./model.mjs";

const WIDTH = 640;
const HEIGHT = 420;

// A coin is 14 across and 2.5 thick. One coin is COIN dollars a month, here and in the column.
const CR = 7;
const CT = 2.5;
// The column rises 0.8 units for every $1,000 of the bill: a little more than a coin's height
// per coin, so the gap between $52,500 and the $55,000 ring still shows.
const PER_DOLLAR = 0.8 / 1000;
const FULL = PARTS.map((part) => coinsOf(partCost(part, false)));
const SAVED = PARTS.map((part) => coinsOf(savingOf(part)));

const PLATE = { x: -66, y: -26, w: 166, d: 74, r: 7 };
const PLATE_H = 10;
const FOOT_H = 6;

const XS = [-36, 0, 36];
const CAB = { x: -54, y: -14, w: 112, d: 28, r: 2.5 };
const CAB_H = 32;
const FACE = CAB.y + CAB.d;
const LID = { x: CAB.x - 1.2, y: CAB.y - 1.2, w: CAB.w + 2.4, d: CAB.d + 2.4, r: 3.4 };
const LID_Z = [CAB_H, CAB_H + 2.5];
const SOCKET_R = 9.6;
const SOCKET_Z = [LID_Z[1], LID_Z[1] + 3];
const FLOOR = SOCKET_Z[1];
const HOLE_R = CR + 0.2;
const GLASS_R = 8.2;
const GLASS_Z = [FLOOR, FLOOR + 29];
const CAP_Z = [GLASS_Z[1], GLASS_Z[1] + 3];

// The chute: a closed duct from a flange on the cabinet front, sloping down at 32° to an open
// mouth in its upright front face. A coin slides out of the mouth and drops into the cup.
const FLANGE = { w: 21, z: [23, 31.4], t: 1 };
const CHUTE = { w: 15, y0: FACE + FLANGE.t, y1: FACE + FLANGE.t + 13, top: 30.5, h: 6, wall: 0.8, angle: (32 * Math.PI) / 180 };
const TRAY = { x: -54, y: 22, w: 112, d: 22, r: 2 };
const TRAY_H = 2;
const CUP_Y = 33;
const CUP_R = 9.2;
const CUP_IN = 8;
const CUP_TOP = TRAY_H + 1.6;

// The levers, on the cabinet front beside each chute. Angle 0 points up, positive turns toward +x.
const LEVER_Y = FACE + 1.4;
const ARM = { length: 11, width: 2.4, thick: 1.4 };
const KNOB_R = 2.4;
const PIVOTS = XS.map((x) => [x + 15, 15]);
const REST = 0;
const THROWN = Math.PI;

// The total column and its ruler.
const COL = [74, 0];
const COL_BASE = { x: 64, y: -10, w: 26, d: 20, r: 2.5 };
const COL_BASE_H = 6;
const GLAND_Z = [COL_BASE_H, COL_BASE_H + 2];
const ZERO = GLAND_Z[1];
const COL_TOP = 80;
const ROD_R = 3;
const HEAD_R = 3.8;
const TARGET_Z = ZERO + TARGET * PER_DOLLAR;
const RULER = { x: 80.5, y: -2, w: 3, d: 4, r: 0.4 };
const BLADE = { y: -1, d: 2, h: 1.5 };
const STRIPE = 1.2;
const LABEL = { x: 62, y: 24, w: 24, d: 12, r: 1.2 };

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [XS[0] - SOCKET_R, 0, CAP_Z[1]], [XS[2] + SOCKET_R, 0, CAP_Z[1]], [RULER.x + RULER.w, 0, COL_TOP + 1.5]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 56 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const fix = (n) => Math.round(n * 10) / 10;
const poly = (points) => `M${points.map(([x, y]) => `${fix(x)} ${fix(y)}`).join("L")}Z`;
const [VX, VY] = k.towardViewer(P);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// The near half of a horizontal circle, limb to limb, in screen points.
function nearArc(cx, cy, r, z, n = 48) {
  const from = Math.atan2(VY, VX) - Math.PI / 2;
  return Array.from({ length: n + 1 }, (_, index) => {
    const t = from + (Math.PI * index) / n;
    return at([cx + r * Math.cos(t), cy + r * Math.sin(t), z]);
  });
}
// Everything below a ring's near arc: what a collar's front band covers.
function below(cx, cy, r, z) {
  const arc = nearArc(cx, cy, r, z);
  const a = arc[0];
  const b = arc[arc.length - 1];
  const s = Math.sign(b[0] - a[0]);
  return poly([[a[0] - s, a[1]], ...arc, [b[0] + s, b[1]], [b[0] + s, 2000], [a[0] - s, 2000]]);
}
// Everything above a ring's near arc: what you can see of a thing inside an opening.
function above(cx, cy, r, z) {
  const arc = nearArc(cx, cy, r, z);
  const a = arc[0];
  const b = arc[arc.length - 1];
  const s = Math.sign(b[0] - a[0]);
  return poly([[a[0] - s * 60, a[1]], ...arc, [b[0] + s * 60, b[1]], [b[0] + s * 60, -2000], [a[0] - s * 60, -2000]]);
}
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// One coin with its centre at a point, tilted about x by an angle (0 lies flat). The resting coins
// are <use> copies of the flat one built at the origin; the page draws the falling coin with this
// same function, so a coin that lands looks exactly like the copies already in the cup.
function coinSvg(centre, tilt) {
  const a = [0, Math.sin(tilt), Math.cos(tilt)];
  const F = G.frameOf(G.sub3(centre, G.mul3(a, CT / 2)), a, [1, 0, 0], G.cross3(a, [1, 0, 0]));
  const ribs = k.fadedSvg(G.ribsOf(F, 0, CT, CR, 30, P, { fade: [0.12, 0.6] }), { tone: "faint" });
  return k.solidSvg(G.disc(0, CT, CR, F, P), { tone: "hi", crease: "lo", inner: ribs }) + k.lineSvg(G.circleOf(F, CT, CR - 1.7, P), { tone: "faint" });
}

function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 15))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -PLATE_H + 3.5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 9.5);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Label plate at the front right: three rule lines stand for printed text.
  out.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(LABEL, 1.6), 0.8, P, 3), { tone: "faint" }));
  out.push(L([[3.6, 15], [6, 10], [8.4, 13]].map(([dy, w]) => k.lineOnTop([LABEL.x + 3.6, LABEL.y + dy], [LABEL.x + 3.6 + w, LABEL.y + dy], 0.8, P)).join(""), { tone: "lo", free: true }));
  out.push(D([at([LABEL.x + LABEL.w - 3, LABEL.y + 3, 0.8]), at([LABEL.x + LABEL.w - 3, LABEL.y + LABEL.d - 3, 0.8])], { size: 0.42 }));
  return out.join("");
}

function cabinet() {
  const out = [];
  const seam = k.sideSeam(CAB, 5, P, 4);
  // Panel joints between the three tube bays run from the kick seam up under the lid.
  const joints = [-18, 18].map((x) => k.segment([x, FACE, 5], [x, FACE, CAB_H], P)).join("");
  out.push(S(k.slabOf(CAB, 0, CAB_H, P, 4, 0.8), { tone: "mid", inner: L(seam, { tone: "faint" }) + L(joints, { tone: "faint" }) }));
  // An access panel on the right end, a closed outline with four screws.
  const endX = CAB.x + CAB.w;
  const panel = [];
  const [y0, y1, z0, z1, r] = [-9, 9, 9, 27, 1.6];
  for (const [cy, cz, from] of [[y1 - r, z1 - r, 0], [y0 + r, z1 - r, 90], [y0 + r, z0 + r, 180], [y1 - r, z0 + r, 270]]) {
    for (let step = 0; step <= 4; step++) {
      const angle = ((from + step * 22.5) * Math.PI) / 180;
      panel.push(at([endX, cy + r * Math.cos(angle), cz + r * Math.sin(angle)]));
    }
  }
  out.push(L(k.pathOf(panel, true), { tone: "lo" }));
  out.push(D([[y0 + 2.4, z0 + 2.4], [y1 - 2.4, z0 + 2.4], [y0 + 2.4, z1 - 2.4], [y1 - 2.4, z1 - 2.4]].map(([y, z]) => at([endX, y, z])), { size: 0.42 }));
  out.push(S(k.slabOf(LID, LID_Z[0], LID_Z[1] - LID_Z[0], P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(LID, 3), LID_Z[1], P, 4), { tone: "faint" }));
  out.push(D(k.corners(LID, 5).map(([x, y]) => at([x, y, LID_Z[1]])), { size: 0.45 }));
  return out.join("");
}

// The flange where a chute meets the cabinet front, with four screws.
function flange(cx) {
  const plan = { x: cx - FLANGE.w / 2, y: FACE, w: FLANGE.w, d: FLANGE.t, r: 0.3 };
  const out = [S(k.slabOf(plan, FLANGE.z[0], FLANGE.z[1] - FLANGE.z[0], P, 2, 0.3), { tone: "mid" })];
  const y = FACE + FLANGE.t;
  out.push(D([[-1, 0], [1, 0], [-1, 1], [1, 1]].map(([sx, row]) => at([cx + sx * (FLANGE.w / 2 - 1.8), y, row ? FLANGE.z[1] - 1.6 : FLANGE.z[0] + 1.6])), { size: 0.42 }));
  return out.join("");
}

// The lever hub on the cabinet front, and its stop pins at the rest and thrown angles.
function hub(index) {
  const [px, pz] = PIVOTS[index];
  const F = G.frameOf([px, FACE, pz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const out = [S(G.disc(0, LEVER_Y - FACE, 3, F, P), { tone: "mid", inner: L(G.circleOf(F, LEVER_Y - FACE, 1.9, P), { tone: "faint" }) })];
  for (const angle of [REST - 0.33, THROWN + 0.33]) {
    const r = 6.2;
    const pin = G.frameOf([px + Math.sin(angle) * r, FACE, pz + Math.cos(angle) * r], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    out.push(S(G.disc(0, 1.6, 0.8, pin, P), { tone: "mid" }));
  }
  return out.join("");
}

// The lever arm, its pivot cap and its knob at an angle. The page runs this same function.
function leverSvg(index, angle, lit) {
  const [px, pz] = PIVOTS[index];
  const F = G.frameOf([px, LEVER_Y, pz], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const half = ARM.width / 2;
  const along = (t, w) => [s * t + c * w, c * t - s * w];
  const bar = [along(-1.8, -half), along(ARM.length, -half), along(ARM.length, half), along(-1.8, half)];
  const arm = G.prismOf(F, bar, 0, ARM.thick, P);
  const cap = G.disc(ARM.thick, ARM.thick + 0.7, 1.3, F, P);
  const knob = G.sphereOf([px + s * ARM.length, LEVER_Y + ARM.thick / 2, pz + c * ARM.length], KNOB_R, P);
  const style = { tone: "hi", lit, crease: "lo" };
  return k.solidSvg(arm, style) + k.solidSvg(cap, style) + k.solidSvg(knob, style);
}

// One tube bay: the socket with its floor, the coin stack (clipped at the floor) and the glass.
function socket(cx) {
  const out = [S(k.cylinder(cx, 0, SOCKET_R, SOCKET_Z[0], SOCKET_Z[1] - SOCKET_Z[0], P, 48, 0.4), { tone: "mid", inner: L(k.sideArc(cx, 0, SOCKET_R, SOCKET_Z[0] + 1.2, P, 40), { tone: "faint" }) })];
  out.push(`<path class="bl-void" d="${k.ring(cx, 0, HOLE_R, FLOOR, P, 40)}"/>`);
  out.push(L(k.ring(cx, 0, GLASS_R, FLOOR, P, 48) + k.ring(cx, 0, HOLE_R, FLOOR, P, 40), { tone: "lo" }));
  return out.join("");
}

function glass(cx, cy, r, z0, z1) {
  const low = nearArc(cx, cy, r, z0);
  const high = nearArc(cx, cy, r, z1);
  const limbs = [[low[0], high[0]], [low[low.length - 1], high[high.length - 1]]].map(([a, b]) => `M${fix(a[0])} ${fix(a[1])}L${fix(b[0])} ${fix(b[1])}`).join("");
  const facing = Math.atan2(VY, VX);
  const sheen = (angle) => k.segment([cx + r * Math.cos(angle), cy + r * Math.sin(angle), z0], [cx + r * Math.cos(angle), cy + r * Math.sin(angle), z1], P);
  return `<path class="bl-glass" d="${poly([...low, ...[...high].reverse()])}"/>` + L(limbs, { tone: "lo" }) + L(sheen(facing + 0.86), { tone: "faint" }) + L(sheen(facing + 0.6), { tone: "mid", className: "bl-sheen" });
}

function cap(cx) {
  return (
    S(k.cylinder(cx, 0, SOCKET_R, CAP_Z[0], CAP_Z[1] - CAP_Z[0], P, 48, 0.5), { tone: "mid", inner: L(k.sideArc(cx, 0, SOCKET_R, CAP_Z[0] + 1, P, 40), { tone: "faint" }) }) +
    L(k.ring(cx, 0, SOCKET_R - 2.6, CAP_Z[1], P, 40), { tone: "faint" }) +
    D([at([cx, 0, CAP_Z[1]])], { size: 0.5 })
  );
}

// The chute in side view: an outline in (y, z), pushed across the bay along x. Its roof and floor
// slope at CHUTE.angle; its back stands on the flange and its upright front carries the mouth.
const SLOPE = Math.tan(CHUTE.angle);
const RUN = CHUTE.y1 - CHUTE.y0;
const SIDE = [[CHUTE.y0, CHUTE.top - CHUTE.h], [CHUTE.y1, CHUTE.top - CHUTE.h - RUN * SLOPE], [CHUTE.y1, CHUTE.top - RUN * SLOPE], [CHUTE.y0, CHUTE.top]];
const chuteFrame = (cx) => G.frameOf([cx - CHUTE.w / 2, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const MOUTH_Z = [CHUTE.top - CHUTE.h - RUN * SLOPE + CHUTE.wall, CHUTE.top - RUN * SLOPE - CHUTE.wall];
const mouthOf = (cx) => [[-1, 0], [1, 0], [1, 1], [-1, 1]].map(([side, up]) => at([cx + side * (CHUTE.w / 2 - CHUTE.wall), CHUTE.y1, MOUTH_Z[up]]));
function chute(cx) {
  const paths = G.prismOf(chuteFrame(cx), SIDE, 0, CHUTE.w, P);
  // A lid seam across the roof, edge to edge, and four screws holding the lid.
  const roof = (y, x) => at([cx + x, y, CHUTE.top - (y - CHUTE.y0) * SLOPE]);
  const seam = k.pathOf([roof(CHUTE.y1 - 3.5, -CHUTE.w / 2), roof(CHUTE.y1 - 3.5, CHUTE.w / 2)]);
  const mouth = poly(mouthOf(cx));
  return (
    S(paths, { tone: "mid", inner: L(seam, { tone: "faint" }) }) +
    `<path class="bl-void" d="${mouth}"/>` +
    L(mouth, { tone: "lo" }) +
    D([roof(CHUTE.y0 + 2.2, -4.6), roof(CHUTE.y0 + 2.2, 4.6), roof(CHUTE.y1 - 1.6, -4.6), roof(CHUTE.y1 - 1.6, 4.6)], { size: 0.42 })
  );
}
const chuteCorners = (cx) => [cx - CHUTE.w / 2, cx + CHUTE.w / 2].flatMap((x) => SIDE.map(([y, z]) => [x, y, z]));
// A coin may show outside the chute's silhouette, through its mouth and in front of the upright
// front face below the mouth's top edge, never over the rest of the duct. The clip fills by the
// nonzero rule: the frame and the window wind one way, the duct's silhouette the other.
const areaOf = (points) => points.reduce((sum, [x, y], index) => {
  const [nx, ny] = points[(index + 1) % points.length];
  return sum + x * ny - nx * y;
}, 0);
const wound = (points, sign) => (Math.sign(areaOf(points)) === sign ? points : [...points].reverse());
function chuteClip(cx) {
  const frame = [[-1000, -1000], [2000, -1000], [2000, 2000], [-1000, 2000]];
  const sign = Math.sign(areaOf(frame));
  const window = [[-1, MOUTH_Z[1]], [1, MOUTH_Z[1]], [1, -60], [-1, -60]].map(([side, z]) => at([cx + side * (CHUTE.w / 2), CHUTE.y1, z]));
  return poly(frame) + poly(wound(hull(chuteCorners(cx).map(at)), -sign)) + poly(wound(window, sign));
}
// The path of a coin from inside the chute to its place in the cup, for a share t from 0 to 1.
// It slides down the floor and out of the mouth, then falls and levels out. The page runs it too.
function dropAt(cx, slot, t) {
  const slope = Math.tan(CHUTE.angle);
  const n = [0, Math.sin(CHUTE.angle), Math.cos(CHUTE.angle)];
  const floorTop = CHUTE.top - CHUTE.h + CHUTE.wall;
  const on = (y) => [cx + 0, y + n[1] * (CT / 2), floorTop - (y - CHUTE.y0) * slope + n[2] * (CT / 2)];
  const from = CHUTE.y1 - CR * Math.cos(CHUTE.angle) - 0.3;
  const land = [cx, CUP_Y, TRAY_H + slot * CT + CT / 2];
  if (t < 0.4) {
    const share = t / 0.4;
    return { centre: on(from + (CHUTE.y1 - from) * share * share), tilt: CHUTE.angle };
  }
  const share = (t - 0.4) / 0.6;
  const start = on(CHUTE.y1);
  const ease = share * share * (3 - 2 * share);
  return {
    centre: [cx, start[1] + (land[1] - start[1]) * Math.min(1, share * 1.5), start[2] + (land[2] - start[2]) * share * share],
    tilt: CHUTE.angle * (1 - ease),
  };
}

function tray() {
  const out = [S(k.slabOf(TRAY, 0, TRAY_H, P, 4, 0.5), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(TRAY, 2.4), TRAY_H, P, 4), { tone: "faint" }));
  out.push(D(k.corners(TRAY, 3.6).map(([x, y]) => at([x, y, TRAY_H])), { size: 0.42 }));
  return out.join("");
}

function cup(cx, clip) {
  return (
    S(k.cylinder(cx, CUP_Y, CUP_R, TRAY_H, CUP_TOP - TRAY_H, P, 48, 0.4), { tone: "mid" }) +
    `<path class="bl-void" d="${k.ring(cx, CUP_Y, CUP_IN, CUP_TOP, P, 48)}"/>` +
    `<g clip-path="${clip}"><path class="bl-floor" d="${k.ring(cx, CUP_Y, CUP_IN, TRAY_H, P, 48)}"/></g>` +
    L(k.ring(cx, CUP_Y, CUP_IN, CUP_TOP, P, 48), { tone: "lo" })
  );
}

// The total column: a rod that rises out of a gland, as tall as the bill. A blade on its head
// points at the ruler beside it, where a band marks the $55,000 target.
function columnBase() {
  const out = [S(k.slabOf(COL_BASE, 0, COL_BASE_H, P, 4, 0.6), { tone: "mid" })];
  out.push(D(k.corners(COL_BASE, 3).map(([x, y]) => at([x, y, COL_BASE_H])), { size: 0.45 }));
  out.push(S(k.cylinder(COL[0], COL[1], 6, GLAND_Z[0], GLAND_Z[1] - GLAND_Z[0], P, 48, 0.4), { tone: "mid" }));
  out.push(`<path class="bl-void" d="${k.ring(COL[0], COL[1], ROD_R + 0.5, ZERO, P, 32)}"/>`);
  out.push(L(k.ring(COL[0], COL[1], ROD_R + 0.5, ZERO, P, 32), { tone: "lo" }));
  return out.join("");
}
// The rod, its head and the pointer blade at a bill total. The page runs this same function.
function rodSvg(total) {
  const top = ZERO + total * PER_DOLLAR;
  const blade = { x: COL[0], y: BLADE.y, w: RULER.x - COL[0] - 0.05, d: BLADE.d, r: 0.3 };
  return (
    k.solidSvg(k.cylinder(COL[0], COL[1], ROD_R, ZERO, top - 1.4 - ZERO, P, 28), { tone: "hi", crease: "none" }) +
    k.solidSvg(k.slabOf(blade, top - BLADE.h, BLADE.h, P, 2), { tone: "hi", crease: "lo" }) +
    k.solidSvg(k.cylinder(COL[0], COL[1], HEAD_R, top - 1.4, 1.4, P, 36, 0.3), { tone: "hi", crease: "lo" })
  );
}
// The ruler beside the column: a tick every $5,000 and a long one every $25,000, all hanging
// from the strip's left silhouette edge, where the blade's tip rides.
function ruler() {
  // The target mark is a painted stripe round the strip at $55,000. Its edges are seams on the
  // faces you can see, so they end on the strip's outline.
  const ring = k.ringOf(RULER, 2);
  const [vx, vy] = k.towardViewer(P);
  const facing = ring.map(([ax, ay], index) => {
    const [bx, by] = ring[(index + 1) % ring.length];
    return (by - ay) * vx - (bx - ax) * vy > 0;
  });
  const start = facing.findIndex((on, index) => on && !facing[(index + ring.length - 1) % ring.length]);
  const run = [];
  for (let step = 0; step <= ring.length; step++) {
    const index = (start + step) % ring.length;
    run.push(ring[index]);
    if (!facing[index]) break;
  }
  const at2 = (z) => run.map(([x, y]) => at([x, y, z]));
  const stripe = `<path class="bl-stripe" d="${poly([...at2(TARGET_Z + STRIPE / 2), ...at2(TARGET_Z - STRIPE / 2).reverse()])}"/>`;
  const edges = L(k.sideSeam(RULER, TARGET_Z + STRIPE / 2, P, 2) + k.sideSeam(RULER, TARGET_Z - STRIPE / 2, P, 2), { tone: "hi" });
  const out = [S(k.slabOf(RULER, COL_BASE_H, COL_TOP - COL_BASE_H, P, 2, 0.3), { tone: "mid", inner: stripe + edges })];
  const face = RULER.y + RULER.d;
  const minor = [];
  const major = [];
  for (let value = 0; value <= 85000; value += 5000) {
    if (value === TARGET) continue;
    const z = ZERO + value * PER_DOLLAR;
    (value % 25000 === 0 ? major : minor).push(k.segment([RULER.x, face, z], [RULER.x + (value % 25000 === 0 ? 2.2 : 1.3), face, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(RULER, -0.5), COL_TOP, 1.5, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

// Where a click on the drawing toggles a lever: the tube, the lever and the chute of one bay.
function hitArea(index) {
  const cx = XS[index];
  const [px, pz] = PIVOTS[index];
  const points = [
    ...k.boxCorners({ x: cx - SOCKET_R, y: -SOCKET_R, w: SOCKET_R * 2, d: SOCKET_R * 2 }, LID_Z[1], CAP_Z[1]),
    ...k.boxCorners({ x: px - 13, y: FACE, w: 26, d: 4 }, pz - 12, pz + 14),
    ...chuteCorners(cx),
  ].map(at);
  return poly(hull(points));
}

export function build({ fig = "Fig 1", id = "bill" } = {}) {
  const coin = `${id}-coin`;
  const use = (x, y, z, extra = "") => `<use href="#${coin}" transform="${k.translateAlong(P, [x, y, z])}"${extra}/>`;
  const defs = [
    `<g id="${coin}">${coinSvg([0, 0, CT / 2], 0)}</g>`,
    ...XS.map((cx, index) => `<clipPath id="${id}-stack-${index}"><path d="${above(cx, 0, HOLE_R, FLOOR)}"/></clipPath>`),
    ...XS.map((cx, index) => `<clipPath id="${id}-cup-${index}"><path d="${above(cx, CUP_Y, CUP_IN, CUP_TOP)}"/></clipPath>`),
    ...XS.map((cx, index) => `<clipPath id="${id}-mouth-${index}"><path d="${k.ring(cx, CUP_Y, CUP_IN, CUP_TOP, P, 48)}"/></clipPath>`),
    ...XS.map((cx, index) => `<clipPath id="${id}-chute-${index}"><path clip-rule="nonzero" d="${chuteClip(cx)}"/></clipPath>`),
  ];

  const bays = XS.map((cx, index) => {
    const stack = Array.from({ length: FULL[index] }, (_, slot) => use(cx, 0, FLOOR + slot * CT, ` data-slot="${slot}"`)).join("");
    return socket(cx) + `<g clip-path="url(#${id}-stack-${index})"><g data-stack="${index}">${stack}</g></g>` + glass(cx, 0, GLASS_R, GLASS_Z[0], GLASS_Z[1]) + cap(cx);
  });
  const fronts = XS.map((cx, index) => {
    const saved = Array.from({ length: SAVED[index] }, (_, slot) => use(cx, CUP_Y, TRAY_H + slot * CT, ` data-slot="${slot}" style="display:none"`)).join("");
    return (
      cup(cx, `url(#${id}-mouth-${index})`) +
      `<g clip-path="url(#${id}-cup-${index})"><g data-cup="${index}">${saved}</g></g>` +
      chute(cx) +
      `<g clip-path="url(#${id}-cup-${index})"><g clip-path="url(#${id}-chute-${index})"><g data-fall="${index}"></g></g></g>`
    );
  });

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "A coin bank on a base plate. Three glass tubes stand on a cabinet, one for each part of a help-desk assistant's monthly bill: repeated instructions, background material and answers. Each coin is $3,750 a month, so the tubes hold 6, 8 and 8 coins. A lever on the cabinet front under each tube drops that part's saving down a chute into a cup on the tray. A rod on the right rises as tall as the total bill. A blade on the rod points at a ruler with a band at the $55,000 target.",
    body: [
      `<defs>${defs.join("")}</defs>`,
      base(),
      cabinet(),
      XS.map(flange).join(""),
      PIVOTS.map((_, index) => hub(index)).join(""),
      bays.join(""),
      columnBase(),
      `<g data-part="rod">${rodSvg(billOf([false, false, false]))}</g>`,
      ruler(),
      PIVOTS.map((_, index) => `<g data-lever="${index}">${leverSvg(index, REST, false)}</g>`).join(""),
      tray(),
      fronts.join(""),
      XS.map((_, index) => `<path class="bl-hit" data-hit="${index}" d="${hitArea(index)}"/>`).join(""),
    ],
  });

  const stage = stageHtml({
    svg,
    label: "Coin bank. Press 1, 2 or 3 to throw or return a lever. Press R to reset all levers.",
    role: "group",
  });

  const start = billOf([false, false, false]);
  const meter = PARTS.map((part, index) => `<div><dt>${part.name}</dt><dd><span data-out="${index}">${dollars(partCost(part, false))}</span><span class="bl-save" data-save="${index}"></span></dd></div>`).join("");
  const controls = `<div class="bl-levers" role="group" aria-label="Changes">${PARTS.map(
    (part, index) =>
      `<button class="btn bl-lever" type="button" data-toggle="${index}" aria-pressed="false" aria-label="${part.change}, from ${part.from.toLocaleString("en-US")} to ${part.to.toLocaleString("en-US")} ${part.meter} tokens"><span class="bl-text"><span>${part.change}</span><span class="bl-change">${part.from.toLocaleString("en-US")} → ${part.to.toLocaleString("en-US")} ${part.meter} tokens</span></span></button>`,
  ).join("")}</div>
<dl class="fig-meter bl-meter">${meter}<div><dt>Total · target ${dollars(TARGET)}</dt><dd><span data-out="total">${dollars(start)}</span><span class="bl-save" data-save="total"></span></dd></div></dl>
<div class="bl-foot"><p class="bl-verdict" data-verdict aria-live="polite">${verdictOf([false, false, false])}</p><button class="btn" type="button" data-reset>Reset</button></div>`;

  const html = plate({
    id,
    fig,
    title: "Lower the bill",
    hint: "Throw any two levers",
    readout: `${dollars(start)} a month · $0 saved`,
    keys: [
      { mark: "lit", label: "Levers: each lever makes one change" },
      { mark: "raised", label: `Coins: each coin is ${dollars(COIN)} a month` },
      { mark: "edge", label: `Column and ruler: the total bill and the ${dollars(TARGET)} target band` },
    ],
    caption: `A help-desk assistant handles ${REQUESTS_PER_DAY.toLocaleString("en-US")} requests a day for ${DAYS} days. Input costs $${RATES.input} per million tokens. Output costs $${RATES.output} per million tokens. The request volume and the rates are examples. Real providers use their own rates.`,
    stage,
    controls,
  });

  const script = `
const P = ${JSON.stringify(P)};
const REQUESTS_PER_DAY = ${REQUESTS_PER_DAY}, DAYS = ${DAYS}, TARGET = ${TARGET}, COIN = ${COIN};
const RATES = ${JSON.stringify(RATES)};
const PARTS = ${JSON.stringify(PARTS)};
const costOf = ${costOf.toString()};
const partCost = ${partCost.toString()};
const savingOf = ${savingOf.toString()};
const billOf = ${billOf.toString()};
const coinsOf = ${coinsOf.toString()};
const dollars = ${dollars.toString()};
${verdictOf.toString()}
const FULL = ${JSON.stringify(FULL)}, SAVED = ${JSON.stringify(SAVED)};
const XS = ${JSON.stringify(XS)}, PIVOTS = ${JSON.stringify(PIVOTS)}, ARM = ${JSON.stringify(ARM)};
const LEVER_Y = ${LEVER_Y}, KNOB_R = ${KNOB_R}, REST = ${REST}, THROWN = ${THROWN};
const CR = ${CR}, CT = ${CT}, FLOOR = ${FLOOR}, TRAY_H = ${TRAY_H}, CUP_Y = ${CUP_Y};
const CHUTE = ${JSON.stringify(CHUTE)};
const COL = ${JSON.stringify(COL)}, ZERO = ${ZERO}, ROD_R = ${ROD_R}, HEAD_R = ${HEAD_R}, PER_DOLLAR = ${PER_DOLLAR};
const RULER = ${JSON.stringify(RULER)}, BLADE = ${JSON.stringify(BLADE)};
${coinSvg.toString()}
${dropAt.toString()}
${leverSvg.toString()}
${rodSvg.toString()}
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const say = readoutOf(root);
const verdict = root.querySelector("[data-verdict]");
const buttons = [...root.querySelectorAll("[data-toggle]")];
const levers = [...svg.querySelectorAll("[data-lever]")];
const stacks = [...svg.querySelectorAll("[data-stack]")];
const cups = [...svg.querySelectorAll("[data-cup]")];
const falls = [...svg.querySelectorAll("[data-fall]")];
const rod = svg.querySelector('[data-part="rod"]');
const outs = [0, 1, 2, "total"].map((key) => root.querySelector('[data-out="' + key + '"]'));
const saves = [0, 1, 2, "total"].map((key) => root.querySelector('[data-save="' + key + '"]'));
const RATE = 2.4; // coins a second
const on = [false, false, false];
// Each bay: the lever on a spring, and out, the coins already sent toward the cup (continuous).
const bays = XS.map(() => ({ lever: { at: 0, rate: 0 }, out: 0, drawn: null, fall: -1 }));
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const setOf = (node, list) => node.querySelectorAll("[data-slot]").forEach((el, slot) => {
  const want = slot < list ? "" : "none";
  if (el.style.display !== want) el.style.display = want;
});
let rodAt = billOf(on), rodShown = null, settledText = verdict.textContent;
let touring = !STILL.matches, clock = -1.4, idleTimer = 0;

// One bay from its state: the stack, the coin in flight and the cup.
function drawBay(index, nudge) {
  const bay = bays[index];
  const k0 = Math.min(Math.floor(bay.out), SAVED[index]);
  const f = bay.out - k0;
  const inTube = FULL[index] - k0;
  const drop = k0 < SAVED[index] ? CT * smooth(f / 0.3) : 0;
  setOf(stacks[index], inTube);
  stacks[index].setAttribute("transform", drop ? translateAlong(P, [0, 0, -drop]) : "");
  setOf(cups[index], k0);
  const falling = k0 < SAVED[index] && f > 0.3;
  const fallKey = falling ? Math.round(f * 400) : -1;
  if (fallKey !== bay.fall) {
    bay.fall = fallKey;
    if (falling) {
      const { centre, tilt } = dropAt(XS[index], k0, (f - 0.3) / 0.7);
      falls[index].innerHTML = coinSvg(centre, tilt);
    } else falls[index].innerHTML = "";
  }
  const angle = REST + (THROWN - REST) * bay.lever.at + nudge;
  const moving = Math.abs(bay.lever.rate) > 0.02 || Math.abs((on[index] ? SAVED[index] : 0) - bay.out) > 1e-4 || nudge !== 0;
  const key = Math.round(angle * 2000) + (moving ? "L" : "");
  if (key !== bay.drawn) {
    bay.drawn = key;
    levers[index].innerHTML = leverSvg(index, angle, moving);
  }
  return k0;
}

function draw(nudges) {
  let total = 0;
  bays.forEach((bay, index) => {
    const landed = drawBay(index, nudges[index]);
    const cost = (FULL[index] - landed) * COIN;
    total += cost;
    outs[index].textContent = dollars(cost);
    saves[index].textContent = landed ? "saves " + dollars(landed * COIN) : "";
  });
  const saved = billOf([false, false, false]) - total;
  outs[3].textContent = dollars(total);
  saves[3].textContent = saved ? "saves " + dollars(saved) : "";
  say(dollars(total) + " a month · " + dollars(saved) + " saved");
  return total;
}

const loop = figureLoop(stage, (dt, calm) => {
  let busy = false;
  let tour = false;
  const nudges = [0, 0, 0];
  if (touring) {
    clock += dt;
    if (clock > 0) {
      const beat = Math.floor(clock / 2.4);
      const t = clock - beat * 2.4;
      const idle = [0, 1, 2].filter((index) => !on[index]);
      if (idle.length && t < 0.9) nudges[idle[beat % idle.length]] = 0.13 * Math.sin((Math.PI * t) / 0.9);
    }
    tour = true;
  }
  bays.forEach((bay, index) => {
    const still = springTo(bay.lever, on[index] ? 1 : 0, dt, 170, 21, calm);
    const goal = on[index] && bay.lever.at > 0.9 ? SAVED[index] : on[index] ? bay.out : 0;
    if (calm) bay.out = on[index] ? SAVED[index] : 0;
    else if (bay.out < goal) bay.out = Math.min(goal, bay.out + RATE * dt);
    else if (bay.out > goal) bay.out = Math.max(goal, bay.out - RATE * dt);
    if (!still || bay.out !== (on[index] ? SAVED[index] : 0)) busy = true;
  });
  const total = draw(nudges);
  rodAt = follow(rodAt, total, dt, 0.18, calm);
  if (Math.abs(rodAt - total) < 5) rodAt = total;
  const shown = Math.round(rodAt * PER_DOLLAR * 50) / 50;
  if (shown !== rodShown) {
    rodShown = shown;
    rod.innerHTML = rodSvg(shown / PER_DOLLAR);
  }
  if (rodAt !== total) busy = true;
  // The verdict speaks once the coins have settled, so it never runs ahead of the drawing.
  if (!busy) {
    const text = verdictOf(on);
    if (text !== settledText) { settledText = text; verdict.textContent = text; }
    verdict.toggleAttribute("data-won", billOf(on) < TARGET);
  }
  return busy || tour;
});

function takeOver() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !STILL.matches; clock = 0; loop.kick(); }, 6000);
}
function toggle(index) {
  takeOver();
  on[index] = !on[index];
  buttons[index].setAttribute("aria-pressed", String(on[index]));
  loop.kick();
}
function reset() {
  takeOver();
  on.fill(false);
  buttons.forEach((button) => button.setAttribute("aria-pressed", "false"));
  loop.kick();
}
buttons.forEach((button, index) => button.addEventListener("click", () => toggle(index)));
root.querySelector("[data-reset]").addEventListener("click", reset);
svg.querySelectorAll("[data-hit]").forEach((hit) => hit.addEventListener("click", () => toggle(Number(hit.dataset.hit))));
stage.addEventListener("pointerenter", takeOver);
stage.addEventListener("focus", takeOver);
root.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (["1", "2", "3"].includes(event.key)) toggle(Number(event.key) - 1);
  else if (event.key === "r" || event.key === "R") reset();
  else return;
  event.preventDefault();
});
if (STILL.matches) touring = false;
loop.kick();
`;

  const css = `
[data-fig="${id}"] .bl-glass{fill:var(--anatomy-hi);opacity:.04;stroke:none}
[data-fig="${id}"] .bl-sheen{opacity:.55}
[data-fig="${id}"] .bl-void{fill:var(--anatomy-shade-0);stroke:none}
[data-fig="${id}"] .bl-floor{fill:var(--anatomy-shade-2);stroke:none}
[data-fig="${id}"] .bl-stripe{fill:var(--anatomy-hi);stroke:none}
[data-fig="${id}"] .bl-hit{fill:transparent;stroke:none;cursor:pointer}
[data-fig="${id}"] .iso-stage svg{-webkit-tap-highlight-color:transparent}
[data-fig="${id}"] .bl-levers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0 0}
[data-fig="${id}"] .bl-lever{justify-content:flex-start;min-height:56px;padding:9px 13px;text-align:left;line-height:1.4}
[data-fig="${id}"] .bl-text{display:flex;flex-direction:column;gap:4px}
[data-fig="${id}"] .bl-change{color:var(--anatomy-muted);letter-spacing:.04em}
[data-fig="${id}"] .bl-lever[aria-pressed="true"] .bl-change{color:var(--anatomy-text)}
[data-fig="${id}"] .bl-meter dd{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px}
[data-fig="${id}"] .bl-save{font:11px/1.3 var(--anatomy-mono);letter-spacing:.04em;color:var(--anatomy-muted)}
[data-fig="${id}"] .bl-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:14px 0 0}
[data-fig="${id}"] .bl-verdict{flex:1 1 320px;margin:0;padding:10px 14px;background:var(--anatomy-card);box-shadow:inset 2px 0 0 var(--anatomy-mid),0 0 0 1px var(--anatomy-faint);color:var(--anatomy-text);font-size:15px;line-height:1.5}
[data-fig="${id}"] .bl-verdict[data-won]{box-shadow:inset 2px 0 0 var(--anatomy-strong),0 0 0 1px var(--anatomy-lo);color:var(--anatomy-strong)}
@media (max-width:760px){[data-fig="${id}"] .bl-levers{grid-template-columns:1fr}}
`;
  return { html, css, script, needs: ["lathe"] };
}
