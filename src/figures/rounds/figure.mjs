// Decision rounds: three short choices with a reveal, for the agent pages. A card in the
// figures' style, but an exercise rather than a drawing, so it takes no figure number.
import { escape } from "../../site/shell.mjs";

export const numbered = false;

const SETS = {
  orchestration: {
    title: "One agent or several workers",
    choices: [
      { key: "one", label: "Keep one agent" },
      { key: "split", label: "Split across workers" },
    ],
    next: "Next job",
    rounds: [
      {
        task: "Rename one button in one file. The test suite checks the result.",
        answer: "one",
        verdict: "Keep one agent.",
        reason: "The job is small and sequential, and a test checks it. Splitting it only adds coordination.",
      },
      {
        task: "Review four independent services for the same security mistake, then verify the findings.",
        answer: "split",
        verdict: "Split across workers.",
        reason: "Each service is an independent part. Workers can review them at the same time, and a fresh verifier can check each claim.",
      },
      {
        task: "Trace one production failure where each new log result changes the next question.",
        answer: "one",
        verdict: "Keep one agent.",
        reason: "The investigation is one chain of dependent steps. One context carries each result into the next question.",
      },
    ],
  },
  loops: {
    title: "This request or a reusable skill",
    choices: [
      { key: "request", label: "Keep it in this request" },
      { key: "skill", label: "Make a reusable skill" },
    ],
    next: "Next instruction",
    rounds: [
      {
        task: "Change the heading on this one page and check the result.",
        answer: "request",
        verdict: "Keep it in this request.",
        reason: "This is one specific job. The model does not need the procedure again.",
      },
      {
        task: "Before every production deploy, run the same gates, canary check, and rollback check.",
        answer: "skill",
        verdict: "Make a reusable skill.",
        reason: "The team repeats this procedure, and the full checklist matters only in deploy tasks.",
      },
      {
        task: "Every Tuesday, audit dependencies with the same rules and save a report for the next run.",
        answer: "skill",
        verdict: "Make a reusable skill.",
        reason: "The harness owns the schedule. The repeated audit steps belong in a skill.",
      },
    ],
  },
};

export function build({ id = "rounds", variant = "orchestration" } = {}) {
  const set = SETS[variant];
  const first = set.rounds[0];
  const html = `<section class="rounds" data-fig="${id}" aria-label="${escape(set.title)}: three decisions">
<div class="rounds-head"><span data-round>Decision 1 of ${set.rounds.length}</span><span>${escape(set.title)}</span></div>
<p class="rounds-q" data-task>${escape(first.task)}</p>
<div class="rounds-choices" role="group" aria-label="Choose one">${set.choices.map((choice) => `<button class="btn" type="button" data-choice="${choice.key}" aria-pressed="false">${escape(choice.label)}</button>`).join("")}</div>
<div class="rounds-reveal" data-reveal hidden></div>
<div class="rounds-foot"><span class="rounds-score" data-score aria-live="polite">0 of ${set.rounds.length} matched</span><button class="btn" type="button" data-next hidden>${escape(set.next)}</button></div>
</section>`;

  const script = `
const ROUNDS = ${JSON.stringify(set.rounds)};
const NEXT = ${JSON.stringify(set.next)};
const label = root.querySelector("[data-round]");
const task = root.querySelector("[data-task]");
const reveal = root.querySelector("[data-reveal]");
const score = root.querySelector("[data-score]");
const next = root.querySelector("[data-next]");
const choices = [...root.querySelectorAll("[data-choice]")];
let round = 0;
let matched = 0;
function show() {
  const item = ROUNDS[round];
  label.textContent = "Decision " + (round + 1) + " of " + ROUNDS.length;
  task.textContent = item.task;
  reveal.hidden = true;
  reveal.textContent = "";
  next.hidden = true;
  choices.forEach((button) => { button.disabled = false; button.setAttribute("aria-pressed", "false"); });
}
choices.forEach((button) => button.addEventListener("click", () => {
  const item = ROUNDS[round];
  const right = button.dataset.choice === item.answer;
  if (right) matched += 1;
  choices.forEach((choice) => { choice.disabled = true; choice.setAttribute("aria-pressed", String(choice === button)); });
  const lead = document.createElement("strong");
  lead.textContent = (right ? "Yes. " : "A better fit: ") + item.verdict;
  reveal.replaceChildren(lead, document.createTextNode(item.reason));
  reveal.hidden = false;
  score.textContent = matched + " of " + ROUNDS.length + " matched";
  next.textContent = round + 1 < ROUNDS.length ? NEXT : "Start again";
  next.hidden = false;
  next.focus();
}));
next.addEventListener("click", () => {
  round = (round + 1) % ROUNDS.length;
  if (round === 0) { matched = 0; score.textContent = "0 of " + ROUNDS.length + " matched"; }
  show();
  choices[0].focus();
});
`;
  return { html, css: "", script, needs: [] };
}
