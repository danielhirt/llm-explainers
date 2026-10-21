// One agent or four workers, as one pure model. The build draws the end state from it and the
// page runs the same functions, so the stacks, the clocks, the counters and the readout agree.
// The numbers are illustrative. They come from the page's earlier figures: four jobs, the time
// each job takes (Figure 1) and how full each context gets (Figure 2).

// One context window holds this many tokens. A stack 100% tall is a full window.
export const WINDOW_TOKENS = 200000;
// Both sides start with the task and the plan.
export const PLAN = 8;
// A worker's window starts with its brief from the orchestrator.
export const BRIEF = 2;
// One short result. The verifier rejects one, so the orchestrator keeps three.
export const RESULT = 2;
// Minutes it takes to write a result at the end of a job.
export const WRITE = 0.4;

// minutes: how long the job takes. worker: how full that worker's window gets, brief included.
// solo: what the one agent adds for the same job. A worker starts with no history, so it reads
// more than the one agent, which has already read the shared setup.
export const JOBS = [
  { name: "Auth module", minutes: 4.1, worker: 58, solo: 22 },
  { name: "API surface", minutes: 2.4, worker: 44, solo: 17, rejected: true },
  { name: "DB layer", minutes: 5.1, worker: 60, solo: 22 },
  { name: "UI routes", minutes: 3.1, worker: 50, solo: 19 },
];

const sum = (list) => list.reduce((total, value) => total + value, 0);

// The one agent does the jobs one after another. The workers run at the same time.
export const SOLO_MINUTES = Math.round(sum(JOBS.map((job) => job.minutes)) * 10) / 10;
export const TEAM_MINUTES = Math.max(...JOBS.map((job) => job.minutes));

// Context at the end, in % of one window.
export const SOLO_END = PLAN + sum(JOBS.map((job) => job.solo + RESULT));
export const ORCH_END = PLAN + RESULT * JOBS.filter((job) => !job.rejected).length;

// Tokens add every context on a side. What a worker read never comes back, but it was paid for.
export const tokensOf = (percent) => (percent / 100) * WINDOW_TOKENS;
export const SOLO_TOKENS = tokensOf(SOLO_END);
export const TEAM_TOKENS = tokensOf(sum(JOBS.map((job) => job.worker)) + ORCH_END);

// When each of the one agent's jobs starts, in minutes.
export const SOLO_STARTS = JOBS.map((_, index) => sum(JOBS.slice(0, index).map((job) => job.minutes)));

const clamp01 = (value) => Math.max(0, Math.min(1, value));

// The one agent at minute m: for each job, how much paper it holds (reading, then the result),
// and its whole context in % of the window.
export function soloAt(m) {
  let level = PLAN;
  const jobs = JOBS.map((job, index) => {
    const start = SOLO_STARTS[index];
    const read = job.minutes - WRITE;
    const reading = clamp01((m - start) / read);
    const writing = clamp01((m - start - read) / WRITE);
    const height = job.solo * reading + RESULT * writing;
    level += height;
    return { height, reading, writing };
  });
  return { level, jobs, minutes: Math.min(Math.max(0, m), SOLO_MINUTES) };
}

// Worker i at minute m: its brief, then its reading. It reports at the end of its job.
export function workerAt(index, m) {
  const job = JOBS[index];
  const read = job.minutes - WRITE;
  const reading = clamp01(m / read);
  return { level: BRIEF + (job.worker - BRIEF) * reading, reading, reported: m >= job.minutes };
}

// The orchestrator's context once `landed` results are in its tray.
export const orchAt = (landed) => PLAN + RESULT * landed;
