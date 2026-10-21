// The machine's truth: a decoder-only language model's two lives as one pure model.
// The build path runs once: corpus, tokenizer, pre-training, checkpoint. The run path runs once
// per output token: tokenize, embed, the frozen block stack with its key-value cache, logits,
// one sampled token, append. The build, the page and the readouts all use these numbers.
import { trainTokenizer } from "../_shared/toy-tokenizer.mjs";

const TOKENIZER = trainTokenizer();

// The site's teaching tokenizer has this many vocabulary entries.
export const VOCAB_SIZE = TOKENIZER.vocabularySize;

// One request: a prompt, and the continuation the model writes (a sentence from the corpus the
// teaching tokenizer learned from). Every ID below comes from that tokenizer.
export const PROMPT = "the model reads the text";
export const ANSWER = " one token at a time.";
const pieceOf = (piece) => ({ piece, id: TOKENIZER.idOf(piece) });
export const PROMPT_TOKENS = TOKENIZER.encode(PROMPT).map(pieceOf);
export const OUTPUT_TOKENS = TOKENIZER.encode(PROMPT + ANSWER).slice(PROMPT_TOKENS.length).map(pieceOf);
export const PASSES = OUTPUT_TOKENS.length;

// Drawn sizes. These are illustrative: real models have dozens of blocks and vocabularies of
// 100,000 or more entries.
export const BLOCKS = 6; // transformer blocks in the stack
export const DRAWERS = 12; // the embedding table, drawn as 12 drawers of rows
export const COLUMNS = 8; // logits gauge columns: the eight highest-scoring vocabulary entries
export const POCKETS = 5; // sampler pockets: the five most likely tokens

// The drawer that holds an ID's row.
export const drawerOf = (id) => Math.min(DRAWERS - 1, Math.floor((id * DRAWERS) / VOCAB_SIZE));

// Billing. The input meter counts the prompt once per request. The output meter counts each
// generated token once. Each pass reads the whole context through the cache, but the prompt is
// not billed again.
export const inputBilled = () => PROMPT_TOKENS.length;
export const outputBilled = (passesDone) => passesDone;
// Context length that pass p (1-based) reads, and cache entries per layer after pass p.
export const contextOf = (pass) => PROMPT_TOKENS.length + pass - 1;
export const cacheAfter = (pass) => (pass < 1 ? 0 : PROMPT_TOKENS.length + pass - 1);

// Illustrative logits for each pass: one score per gauge column. The token that the pass writes
// scores highest, and the rest follow a fixed pattern, so the figure is the same on every visit.
const DISTRACTORS = [" the", " model", " text", " tokens", " and", " reads", " is", " next", " small"];
export function logitsOf(pass) {
  const chosen = OUTPUT_TOKENS[pass - 1];
  const others = DISTRACTORS.filter((piece) => piece !== chosen.piece).slice(0, COLUMNS - 1);
  const shuffle = (index) => (index * 3 + pass * 2) % (COLUMNS - 1);
  const scores = others.map((piece, index) => ({ piece, score: 3.6 - 0.5 * shuffle(index) - 0.05 * pass }));
  const top = { piece: chosen.piece, score: 5.2 - 0.1 * (pass % 3) };
  // The chosen column sits at a different place on each pass.
  const at = (pass * 3) % COLUMNS;
  scores.splice(at, 0, top);
  return scores.map((entry) => ({ ...entry, id: TOKENIZER.idOf(entry.piece), chosen: entry === top }));
}
export const softmax = (scores) => {
  const top = Math.max(...scores);
  const weights = scores.map((score) => Math.exp(score - top));
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight) => weight / sum);
};
// The sampler's pockets: the most likely tokens, each as wide as its share of probability.
export function pocketsOf(pass) {
  const logits = logitsOf(pass);
  const probs = softmax(logits.map((entry) => entry.score));
  const ranked = logits.map((entry, index) => ({ ...entry, p: probs[index] })).sort((a, b) => b.p - a.p).slice(0, POCKETS);
  const total = ranked.reduce((sum, entry) => sum + entry.p, 0);
  return ranked.map((entry) => ({ ...entry, share: entry.p / total }));
}

