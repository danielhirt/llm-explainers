# Model Mechanics

A field guide to how language models work and how to work with them, for engineers and mixed audiences. Deployed as a static site on Vercel at https://llm-explainers.vercel.app; pushes to `main` deploy to production.

## Pages

| Page | Topic |
|------|-------|
| `index.html` | The landing page: a working model of the whole machine (hover a station, open its explainer) and the five-piece route. |
| `articles/tokenizer.html` | 1 · Tokens are the meter. A talk-ready page for mixed audiences: one trip through the machine, then three activities: see the cut, pick the costlier message, lower a monthly bill. |
| `articles/how-llms-work.html` | 2 · Inside a language model. The full lifecycle of a decoder-only model, from corpus and tokenizer through embeddings, transformer blocks and pre-training to sampling. Formulas sit in disclosures. |
| `articles/effort-levels.html` | 3 · Reasoning effort. Where more thinking tokens stop improving the answer, and how to pick a level. |
| `articles/orchestration-and-subagents.html` | 4 · Orchestration and subagents. One agent against four scoped workers: time, context and tokens, plus four patterns. |
| `articles/loops-and-skills.html` | 5 · Loops and skills. The agent tool loop, recurring loops, and skills that load only when a task matches. |
| `articles/tokenizer-v2.html` | A redirect to `tokenizer.html`, kept so old links work. |

## Build

The pages are generated and committed, so Vercel serves them as plain static files with no build step. Edit the sources, then rebuild:

```bash
node src/build.mjs            # every page
node src/build.mjs tokenizer  # one page
node src/build.mjs --strict   # fail if a page names a figure that does not exist
```

```
src/
  build.mjs          writes index.html and articles/*.html
  preview.mjs        writes a standalone preview of one figure
  pages/             page bodies (HTML) and site.mjs, the registry of pages and the route
  site/              the page shell, site.css, the figure runtime and the card helper
  figures/           one folder per figure; README.md there is the figure contract
  kit/               the Anatomy kit (MIT), vendored
```

A page places a figure with a marker such as `<!-- figure:sampler -->`. Each output page is self-contained: styles, figure markup and one module script are inlined; only the fonts in `fonts/` load separately.

## Design language

Every figure follows the [Anatomy](https://skills.wheresryan.sh/anatomy) design language: an invented physical machine whose working is the idea it explains, drawn as an isometric SVG of solid, shaded parts in a card with a figure number, a title, the action and a live readout. Numbers in a figure come from a small model module that the page also runs. The palette is monochrome in light and dark themes, with one lit accent per figure. A figure is drawn only where a picture teaches more than text; skills and RoPE, for example, are explained with a table and a formula instead.

Body text uses Geist and labels use Geist Mono, both self-hosted in `fonts/` (SIL OFL).

## Writing rules

Google developer documentation style with ASD-STE100 rules: short sentences, active voice, present tense, one idea per sentence, the same term for the same thing, no idioms, no em dashes. Teaching numbers are labelled as examples, and the one example rate ($5 per million input tokens, $25 per million output tokens) is the same on every page.
