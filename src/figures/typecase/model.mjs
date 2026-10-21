// The truth for the typecase figure. The talk variant cuts text with the site's teaching
// tokenizer; the ids variant uses the flagship's fixed examples. The build and the page run the
// same functions, so the slugs, the counter, the meter and the readout can't disagree.

// The four samples of the old splitter on the tokenizer page, with their notes.
export const PRESETS = [
  { label: "everyday sentence", text: "the model reads the text and predicts the next token", note: "Most common words fit into one piece in this teaching tokenizer." },
  { label: "long word", text: "the anthropologist studies antidisestablishmentarianism", note: "An unfamiliar word breaks into several pieces, so one word can add many tokens." },
  { label: "numbers", text: "the order number is 314159", note: "The toy tokenizer splits each digit. A production tokenizer may cut this differently." },
  { label: "code", text: "for (let i = 0; i < tokens.length; i++)", note: "Code has many marks and short pieces. A tokenizer trained on code usually handles it better." },
];

// The flagship's Fig 3 examples, copied exactly: the pieces and their illustrative IDs.
export const EXAMPLES = [
  {
    label: "Sentence",
    text: "The old lighthouse watched the fog",
    pieces: [
      { text: "The", id: 1211 },
      { text: " old", id: 8762 },
      { text: " light", id: 9054 },
      { text: "house", id: 24801 },
      { text: " watched", id: 31208 },
      { text: " the", id: 4021 },
      { text: " fog", id: 22104 },
    ],
  },
  {
    label: "Rare word",
    text: "uncharacteristically",
    pieces: [
      { text: " un", id: 563 },
      { text: "character", id: 15892 },
      { text: "ist", id: 27441 },
      { text: "ically", id: 48013 },
    ],
  },
  {
    label: "Code",
    text: "def fetch(url):",
    pieces: [
      { text: "def", id: 770 },
      { text: " fetch", id: 6291 },
      { text: "(", id: 58 },
      { text: "url", id: 8302 },
      { text: ")", id: 59 },
      { text: ":", id: 26 },
    ],
  },
  {
    label: "Emoji",
    text: "go 🚀",
    pieces: [
      { text: "go", id: 1990 },
      { text: " ", id: 32 },
      { text: "F0", id: 50210, byte: true },
      { text: "9F", id: 50211, byte: true },
      { text: "9A", id: 50212, byte: true },
      { text: "80", id: 50213, byte: true },
    ],
  },
];

// The stick holds at most this many slugs. Pieces past it show as a count on the follower.
export const STICK_MAX = 24;
// Uses for the cost table.
export const USES = [
  { n: 1, label: "1 use" },
  { n: 1000, label: "1,000 uses" },
  { n: 1000000, label: "1 million uses" },
];
// The type case: 32 compartments across, 8 rows deep, numbered row by row.
export const CASE_COLS = 32;
export const CASE_ROWS = 8;
// The ids variant files its 23 tokens in ID order across a case that stands for a 50,257-entry
// vocabulary, so a larger ID sits further along the case.
export const VOCAB_IDS = 50257;

// A leading space shows as ␣.
export const shown = (piece) => (piece[0] === " " ? "␣" + piece.slice(1) : piece);

// Cost in dollars: tokens × uses × rate per million tokens.
export const costOf = (tokens, uses, rate) => (tokens * uses * rate) / 1e6;

// Pieces past one per word.
export const extraOf = (tokens, words) => Math.max(0, tokens - words);

// A slug is as wide as its widest line of type plus a margin each side.
export function slugWidth(chars, idDigits, S) {
  return Math.max(chars * S.pitch, idDigits ? idDigits * S.idPitch + 0.8 : 0) + 2 * S.margin;
}

// Sets slugs from the head of the stick until the stick is full or holds max slugs.
// Returns the x of each slug that fits.
export function lineOf(widths, start, length, max) {
  const xs = [];
  let x = start;
  for (const w of widths) {
    if (xs.length >= max || x + w > start + length + 1e-6) break;
    xs.push(x);
    x += w;
  }
  return { xs, end: x };
}

// Compartment of a token: the talk case holds the whole toy vocabulary, one ID per compartment.
export const cellOfId = (id, cols) => ({ row: Math.floor(id / cols), col: id % cols });

// Places the ids variant's tokens in ID order: each one goes near its share of the vocabulary,
// and a token whose place is taken moves to the next free compartment.
export function placeIds(ids, cells, vocab) {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const place = sorted.map((id) => Math.round(((cells - 1) * id) / (vocab - 1)));
  for (let i = 1; i < place.length; i++) place[i] = Math.max(place[i], place[i - 1] + 1);
  for (let i = place.length - 1; i >= 0; i--) place[i] = Math.min(place[i], cells - (place.length - i));
  for (let i = 1; i < place.length; i++) place[i] = Math.max(place[i], place[i - 1] + 1);
  return Object.fromEntries(sorted.map((id, i) => [id, place[i]]));
}
