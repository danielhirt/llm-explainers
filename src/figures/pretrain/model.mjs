// One pre-training step as one pure model. The build draws the bench from it and the page runs
// the same functions, so the gauges, the loss columns, the loss dial and the readout agree.
//
// The text is seven tokens. The targets are the same text shifted one position left, so six
// positions get graded: the target at each position is the next token.
//
// The probabilities are illustrative. The toy gives each position one score (the log-odds of its
// target), and each step moves that score up by RATE · (1 − p). That is a gradient step on −log p:
// the gradient of −log p with respect to the target's score is p − 1. Positions the model gets
// badly wrong move the most. The loss of each position is −log p, in nats, computed exactly.

export const TOKENS = ["The", "old", "light", "house", "watched", "the", "fog"];
export const INPUTS = TOKENS.slice(0, -1);
export const TARGETS = TOKENS.slice(1);
export const POSITIONS = INPUTS.length;

// Before step 1. "light → house" is 0.80 (loss 0.223) and "house → watched" is 0.05 (loss 2.996),
// the worked numbers in the article.
export const P_START = [0.1, 0.2, 0.8, 0.05, 0.6, 0.15];
export const RATE = 0.3;

export const lossOf = (p) => -Math.log(p);
export const meanOf = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (score) => 1 / (1 + Math.exp(-score));

// The target probabilities after `updates` optimizer steps (0 = the starting weights).
export function probsAt(updates) {
  let scores = P_START.map(logit);
  for (let step = 0; step < updates; step++) scores = scores.map((score) => score + RATE * (1 - sigmoid(score)));
  return scores.map(sigmoid);
}

// What step n (1, 2, 3 …) measures: the forward pass runs with the weights after n − 1 updates.
export function stepOf(n) {
  const probs = probsAt(Math.max(0, n - 1));
  const losses = probs.map(lossOf);
  return { n, probs, losses, mean: meanOf(losses) };
}

// The weights are a bank of trim screws. AdamW scales each update by the gradient's running size,
// so every weight moves by about the same small amount; the sign of its gradient sets the way it
// turns. The signs and sizes here are illustrative.
export const SCREWS = [
  { sign: 1, size: 1 },
  { sign: -1, size: 0.8 },
  { sign: 1, size: 0.9 },
  { sign: -1, size: 1 },
  { sign: 1, size: 0.7 },
  { sign: -1, size: 0.9 },
  { sign: 1, size: 0.8 },
  { sign: 1, size: 1 },
  { sign: -1, size: 0.7 },
  { sign: 1, size: 0.9 },
];
export const TURN_PER_STEP = 22; // degrees, for a screw of size 1
export const screwAngle = (screw, updates) => screw.sign * screw.size * TURN_PER_STEP * updates;
