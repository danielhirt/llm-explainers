// The site's teaching tokenizer: byte-pair encoding trained on a small English corpus, as on the
// earlier tokenizer page. Pure and deterministic, so the build and the page cut text the same way.
// Inline it in a page with tokenizerSource(), which returns this module's code without exports.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CORPUS =
  "a language model is a machine that reads tokens and predicts the next token. the model reads the text one token at a time. a token is a small piece of text. some tokens are whole words and some tokens are pieces of a word. the tokenizer cuts the text into tokens. the tokenizer learns its vocabulary from the training text. the vocabulary maps every token to a number. the model never sees words. the model sees numbers. the numbers stand for tokens. common words become single tokens. rare words break into small pieces. the training text decides which words are common. the model learns patterns from the training text. the model counts which token follows which tokens. the counts become probabilities. the probabilities say which token comes next. the model picks the next token from the probabilities. the model appends the token to the context. the context grows one token at a time. the loop repeats until the text is done. the model guesses the next token and the training corrects the guess. training changes the weights. the weights store the patterns. a small model stores few patterns. a large model stores many patterns. the tokenizer stays frozen after training. the model stays frozen after training too. the machine that picks the token is called the sampler. the sampler rolls the dice over the probabilities. a low temperature makes the dice boring. a high temperature makes the dice wild. greedy decoding always picks the top token. greedy decoding repeats itself. the context window holds a fixed number of tokens. a long text costs many tokens. a short text costs few tokens. the price of a text is measured in tokens. the model predicts and the loop appends. the text grows and the machine reads it again. every guess is a probability over the whole vocabulary. the vocabulary holds the alphabet and the learned merges. a merge glues two pieces into one token. the most frequent pair wins the merge. the merges repeat until the vocabulary is full. the tokenizer replays the merges on new text. the new text becomes numbers and the loop begins. people read words but machines read tokens. the model reads the numbers and the story continues.";

export const NUM_MERGES = 220;

// The site's one example rate, in dollars per million tokens.
export const EXAMPLE_PRICE = { input: 5, output: 25 };

export const norm = (text) => text.toLowerCase().replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
// Pre-tokenization: words keep their leading space, digits and marks group separately.
export const pieces = (text) => (" " + norm(text)).match(/ ?[a-z]+| ?[0-9]+| ?[^a-z0-9 ]+/g) || [];

export function trainTokenizer(corpus = CORPUS, numMerges = NUM_MERGES) {
  const words = new Map();
  for (const word of pieces(corpus)) {
    if (!words.has(word)) words.set(word, { syms: word.split(""), freq: 0 });
    words.get(word).freq += 1;
  }
  const list = [...words.values()];
  const base = [...new Set(list.flatMap((word) => word.syms))].sort();
  const ids = new Map(base.map((symbol, index) => [symbol, index]));
  const ranks = new Map();
  const merges = [];
  for (let m = 0; m < numMerges; m++) {
    const counts = new Map();
    for (const word of list) {
      for (let i = 0; i < word.syms.length - 1; i++) {
        const key = word.syms[i] + "\u0000" + word.syms[i + 1];
        counts.set(key, (counts.get(key) || 0) + word.freq);
      }
    }
    if (!counts.size) break;
    const entries = [...counts].map(([key, count]) => {
      const [a, b] = key.split("\u0000");
      return { a, b, count };
    });
    entries.sort((x, y) => y.count - x.count || (x.a + x.b < y.a + y.b ? -1 : 1));
    const best = entries[0];
    const token = best.a + best.b;
    ranks.set(best.a + "\u0000" + best.b, m);
    merges.push([best.a, best.b]);
    if (!ids.has(token)) ids.set(token, base.length + m);
    for (const word of list) {
      for (let i = 0; i < word.syms.length - 1; i++) {
        if (word.syms[i] === best.a && word.syms[i + 1] === best.b) word.syms.splice(i, 2, token);
      }
    }
  }
  const encodeWord = (word) => {
    const syms = word.split("");
    for (;;) {
      let best = -1;
      let bestRank = Infinity;
      for (let i = 0; i < syms.length - 1; i++) {
        const rank = ranks.get(syms[i] + "\u0000" + syms[i + 1]);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          best = i;
        }
      }
      if (best < 0) break;
      syms.splice(best, 2, syms[best] + syms[best + 1]);
    }
    return syms;
  };
  // Returns the pieces in order. A piece the vocabulary lacks (a character the corpus never had)
  // still counts as one token, as byte fallback would make it.
  const encode = (text) => pieces(text).flatMap(encodeWord);
  const known = (token) => ids.has(token);
  const idOf = (token) => (ids.has(token) ? ids.get(token) : null);
  const wordCount = (text) => (norm(text) ? norm(text).split(" ").length : 0);
  return { encode, known, idOf, wordCount, vocabularySize: ids.size, merges };
}

// Money for a cost display: whole dollars above $1,000, cents below.
export function money(x) {
  if (x >= 1000) return "$" + Math.round(x).toLocaleString("en-US");
  if (x >= 100) return "$" + x.toFixed(0);
  if (x >= 0.01) return "$" + x.toFixed(2);
  if (x <= 0) return "$0";
  return "<$0.01";
}

// This module's code for a page script: imports and exports stripped, so a figure can write
// `${tokenizerSource()}` into its script and call trainTokenizer() in the browser.
export function tokenizerSource() {
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const end = source.indexOf("// This module's code for a page script");
  return source
    .slice(0, end)
    .replace(/^import .*$/gm, "")
    .replace(/^export /gm, "");
}
