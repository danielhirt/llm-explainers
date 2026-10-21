// Decoding as one pure model. The build draws the wheel from it and the page runs the same
// functions, so the pockets, the shutters, the table and the readout can't disagree.
// Scores are illustrative. A real model scores every vocabulary entry; the figure shows eight.

export const PROMPT = ["We", " walked", " home", " in", " the"];
export const STEPS = 3; // tokens the composing stick holds after the prompt
export const TAU = { min: 0.2, max: 2, step: 0.1, start: 0.8 };
export const TOP_K = 3;
export const TOP_P = 0.9;
export const MODES = [
  { key: "greedy", label: "Greedy" },
  { key: "top-k", label: "Top-k" },
  { key: "top-p", label: "Top-p" },
];

// Logits for the next token. The second step depends on the first pick, so the scores
// change with the context, as they do in a real model.
export const ADJECTIVES = [[" cold", 4.0], [" dark", 3.4], [" thick", 2.9], [" heavy", 2.4], [" quiet", 2.0], [" grey", 1.7], [" wet", 1.3], [" thin", 0.9]];
export const NOUNS = [[" rain", 3.2], [" fog", 2.9], [" wind", 2.6], [" mist", 2.3], [" snow", 2.1], [" night", 1.8], [" haze", 1.4], [" sleet", 1.1]];
export const LIFT = {
  " cold": { " wind": 0.9, " sleet": 1.1 },
  " dark": { " night": 1.7 },
  " thick": { " fog": 1.5, " mist": 0.6 },
  " heavy": { " rain": 0.8, " snow": 0.6 },
  " quiet": { " snow": 1.0, " night": 0.9 },
  " grey": { " mist": 1.1, " haze": 0.8 },
  " wet": { " rain": 0.5, " sleet": 1.3 },
  " thin": { " mist": 1.2, " haze": 1.1 },
};
export const ENDINGS = [[".", 3.6], [" again", 2.9], [",", 2.6], [" and", 2.4], [" today", 1.9], [" alone", 1.6], [" too", 1.2], [" now", 0.9]];

// The eight candidates after `picked` (the generated tokens so far), sorted by logit, largest first.
export function candidatesFor(picked) {
  let list = ENDINGS;
  if (picked.length === 0) list = ADJECTIVES;
  else if (picked.length === 1) {
    const lift = LIFT[picked[0]] || {};
    list = NOUNS.map(([token, z]) => [token, z + (lift[token] || 0)]);
  }
  return list.map(([token, z]) => ({ token, z: Math.round(z * 10) / 10 })).sort((a, b) => b.z - a.z);
}

// p_i = exp(z_i / τ) / Σ_j exp(z_j / τ). Subtracting the largest logit first changes nothing but rounding.
export function softmax(logits, tau) {
  const top = Math.max(...logits);
  const weights = logits.map((z) => Math.exp((z - top) / tau));
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => w / total);
}

// Which candidates the rule keeps, for probabilities sorted largest first.
// Greedy keeps the largest. Top-k keeps the k largest. Top-p keeps the smallest set whose sum reaches p.
export function keptOf(p, mode) {
  if (mode === "greedy") return p.map((_, index) => index === 0);
  if (mode === "top-k") return p.map((_, index) => index < TOP_K);
  let sum = 0;
  return p.map((value) => {
    const keep = sum < TOP_P - 1e-12;
    sum += value;
    return keep;
  });
}

// The distribution the draw uses: kept probabilities divided by their sum, zero elsewhere.
export function drawOf(p, kept) {
  const mass = p.reduce((sum, value, index) => sum + (kept[index] ? value : 0), 0);
  return p.map((value, index) => (kept[index] ? value / mass : 0));
}

// Inverse CDF: u in [0, 1) picks the candidate whose share of the draw contains it.
export function pickOf(q, u) {
  let sum = 0;
  let last = 0;
  for (let index = 0; index < q.length; index++) {
    if (!(q[index] > 0)) continue;
    last = index;
    sum += q[index];
    if (u < sum) return index;
  }
  return last;
}

// Everything the figure shows for one step.
export function stepOf(picked, tau, mode) {
  const candidates = candidatesFor(picked);
  const p = softmax(candidates.map((c) => c.z), tau);
  const kept = keptOf(p, mode);
  const q = drawOf(p, kept);
  const mass = p.reduce((sum, value, index) => sum + (kept[index] ? value : 0), 0);
  return { candidates, p, kept, q, mass, open: kept.filter(Boolean).length };
}
