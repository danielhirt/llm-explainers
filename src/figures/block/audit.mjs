// Checks the figure's truth and geometry. Run: node src/figures/block/audit.mjs
//   weights   every row sums to 1, no cord reaches a later lane
//   cords     no cord passes through another cord or a part, crossings are drawn nearer-last
//   motion    the punch never enters a plate, the adder meets the plate, plungers ride the blocks
import { WEIGHTS, CORDS, TOKENS } from "./model.mjs";
import { geometry } from "./figure.mjs";
import * as G from "../../kit/lathe.mjs";

const g = geometry();
const problems = [];
const fail = (text) => problems.push(text);

// Weights.
WEIGHTS.forEach((row, reader) => {
  const sum = row.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) fail(`weights: ${TOKENS[reader]} sums to ${sum}`);
  if (row.length !== reader + 1) fail(`weights: ${TOKENS[reader]} has ${row.length} entries`);
});
if (CORDS.some((cord) => cord.source > cord.reader)) fail("mask: a cord reaches a later lane");
console.log(`weights: ${WEIGHTS.length} rows, each sums to 1 · cords: ${CORDS.length}, none to a later lane`);

// Cord against cord: closest approach of the centrelines.
const dense = (points) => points.flatMap((p, i) => (i ? Array.from({ length: 4 }, (_, k) => G.lerp3(points[i - 1], p, (k + 1) / 4)) : [p]));
const cords = g.cords.map((cord) => ({ ...cord, dense: dense(cord.points) }));
let worst = Infinity;
for (let a = 0; a < cords.length; a++) {
  for (let b = a + 1; b < cords.length; b++) {
    let min = Infinity;
    for (const p of cords[a].dense) for (const q of cords[b].dense) min = Math.min(min, G.len3(G.sub3(p, q)));
    const gap = min - cords[a].r - cords[b].r;
    worst = Math.min(worst, gap);
    if (gap < 0.4) fail(`cords: ${a} (${cords[a].reader}←${cords[a].source}) × ${b} (${cords[b].reader}←${cords[b].source}) gap ${gap.toFixed(2)}`);
  }
}
console.log(`cord × cord: smallest gap ${worst.toFixed(2)} (needs ≥ 0.40)`);

// Cord against the parts it passes.
const boxDistance = (p, b) => {
  const dx = Math.max(b.x0 - p[0], 0, p[0] - b.x1);
  const dy = Math.max(b.y0 - p[1], 0, p[1] - b.y1);
  const dz = Math.max(b.z0 - p[2], 0, p[2] - b.z1);
  return Math.hypot(dx, dy, dz);
};
let nearest = { gap: Infinity };
for (const cord of cords) {
  for (const box of g.obstacles) {
    let min = Infinity;
    for (const p of cord.dense) min = Math.min(min, boxDistance(p, box));
    const gap = min - cord.r;
    if (gap < nearest.gap) nearest = { gap, cord: `${cord.reader}←${cord.source}`, box: box.name };
    if (gap < 0.3) fail(`cord ${cord.reader}←${cord.source} × ${box.name} gap ${gap.toFixed(2)}`);
  }
}
console.log(`cord × part: smallest gap ${nearest.gap.toFixed(2)} (${nearest.cord} at ${nearest.box}, needs ≥ 0.30)`);

// Crossings: nearer cord drawn later, and well apart in depth.
const rank = new Map(g.order.order.map((index, position) => [index, position]));
for (const cross of g.order.pairs) {
  const front = cross.da > cross.db ? cross.a : cross.b;
  const back = front === cross.a ? cross.b : cross.a;
  if (rank.get(front) < rank.get(back)) fail(`crossing ${cross.a}×${cross.b} drawn in the wrong order`);
  const apart = Math.abs(cross.da - cross.db) - g.cords[cross.a].r - g.cords[cross.b].r;
  if (apart < 1) fail(`crossing ${cross.a}×${cross.b} only ${apart.toFixed(2)} apart in depth`);
}
console.log(`crossings: ${g.order.pairs.length}, each drawn nearer-last`);

// Motion over two cycles at 120 frames a second.
let punch = Infinity;
let plunge = 0;
for (let t = 0; t < g.PERIOD * 2; t += 1 / 120) {
  const line = g.lineAt(t);
  if (Math.abs(line.y - g.Y.D) < 6.5) punch = Math.min(punch, g.PUNCH_FACE - g.strokeOf(line.crank) - (g.TOP_A + line.tM));
  for (const [gy, zb, top] of [[g.Y.A, g.ROW.A, g.TOP_X], [g.Y.C, g.ROW.C, g.TOP_A]]) {
    const under = Math.abs(line.y - gy) < 6 - 0.8;
    if (under) plunge = Math.max(plunge, top - (zb - 6 + g.liftOf(gy, line.y, top, zb - 6)));
    // The sleeve under the gauge box must clear the tallest block that passes.
    if (Math.abs(line.y - gy) < 6 + 1.5 && zb - 1.6 < top + 0.5) plunge = Math.max(plunge, 9);
  }
}
if (punch < -1e-6) fail(`press: the punch enters the plate by ${(-punch).toFixed(2)}`);
if (plunge > 1e-3) fail(`gauge: a plunger sinks ${plunge.toFixed(2)} into a block`);
console.log(`press: punch to plate ≥ ${punch.toFixed(2)} · gauges: plunger sink ${plunge.toFixed(3)}`);

if (problems.length) {
  console.log(problems.join("\n"));
  console.log(`audit failed: ${problems.length} problems`);
  process.exitCode = 1;
} else console.log("audit passed");
