// The site's one registry: names, the five-step route and every page the build writes.
export const SITE = {
  name: "Model Mechanics",
  tagline: "A field guide to how language models work and how to work with them",
  author: "Daniel Hirt",
};

export const ROUTE = [
  { n: 1, slug: "tokenizer", file: "articles/tokenizer.html", kind: "Start", title: "Tokens are the meter" },
  { n: 2, slug: "how-llms-work", file: "articles/how-llms-work.html", kind: "The machine", title: "Inside a language model" },
  { n: 3, slug: "effort-levels", file: "articles/effort-levels.html", kind: "Choice", title: "Reasoning effort" },
  { n: 4, slug: "orchestration-and-subagents", file: "articles/orchestration-and-subagents.html", kind: "Choice", title: "Orchestration and subagents" },
  { n: 5, slug: "loops-and-skills", file: "articles/loops-and-skills.html", kind: "Choice", title: "Loops and skills" },
];

const route = (slug) => ROUTE.find((entry) => entry.slug === slug);
const crumb = (slug) => `${route(slug).n} / 5 · ${route(slug).title}`;

export const PAGES = [
  {
    slug: "index",
    source: "index.html",
    out: "index.html",
    depth: 0,
    title: "Model Mechanics",
    description: "A field guide to language models: a working model of the whole machine, a hands-on token exercise, and interactive explainers on transformers, reasoning effort, orchestration, and agent loops.",
    crumb: "",
  },
  {
    slug: "tokenizer",
    source: "tokenizer.html",
    out: "articles/tokenizer.html",
    depth: 1,
    title: "Tokens are the meter · Model Mechanics",
    description: "See how a language model cuts text into tokens, compare the cost of two messages, and lower a sample monthly bill.",
    crumb: crumb("tokenizer"),
  },
  {
    slug: "how-llms-work",
    source: "how-llms-work.html",
    out: "articles/how-llms-work.html",
    depth: 1,
    title: "Inside a language model · Model Mechanics",
    description: "The full lifecycle of a decoder-only language model, from training corpus and tokenizer through embeddings, transformer blocks, and pre-training to one-token-at-a-time generation.",
    crumb: crumb("how-llms-work"),
  },
  {
    slug: "effort-levels",
    source: "effort-levels.html",
    out: "articles/effort-levels.html",
    depth: 1,
    title: "Reasoning effort · Model Mechanics",
    description: "How a thinking budget changes answer quality, cost and waiting time, and how to pick an effort level for a task.",
    crumb: crumb("effort-levels"),
  },
  {
    slug: "orchestration-and-subagents",
    source: "orchestration-and-subagents.html",
    out: "articles/orchestration-and-subagents.html",
    depth: 1,
    title: "Orchestration and subagents · Model Mechanics",
    description: "When to split work across subagents: context isolation, parallel time, total token cost, verification, and four orchestration patterns.",
    crumb: crumb("orchestration-and-subagents"),
  },
  {
    slug: "loops-and-skills",
    source: "loops-and-skills.html",
    out: "articles/loops-and-skills.html",
    depth: 1,
    title: "Loops and skills · Model Mechanics",
    description: "How an agent harness runs a model in a tool loop, why the context grows on every lap, and how skills load a procedure only when a task needs it.",
    crumb: crumb("loops-and-skills"),
  },
];

// Old addresses that still resolve to a current page.
export const REDIRECTS = [{ out: "articles/tokenizer-v2.html", to: "tokenizer.html", title: "Tokens are the meter" }];
