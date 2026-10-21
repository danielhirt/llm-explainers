// The monthly bill of a help-desk assistant, as one pure model. The figure draws its coin
// stacks from it and the page runs these same functions, so the tubes, the column, the meter
// and the verdict can't disagree. The volume and the rates are teaching examples; they match
// the site's example rates in src/figures/_shared/toy-tokenizer.mjs.

export const REQUESTS_PER_DAY = 100000;
export const DAYS = 30;
// Dollars per million tokens.
export const RATES = { input: 5, output: 25 };
export const TARGET = 55000;
// One coin in the drawing stands for this many dollars a month. Every part, every saving and
// the start total are whole coins: 6, 8 and 8 coins; the changes take out 4, 4 and 5.
export const COIN = 3750;

export const PARTS = [
  { key: "instructions", name: "Instructions", change: "Shorten repeated instructions", meter: "input", from: 1500, to: 500 },
  { key: "background", name: "Background", change: "Send less background", meter: "input", from: 2000, to: 1000 },
  { key: "answer", name: "Answers", change: "Ask for a shorter answer", meter: "output", from: 400, to: 150 },
];

// Monthly cost of one part of each request: tokens × requests a month ÷ 1 million × rate.
export const costOf = (part, tokens) => ((tokens * REQUESTS_PER_DAY * DAYS) / 1e6) * RATES[part.meter];
export const partCost = (part, on) => costOf(part, on ? part.to : part.from);
export const savingOf = (part) => partCost(part, false) - partCost(part, true);
export const billOf = (on) => PARTS.reduce((sum, part, index) => sum + partCost(part, on[index]), 0);
export const coinsOf = (dollars) => Math.round(dollars / COIN);
export const dollars = (value) => "$" + Math.round(value).toLocaleString("en-US");

// The line under the controls. It reads the target, the bill and the saving from the model.
export function verdictOf(on) {
  const count = on.filter(Boolean).length;
  const total = billOf(on);
  const saved = billOf([false, false, false]) - total;
  if (count === 0) return "Choose two changes to reach the target.";
  if (total >= TARGET) return dollars(total) + " a month. Choose one more change to get below " + dollars(TARGET) + ".";
  const best = PARTS.reduce((top, part) => (savingOf(part) > savingOf(top) ? part : top), PARTS[0]);
  const text = "Target reached at " + dollars(total) + " a month. You save " + dollars(saved) + ".";
  return on[PARTS.indexOf(best)]
    ? text + " The shorter answer saves the most because output uses the higher rate."
    : text + " A shorter answer saves more than either input change because output uses the higher rate.";
}
