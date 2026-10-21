# Figures

Every figure on the site is an invented physical machine whose working is the idea it explains, drawn with the [Anatomy](https://skills.wheresryan.sh/anatomy) kit (vendored in `src/kit`, MIT). This file is the contract every figure follows.

## Layout

```
src/figures/<name>/
  model.mjs     the truth: a small pure module with the numbers and rules the figure shows
  figure.mjs    build({ fig, id, variant, page }) → { html, css, script, needs }
  out/          previews and screenshots (not committed)
src/figures/_shared/
  toy-tokenizer.mjs   the site's teaching BPE tokenizer and example rate
```

## The module contract

`figure.mjs` exports `build({ fig, id, variant, page })`:

- `fig` is the corner label (`"Fig 3"`), `id` the figure's unique id on its page, `variant` an optional mode named in the page marker, and `page` the page slug (`"index"`, `"tokenizer"`, `"how-llms-work"`, …) for links.
- It returns:
  - `html`: the card, from `plate()` in `src/site/plate.mjs`. Put the SVG in `stageHtml()` (the focusable `.iso-stage`) and HTML controls in `controls`: `.btn` buttons (with `aria-pressed` for toggles), `.range` sliders, `.field` text inputs, `.fig-controls` and `.fig-row` rows, `.fig-meter` readouts. `src/site/site.css` styles them.
  - `css`: figure CSS, every selector under `[data-fig="${id}"]`, colours from `--anatomy-*` tokens only, so light and dark both work.
  - `script`: the body of `function (root) { … }`, where `root` is the `<figure>`. Query inside `root` only. In scope: the kit's core as globals and as `k` (`iso`, `translateAlong`, `lineOnTop`, `solidSvg`, …), `G` (lathe) and `TB` (tube) when `needs` lists `"lathe"` or `"tube"`, and the site runtime: `STILL` (reduced motion), `figureLoop(stage, tick)`, `readoutOf(root)`, `follow(value, target, dt, seconds, calm)` and `springTo(state, target, dt, stiffness, damping, calm)` (`src/site/runtime.js`).
  - `needs`: `[]`, `["lathe"]` or `["lathe", "tube"]`.
- Write any function the page also runs with `k.` and `G.` prefixes, and inject it with `${fn.toString()}`, so Node and the page run the same code.
- Prefix every SVG id (`clipPath`, gradients) with `${id}-`.

A page places a figure with a marker: `<!-- figure:effort-cam -->` or `<!-- figure:machine variant=tour -->`. The build numbers figures in page order.

## Commands

```bash
node src/preview.mjs effort-cam                  # src/figures/effort-cam/out/effort-cam-light.html
node src/preview.mjs effort-cam --dark           # the dark theme
node src/preview.mjs machine --variant tour      # a variant
node src/build.mjs                               # every page
```

Checks, with the Anatomy skill's scripts (`~/.claude/skills/anatomy/scripts`):

```bash
node capture.mjs <preview.html> --out shot.png --width 1100      # desktop; --width 390 for a phone
node capture.mjs <preview.html> --out zoom.png --zoom x,y,w,h    # 4× close-up, card px
node lines.mjs <preview.html> --out lines.png                    # must print "line ends: 0"
node drive.mjs <preview.html> '[["click","[data-task=\"2\"]"],["wait",1500],["lines","lines-2.png"]]'
```

## Rules

- **The object is the explanation.** A real, well-made machine of 40–80 solids (a Hero 80–150), every part resting on another part, with screws, seams, bevels, rulers, label plates and the brackets that hold things. No boxes, arrows or floating labels.
- **Truth.** Every number the figure shows comes from `model.mjs`, which the page runs too. The caption says which numbers are illustrative.
- **Tone.** Base `lo`, structure `mid`, subject `hi`, exactly one `lit` accent. Monochrome; colour only if colour is the subject.
- **Lines resolve.** Every line ends on a face, a line or a dot; `lines.mjs` prints `line ends: 0` in both themes and in every resting pose.
- **Card.** `Fig n` and a short title at the top, the action (hint) and a live readout at the bottom, two to four legend keys and a caption under the card.
- **Motion.** Calm, eased and time-based, with an idle tour after about 1.4 s that pauses on any input and resumes after about 6 s. It stops offscreen and goes still under reduced motion.
- **Access.** The stage has a role, an `aria-label` that names the keys and an `aria-valuetext` written when the reader's choice changes. The SVG label describes the object.
- **Size.** The SVG stays under 220 KB (a Hero under 400 KB). The viewBox is 600–680 wide; the card is about 920 px wide on desktop and must read at 390 px.
- **Words.** Google developer documentation style with ASD-STE100 rules: short sentences, active voice, present tense, one idea per sentence, the same term for the same thing, no idioms, no em dashes, no filler.
