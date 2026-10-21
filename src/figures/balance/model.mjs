// Which message costs more, as one pure model. The build and the page run the same functions, so
// the pans, the counters, the pointer and the verdict can't disagree. Token counts come from the
// site's teaching tokenizer (../_shared/toy-tokenizer.mjs), which the page trains and runs itself.
import { EXAMPLE_PRICE } from "../_shared/toy-tokenizer.mjs";

// The three message pairs and their lessons, from the earlier tokenizer page (Activity 2).
export const ROUNDS = [
  {
    a: "summarize this note in three bullets",
    b: '{"task":"summarize","format":"bullets","count":3}',
    lesson: "This tokenizer cuts braces, quotation marks, and digits into separate tokens. Structured text can use more tokens than a plain instruction.",
  },
  {
    a: "answer in one sentence",
    b: "please provide your answer using no more than a single sentence",
    lesson: "Both messages ask for the same result. You pay for the extra words in B on every request.",
  },
  {
    a: "the model reads the text",
    b: "das modell liest den text",
    lesson: "This teaching tokenizer learned from English text. It cuts German into smaller pieces, so the German message uses more tokens here.",
  },
];

// The example use: 1 million sends a month at the site's example input rate, in dollars per million tokens.
export const SENDS_PER_MONTH = 1000000;
export const RATE = EXAMPLE_PRICE.input;
export const monthlyCost = (tokens) => ((tokens * SENDS_PER_MONTH) / 1000000) * RATE;

// 0 when A has more tokens, 1 when B has more, -1 for a tie.
export const heavierOf = (a, b) => (a === b ? -1 : a > b ? 0 : 1);

// The balance. Every slug weighs the same, so the beam settles where tan(tilt) = (B - A) / SENSITIVITY,
// positive when pan B (right) goes down. The beam meets its stops at STOP tokens of difference.
export const SENSITIVITY = 160;
export const STOP = 32;
export const tiltOf = (diff) => Math.atan(Math.max(-STOP, Math.min(STOP, diff)) / SENSITIVITY);