// The map: eight stations, in the order the arrow keys visit them.
export const STATIONS = [
  { key: "corpus", name: "Corpus", job: "The corpus is the selected text that the model learns from.", href: "articles/how-llms-work.html#corpus" },
  { key: "tokenizer", name: "Tokenizer", job: "The tokenizer cuts text into tokens and gives each token an ID from a fixed vocabulary.", href: "articles/tokenizer.html" },
  { key: "training", name: "Training rig", job: "Pre-training adjusts the weights until the model predicts the next token well.", href: "articles/how-llms-work.html#training" },
  { key: "checkpoint", name: "Checkpoint", job: "The checkpoint stores the trained weights, and a request never changes it.", href: "articles/how-llms-work.html#training" },
  { key: "embedding", name: "Embedding cabinet", job: "Each token ID selects one row of learned numbers from the embedding table.", href: "articles/how-llms-work.html#geometry" },
  { key: "stack", name: "Transformer stack", job: "The transformer blocks compute with the frozen weights and cache keys and values for each layer.", href: "articles/how-llms-work.html#transformer" },
  { key: "logits", name: "Logits", job: "The output layer gives a score to every entry in the vocabulary.", href: "articles/how-llms-work.html#generation" },
  { key: "sampler", name: "Sampler", job: "The sampler picks one token from the scores, and the token joins the context.", href: "articles/how-llms-work.html#generation" },
];

// The tour: twelve steps over the two lives. `lit` names the stations each step lights.
export const STEPS = [
  { title: "Corpus selected", text: "Filters keep the useful documents and drop the rest. The model learns only from this text.", lit: ["corpus"] },
  { title: "Tokenizer trained", text: "A sample of the corpus sets a fixed vocabulary. Each entry gets a token ID.", lit: ["tokenizer"] },
  { title: "Corpus encoded", text: "The tokenizer turns the corpus into token IDs. Training reads these IDs, not the text.", lit: ["tokenizer", "training"] },
  { title: "Forward pass", text: "The model predicts the next token at every position of a batch. Each position sees only the tokens before it.", lit: ["training"] },
  { title: "Loss and backward pass", text: "The loss measures how far the predictions miss the real next tokens. The backward pass changes each weight a small amount to lower the loss.", lit: ["training"] },
  { title: "Checkpoint saved", text: "Training saves the weights as a checkpoint.", lit: ["checkpoint"] },
  { title: "Artifacts frozen", text: "Locks close on the tokenizer and the checkpoint. The run path gets copies, and a request never changes them.", lit: ["tokenizer", "checkpoint"] },
  { title: "Prompt tokenized", text: `The frozen tokenizer cuts the prompt into ${PROMPT_TOKENS.length} token IDs. The input counter adds ${PROMPT_TOKENS.length}, once for the whole request.`, lit: ["tokenizer"] },
  { title: "Embedding lookup", text: "Each token ID opens one drawer and selects its row of the embedding table.", lit: ["embedding"] },
  { title: "Frozen forward pass with KV cache", text: "Each block computes with the frozen checkpoint. Each layer keeps the keys and values of every position in its cache.", lit: ["stack"] },
  { title: "Logits and selection", text: "The output layer gives a score to every vocabulary entry. The sampler picks one token. A higher score makes a token more likely.", lit: ["logits", "sampler"] },
  { title: "Append and repeat", text: "The new token joins the context, and the output counter adds 1. The run path repeats once for each new token.", lit: ["sampler"] },
];
export const BUILD_STEPS = 7;

// Timelines, in seconds. The run's first pass reads the whole prompt; each later pass reads one
// new token and takes the rest from the cache.
export const TIMING = {
  cut: 0.5, // one prompt token cut and set
  read: 0.32, // one drawer lookup in the first pass
  readNew: 0.5, // the lookup of one new token
  layer: 0.17, // one block of the stack
  logits: 0.5,
  spin: 1.05,
  cast: 0.35,
  speed: 260, // conveyor speed in world units a second
  append: 0.35,
  rest: 0.25,
};
// Build steps: how long each one runs in the tour.
export const BUILD_TIMES = [2.4, 2.8, 2.2, 2.2, 2.6, 2.0, 2.0];
