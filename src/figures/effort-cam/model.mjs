// Reasoning effort as one pure model. The build draws the templates from it and the page
// runs the same functions, so the follower, the gauge and the readout can't disagree.
// The curves are teaching examples: q(t) = qmax − (qmax − q0)·e^(−t/τ).

export const TASKS = [
  { key: "rename", label: "Mechanical rename", q0: 84, qmax: 90, tau: 2500 },
  { key: "feature", label: "Mid-size feature", q0: 52, qmax: 88, tau: 6500 },
  { key: "debug", label: "Concurrency bug", q0: 22, qmax: 93, tau: 14000 },
];

export const LEVELS = [
  { key: "low", tokens: 2000 },
  { key: "medium", tokens: 8000 },
  { key: "high", tokens: 16000 },
  { key: "max", tokens: 30000 },
];

export const MAX_TOKENS = 32000;
export const TOKENS_PER_SECOND = 90;
// The site's example rate for output tokens, in dollars per million. Thinking tokens bill as output.
export const OUTPUT_RATE = 25;

export const quality = (task, tokens) => task.qmax - (task.qmax - task.q0) * Math.exp(-tokens / task.tau);
export const gainPerK = (task, tokens) => quality(task, tokens + 1000) - quality(task, tokens);
export const waitOf = (tokens) => tokens / TOKENS_PER_SECOND;
export const costOf = (tokens) => (tokens / 1e6) * OUTPUT_RATE;
