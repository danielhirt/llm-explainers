// One pre-norm decoder block as one pure model. The build draws the cords, plates and stops
// from it, and the page runs the same functions, so the drawing, the readout and the meter agree.
//
//   x ← x + Attention(RMSNorm(x))
//   x ← x + MLP(RMSNorm(x))
//
// Attention: position i reads positions 0..i only (the causal mask), and its weights sum to 1.
// The weights are one head of the old Figure 5 (illustrative, not from a trained model).
// MLP: the same weights act on each position on its own.
// Residual: the lane carries x past both sublayers, and each sublayer adds one update to it.

export const TOKENS = ["the", "river", "bank", "flooded"];

// Row i holds what position i reads from positions 0..i. Later positions are masked.
export const WEIGHTS = [
  [1.0],
  [0.55, 0.45],
  [0.3, 0.5, 0.2],
  [0.25, 0.25, 0.3, 0.2],
];

export const MODES = [
  { key: "full", label: "Full block" },
  { key: "attention", label: "Attention" },
  { key: "mlp", label: "MLP" },
  { key: "residual", label: "Residual" },
];

// 0 for a masked (later) position.
export const weightOf = (reader, source) => (source <= reader ? WEIGHTS[reader][source] : 0);
export const rowSum = (reader) => WEIGHTS[reader].reduce((sum, w) => sum + w, 0);
// The source with the largest weight in a row (the first one on a tie).
export const strongestOf = (reader) => WEIGHTS[reader].reduce((best, w, source) => (w > WEIGHTS[reader][best] ? source : best), 0);

// Every cord the switchboard needs: one per (reader, source) pair that the mask allows.
export const CORDS = WEIGHTS.flatMap((row, reader) => row.map((w, source) => ({ reader, source, w })));

// The words the attention readout uses.
export function readsText(reader) {
  const source = strongestOf(reader);
  const name = source === reader ? "itself" : TOKENS[source];
  return `${TOKENS[reader]} reads ${name} ${WEIGHTS[reader][source].toFixed(2)}`;
}
