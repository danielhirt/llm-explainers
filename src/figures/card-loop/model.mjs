// The agentic loop as one pure model. The build draws the cards from it and the page runs the
// same functions, so the machine, the readout and the status line can't disagree.
// The context starts as the system prompt, the tool definitions and the user's request. On each
// lap the model reads the whole context and writes one card: a tool call or an answer. For a call,
// the harness runs the tool and adds the call and its result to the context. An answer ends the loop.
// The token counts are illustrative.

export const START = [
  { kind: "system", tokens: 640 },
  { kind: "tools", tokens: 1150 },
  { kind: "request", tokens: 50, text: "Find out why test_queue is flaky." },
];

// The three tool laps from the site's first loop figure.
export const LAPS = [
  { call: 'grep -rn "flaky" tests/', callTokens: 60, result: "3 matches in test_queue.py", resultTokens: 140 },
  { call: "read test_queue.py", callTokens: 50, result: "210 lines, uses shared worker pool", resultTokens: 2400 },
  { call: "pytest -k queue -x", callTokens: 50, result: "1 failed: race in enqueue()", resultTokens: 760 },
];

export const ANSWER = { text: "take the pool lock inside enqueue()", tokens: 90 };

// Every card the machine handles, in the order it joins the deck. The answer comes last and never joins it.
export function cardsOf() {
  const cards = START.map((card) => ({ ...card }));
  LAPS.forEach((lap, index) => {
    cards.push({ kind: "call", lap: index + 1, tokens: lap.callTokens, text: lap.call });
    cards.push({ kind: "result", lap: index + 1, tokens: lap.resultTokens, text: lap.result });
  });
  cards.push({ kind: "answer", lap: LAPS.length + 1, tokens: ANSWER.tokens, text: ANSWER.text });
  return cards;
}

// The loop as steps. `deck` is the number of cards in the context when the step starts and `card`
// the card the step moves. A tool lap has seven steps; the answer lap has three.
export function stepsOf() {
  const steps = [{ kind: "start", lap: 1, deck: START.length, card: -1 }];
  let deck = START.length;
  LAPS.forEach((lap, index) => {
    const n = index + 1;
    const call = deck;
    const result = deck + 1;
    steps.push({ kind: "read", lap: n, deck, card: -1 });
    steps.push({ kind: "write", lap: n, deck, card: call });
    steps.push({ kind: "route", lap: n, deck, card: call });
    steps.push({ kind: "run", lap: n, deck, card: call });
    steps.push({ kind: "addCall", lap: n, deck, card: call });
    steps.push({ kind: "result", lap: n, deck: deck + 1, card: result });
    steps.push({ kind: "addResult", lap: n, deck: deck + 1, card: result });
    deck += 2;
  });
  const last = LAPS.length + 1;
  steps.push({ kind: "read", lap: last, deck, card: -1 });
  steps.push({ kind: "write", lap: last, deck, card: deck, answer: true });
  steps.push({ kind: "answer", lap: last, deck, card: deck, answer: true });
  return steps;
}

// Tokens in the first `count` cards of the deck.
export function tokensOf(count) {
  return cardsOf()
    .slice(0, count)
    .reduce((sum, card) => sum + card.tokens, 0);
}

export const plain = (n) => Math.round(n).toLocaleString("en-US");

// The short readout for a step. `deck` is the number of cards that rest in the context now.
export function sayOf(step, deck) {
  const tokens = `context ${plain(tokensOf(deck))} tokens`;
  const lap = `lap ${step.lap}`;
  const what = {
    start: "ready",
    read: `reads ${deck} cards`,
    write: step.answer ? "answer" : "tool call",
    route: "call to harness",
    run: "harness runs tool",
    addCall: "call joins context",
    result: "harness writes result",
    addResult: "result joins context",
    answer: "loop ends",
  }[step.kind];
  return `${lap} · ${what} · ${tokens}`;
}

// One plain sentence for the step, for the status line and screen readers.
export function statusOf(step) {
  const cards = cardsOf();
  const card = cards[step.card];
  const lap = LAPS[step.lap - 1];
  switch (step.kind) {
    case "start":
      return `The context holds ${START.length} cards: the system prompt, the tool definitions and the request.`;
    case "read":
      return `Lap ${step.lap}. The model reads all ${step.deck} cards in the context.`;
    case "write":
      return step.answer ? `The model writes an answer, not a tool call: ${card.text}.` : `The model writes a tool call: ${card.text}`;
    case "route":
      return "The gate sends the call to the harness.";
    case "run":
      return `The harness runs the tool: ${lap.call}`;
    case "addCall":
      return "The harness adds the call to the context.";
    case "result":
      return `The harness writes the result: ${lap.result}`;
    case "addResult":
      return `The harness adds the result. The context grows to ${plain(tokensOf(step.deck + 1))} tokens.`;
    case "answer":
      return "The gate sends the answer to the tray. The loop ends.";
    default:
      return "";
  }
}

// How many columns of a card the punch fills: a longer message fills more of the card.
export const columnsOf = (tokens) => Math.max(1, Math.min(12, Math.round(2.2 * Math.log(tokens / 20))));
