// The embedding lookup as one pure model. The build draws the cards from these rows and the
// page runs the same readout, so the drawers, the sliders and the words cannot disagree.
// Sizes and values are illustrative: a real table has |V| rows of d_model learned numbers.

export const VOCAB = 50257; // |V|: rows in the embedding table E
export const D_MODEL = 4096; // values in each row
export const SHOWN = 8; // values each card shows

// The sentence "The old lighthouse watched the fog" as token IDs, in sentence order, then " lamp",
// which is not in the sentence. Its row sits near the row for " light".
// Each row is 8 illustrative values. " light" and " lamp" are close; " fog" and "house" are not.
export const TOKENS = [
  { text: "The", id: 1211, position: 0, row: [0.32, -0.58, 0.12, 0.66, -0.2, 0.44, -0.72, 0.08] },
  { text: " old", id: 8762, position: 1, row: [-0.54, 0.22, -0.68, 0.1, 0.58, -0.3, 0.18, -0.46] },
  { text: " light", id: 9054, position: 2, row: [0.72, 0.48, -0.26, -0.62, 0.3, 0.66, -0.12, -0.5] },
  { text: "house", id: 24801, position: 3, row: [-0.4, -0.66, 0.58, 0.24, -0.7, -0.18, 0.52, 0.36] },
  { text: " watched", id: 31208, position: 4, row: [0.1, 0.7, 0.42, -0.36, -0.54, 0.02, 0.64, -0.28] },
  { text: " the", id: 4021, position: 5, row: [-0.22, -0.34, 0.62, -0.5, 0.4, 0.06, -0.14, 0.66] },
  { text: " fog", id: 22104, position: 6, row: [0.6, -0.1, -0.72, -0.2, 0.62, -0.48, -0.56, 0.4] },
  { text: " lamp", id: 40213, position: null, row: [0.62, 0.56, -0.14, -0.66, 0.42, 0.54, -0.22, -0.4] },
];

// The cabinet files the rows in ID order: one drawer per row in this excerpt.
export const FILED = TOKENS.map((token, index) => index).sort((a, b) => TOKENS[a].id - TOKENS[b].id);
export const drawerOf = (index) => FILED.indexOf(index);

// A leading space shows as ␣, as in Figure 3.
export const shown = (text) => (text[0] === " " ? "␣" + text.slice(1) : text);

export const cosine = (a, b) => {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return dot / Math.sqrt(aa * bb);
};

// The row number is the token ID: the lookup is an index, not a search.
export const readoutText = (token, phase) => {
  const head = "id " + token.id + " · row " + token.id.toLocaleString("en-US");
  if (phase === "opening") return head + " · opening drawer";
  return head + " · 8 of 4,096 values shown";
};
