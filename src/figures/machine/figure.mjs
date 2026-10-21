// Fig: the model, built and run. A bench with two decks: the raised back deck builds the model
// once (corpus, tokenizer, training rig, checkpoint); the front deck runs it once per output
// token (tokenizer, embedding cabinet, transformer stack, logits board, sampler and caster), and
// a return conveyor brings each new type slug back to the context row.
// Variants: "map" (landing hero: hover a station), "run" (one request, pass by pass) and
// "tour" (twelve steps over both lives).
import * as k from "../../kit/iso-kit.mjs";
import { plate, stageHtml } from "../../site/plate.mjs";
import * as M from "./model.mjs";
import * as D from "./draw.mjs";
import { runPlan, runPose, buildPose } from "./plan.mjs";

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Station links are written for the landing page; an article page drops the "articles/" folder.
const hrefOf = (href, page) => (page === "index" || page === "preview" ? href : href.replace(/^articles\//, ""));

const LABEL =
  "A workbench with two decks. On the raised back deck, the build line: a stack of corpus documents with a filter gate, a tokenizer that casts a type case, a training rig with a board of trim screws and a loss gauge, and a checkpoint cartridge in a cradle. On the front deck, the run line: a prompt tape feeds a tokenizer that cuts it into numbered type slugs, an embedding cabinet of drawers, a stack of six transformer units with a cache rack on each, a logits board of gauge columns, a sampler wheel and a caster. A conveyor carries each new slug back to the row of slugs that holds the context. A counter on the tokenizer counts input tokens and a counter on the caster counts output tokens.";

export function build({ fig = "Fig 1", id = "machine", variant = "map", page = "index" } = {}) {
  const kind = variant === "run" || variant === "tour" ? variant : "map";
  const plan = runPlan();
  const svg = k.figureSvg({ width: D.WIDTH, height: D.HEIGHT, label: LABEL, body: D.drawMachine({ id }) });
  const N = M.PROMPT_TOKENS.length;
  const stations = M.STATIONS.map((station) => ({ ...station, href: hrefOf(station.href, page) }));

  let stage;
  let controls;
  let hint;
  let readout;
  let keys;
  let caption;
  if (kind === "map") {
    stage = stageHtml({ svg, label: "The machine, mapped. Arrow keys move between the eight stations. Enter opens the explainer for the station.", role: "slider", attrs: `aria-valuemin="1" aria-valuemax="${stations.length}" aria-valuenow="1" aria-valuetext="No station chosen"` });
    controls = `<p class="mx-note" aria-live="polite"><span class="label" data-out="name">The machine</span><span data-out="job">The back deck builds the model once. The front deck runs it once for each token it writes.</span><a data-out="link" href="${esc(hrefOf("articles/how-llms-work.html", page))}">Open the explainer</a></p>`;
    hint = "Hover a station";
    readout = `pass 1 · in 0 · out 0`;
    keys = [
      { mark: "raised", label: "Back deck: build, once" },
      { mark: "flat", label: "Front deck: run, once per token" },
      { mark: "lit", label: "Type slugs: tokens, each with its ID" },
    ];
    caption = `Station sizes and counts are illustrative. The token IDs come from the site's teaching tokenizer, which has ${M.VOCAB_SIZE} vocabulary entries.`;
  } else if (kind === "run") {
    stage = stageHtml({ svg, label: "One request through the front deck. Space pauses or plays. Home replays from the start.", role: "group" });
    controls = `<div class="fig-controls"><button class="btn" type="button" data-act="play">Pause</button><button class="btn" type="button" data-act="replay">Replay</button><span class="spacer"></span><span class="label mx-phase" data-out="phase">Pass 1: all ${N} prompt tokens go through</span></div><span class="sr-only" aria-live="polite" data-out="live"></span>`;
    hint = "Watch one token at a time";
    readout = `pass 1 · in 0 · out 0`;
    keys = [
      { mark: "lit", label: "Type slugs: tokens, each with its ID" },
      { mark: "raised", label: "Counters: tokens in and tokens out" },
      { mark: "dim", label: "Back deck: the build line, which runs once" },
    ];
    caption = `The prompt "${M.PROMPT}" becomes ${N} tokens, and the model writes "${M.ANSWER.trim()}" in ${M.PASSES} passes. The input counter counts the prompt once. The output counter adds 1 for each new token. Pass 1 sends all ${N} prompt tokens through the stack. Each later pass sends only the newest token, and the cache holds the rest. The IDs come from the site's teaching tokenizer. The scores and station sizes are illustrative.`;
  } else {
    const first = M.STEPS[0];
    stage = stageHtml({ svg, label: "The model's lifecycle in twelve steps. Left and right arrow keys move between steps. Space plays or pauses.", role: "slider", attrs: `aria-valuemin="1" aria-valuemax="${M.STEPS.length}" aria-valuenow="1" aria-valuetext="Step 1 of ${M.STEPS.length}: ${esc(first.title)}"` });
    controls = `<div class="fig-controls"><button class="btn" type="button" data-act="prev">Previous</button><button class="btn" type="button" data-act="play">Pause</button><button class="btn" type="button" data-act="next">Next</button></div>
<div class="fig-row"><label class="label" for="${id}-step">Step</label><input class="range" id="${id}-step" type="range" min="1" max="${M.STEPS.length}" step="1" value="1"><output for="${id}-step" data-out="step">1 / ${M.STEPS.length}</output></div>
<p class="mx-note"><span class="label" data-out="title">${esc(first.title)}</span><span data-out="text">${esc(first.text)}</span></p>`;
    hint = "Step through the lifecycle";
    readout = `step 1 of ${M.STEPS.length} · ${first.title[0].toLowerCase()}${first.title.slice(1)}`;
    keys = [
      { mark: "raised", label: "Back deck: build, once" },
      { mark: "flat", label: "Front deck: run, once per token" },
      { mark: "lit", label: "Type slugs: tokens, each with its ID" },
    ];
    caption = `Steps 1 to 7 build the model once. Steps 8 to 12 show the first pass of one request. Station sizes and counts are illustrative, and the token IDs come from the site's teaching tokenizer.`;
  }

  const html = plate({ id, fig, title: "The model, built and run", hint, readout, keys, caption, stage, controls, wide: kind === "map", extraClass: `mx-${kind}` });

  const DATA = {
    variant: kind,
    P: D.P,
    plan,
    stations: stations.map(({ key, name, job, href }) => ({ key, name, job, href })),
    steps: M.STEPS.map(({ title, text, lit }) => ({ title, text, lit })),
    buildSteps: M.BUILD_STEPS,
    G: {
      SET_X: D.SET_X,
      PITCH: D.PITCH,
      SLUG: D.SLUG,
      LINE: D.LINE,
      CASTER_X: D.CASTER_X,
      DRAWER_OUT: D.DRAWER.out,
      DRAWER_ROWS: D.DRAWER.rows,
      DRAWER_COLS: D.DRAWER.cols,
      SLIDER: D.SLIDER,
      WHEEL: D.WHEEL,
      GAUGE: D.GAUGE,
      TAPE: D.TAPE,
      BELT: D.BELT,
      SCREW_CENTRES: D.SCREW_CENTRES,
      SCREWS: D.SCREWS,
      RIG_TOP: D.RIG_TOP,
      SELECTED: D.SELECTED,
      SHEET: D.SHEET,
      CORPUS: D.CORPUS,
      DECK: D.DECK,
      HASPS: D.HASPS,
      BLADE: D.BLADE,
      STRIP: D.STRIP,
      BRIDGE: D.BRIDGE,
      CART: D.CART,
      CUTTER: D.CUTTER,
      sorts: D.sortsOf(D.CASE, D.TRAINER_TOP + 3),
      racks: Array.from({ length: M.BLOCKS }, (_, i) => {
        const mid = D.unitZ(i) + D.UNIT_H / 2;
        return Array.from({ length: D.RACK.slots }, (_, s) => `M${(D.RACK.x0 + s * D.RACK.pitch).toFixed(1)} ${(-(mid + D.RACK.h / 2)).toFixed(1)}h${D.RACK.w}v${D.RACK.h}h${-D.RACK.w}Z`);
      }),
      ballR: 1.5,
      scale: D.P.scale * Math.sqrt(1.6),
    },
  };

  const page_ = Object.entries(D.PAGE)
    .map(([, fn]) => fn.toString())
    .join("\n");
  const script = `
const DATA = ${JSON.stringify(DATA)};
const P = DATA.P;
const { SET_X, PITCH, SLUG, LINE, CASTER_X, SLIDER, WHEEL, GAUGE, TAPE, BELT, SCREW_CENTRES, SCREWS, RIG_TOP, SELECTED, SHEET, CORPUS, DECK, HASPS, BLADE, STRIP, BRIDGE, CART, CUTTER } = DATA.G;
${page_}
const runPose = ${runPose.toString()};
const buildPose = ${buildPose.toString()};
${LIVE}
${VARIANTS}
`;
  const css = cssOf(id);
  return { html, css, script, needs: ["lathe"] };
}

// The page runtime, shared by the three variants.
const LIVE = String.raw`
const plan = DATA.plan;
const VARIANT = DATA.variant;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const within = (t, w) => clamp01((t - w[0]) / (w[1] - w[0]));
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (sel) => svg.querySelector(sel);
const qa = (sel) => [...svg.querySelectorAll(sel)];
const part = (name) => q('[data-part="' + name + '"]');
const out = (name) => root.querySelector('[data-out="' + name + '"]');
const say = readoutOf(root);
const pad = (n) => String(Math.max(0, Math.min(999, n))).padStart(3, "0");
const fixed = (n) => Math.round(n * 100) / 100;
const move = (node, by) => { const t = translateAlong(P, by); if (node.__t !== t) { node.__t = t; node.setAttribute("transform", t); } };
const setD = (node, d) => { if (node && node.__d !== d) { node.__d = d; node.setAttribute("d", d); } };
const setHtml = (node, html) => { if (node && node.__h !== html) { node.__h = html; node.innerHTML = html; } };
const setOpacity = (node, value) => { const v = String(fixed(value)); if (node && node.__o !== v) { node.__o = v; node.style.opacity = v === "1" ? "" : v; } };
const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };

// Parts.
const slugEls = qa("[data-slug]");
const places = { row: part("slugs"), exit: part("exit-slugs"), outlet: part("outlet-slugs") };
const drawerEls = qa("[data-drawer]");
const drawerSlots = qa("[data-drawer-slot]");
const drawerBox = part("drawers");
const sliderEls = qa("[data-slider]");
const lampEls = qa("[data-lamp]");
const cardEls = qa("[data-cache]");
const inDigits = qa("[data-cin]");
const outDigits = qa("[data-cout]");
const parts = {};
for (const name of ["tape", "belt", "cutter", "pockets", "ball", "selected", "sheet", "blade", "sorts", "strip", "bridge", "slots", "needle", "cart", "label", "hasp-case", "hasp-cart", "hasp-tok", "hasp-stk", "tok-copy", "stk-copy"]) parts[name] = part(name);
const stationEls = qa("[data-station]");
const backGroup = part("back");
const frontGroup = part("front");
const lineGroup = part("line");

function drawRun(pose) {
  // Slugs, each in the place it is in: the row on the line, or one of the two openings.
  pose.slugs.forEach((s, j) => {
    const el = slugEls[j];
    const show = s.show;
    if (el.__show !== show) { el.__show = show; el.style.display = show ? "" : "none"; }
    if (!show) return;
    const home = places[s.place];
    if (el.parentNode !== home) home.appendChild(el);
    move(el, [s.x, s.y, s.z]);
    setOpacity(el, 1 - pose.fade);
  });
  // Drawers: open drawers are drawn after the closed ones, lower rows first, then left to
  // right, so each open drawer covers what lies behind it.
  let openKey = "";
  pose.drawers.forEach((open, d) => {
    move(drawerEls[d], [0, open * DATA.G.DRAWER_OUT, 0]);
    if (open > 0.01) openKey += d + ",";
  });
  if (openKey !== drawerBox.__open) {
    drawerBox.__open = openKey;
    const rank = (d) => (DATA.G.DRAWER_ROWS - 1 - Math.floor(d / DATA.G.DRAWER_COLS)) * 10 + (d % DATA.G.DRAWER_COLS);
    const open = drawerSlots.filter((_, d) => pose.drawers[d] > 0.01).sort((a, b) => rank(+a.dataset.drawerSlot) - rank(+b.dataset.drawerSlot));
    const fragment = document.createDocumentFragment();
    drawerSlots.forEach((slot, d) => { if (!(pose.drawers[d] > 0.01)) fragment.appendChild(slot); });
    open.forEach((slot) => fragment.appendChild(slot));
    drawerBox.appendChild(fragment);
  }
  pose.sliders.forEach((h, c) => move(sliderEls[c], [0, 0, h * (SLIDER.z1 - SLIDER.z0)]));
  pose.lamps.forEach((v, i) => setOpacity(lampEls[i], v));
  pose.cards.forEach((n, i) => {
    setD(cardEls[i], DATA.G.racks[i].slice(0, n).join(""));
    setOpacity(cardEls[i], 1 - pose.fade);
  });
  setD(parts.tape, tapeMarks(pose.tape));
  setD(parts.belt, beltRibs(pose.belt));
  move(parts.cutter, [0, 0, -pose.knife * CUTTER.stroke]);
  setD(parts.pockets, pose.pockets ? pocketLines(pose.pockets, pose.pocketTurn) : "");
  const ball = parts.ball;
  if (pose.ball) {
    const c = iso([WHEEL.x + pose.ball.r * Math.cos(pose.ball.angle), WHEEL.y + pose.ball.r * Math.sin(pose.ball.angle), WHEEL.z + WHEEL.h + DATA.G.ballR + pose.ball.hop], P);
    const r = DATA.G.ballR * DATA.G.scale;
    setHtml(ball, '<circle class="mx-ball" cx="' + fixed(c[0]) + '" cy="' + fixed(c[1]) + '" r="' + fixed(r) + '"/><circle class="mx-shine" cx="' + fixed(c[0] - r * 0.35) + '" cy="' + fixed(c[1] - r * 0.4) + '" r="' + fixed(r * 0.3) + '"/>');
  } else setHtml(ball, "");
  const inText = pad(pose.inCount);
  const outText = pad(pose.outCount);
  inDigits.forEach((node, i) => setText(node, inText[i]));
  outDigits.forEach((node, i) => setText(node, outText[i]));
}

function drawBuild(pose) {
  setHtml(parts.selected, selectedAt(pose.selected));
  const sheet = parts.sheet;
  if (pose.sheet < 0) setOpacity(sheet, 0);
  else {
    // From the raw stack's top, down through the gate, onto the selected stack.
    const u = pose.sheet;
    const dx = SELECTED.x + SELECTED.w / 2 - (SHEET.x + SHEET.w / 2);
    const dy = SELECTED.y + SELECTED.d / 2 - (SHEET.y + SHEET.d / 2);
    const zMid = DECK + 17 - SHEET.z;
    const zEnd = DECK + 2 + pose.selected * (SELECTED.h - 2) - SHEET.z;
    const z = u < 0.5 ? zMid * ease(u * 2) : zMid + (zEnd - zMid) * ease(u * 2 - 1);
    move(sheet, [dx * u, dy * u, z]);
    setOpacity(sheet, 1 - pose.sheetFade);
  }
  move(parts.blade, [0, 0, -pose.blade * BLADE.drop]);
  const n = Math.round(pose.vocab * DATA.G.sorts.length);
  setHtml(parts.sorts, n ? '<g class="iso-dots" data-tone="hi">' + DATA.G.sorts.slice(0, n).map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="0.75"/>').join("") + "</g>" : "");
  move(parts.strip, [pose.strip * STRIP.travel, 0, 0]);
  const bx = pose.bridge * (BRIDGE.x1 - BRIDGE.x0);
  move(parts.bridge, [bx, 0, 0]);
  const turns = SCREW_CENTRES.map(([x], index) => {
    const share = pose.step > 5 ? 1 : pose.step < 5 || pose.sweep <= 0 ? 0 : ease((x - (BRIDGE.x0 + bx)) / 8 + 0.5);
    return share * (((index * 37) % 11) / 10 - 0.5) * 1.6;
  });
  setD(parts.slots.firstElementChild, slotsAt(turns));
  setD(parts.needle, needleAt(Math.max(0, pose.loss)));
  move(parts.cart, [0, 0, (1 - pose.cart) * CART.drop]);
  setOpacity(parts.cart, pose.cart);
  setOpacity(parts.label, pose.label);
  setHtml(parts["hasp-case"], haspAt(HASPS.case, pose.hasps));
  setHtml(parts["hasp-cart"], haspAt(HASPS.cart, pose.hasps));
  setOpacity(parts["hasp-cart"], pose.cart);
  for (const name of ["tok-copy", "stk-copy"]) {
    move(parts[name], [0, 0, (1 - pose.copies) * 12]);
    setOpacity(parts[name], pose.copies);
  }
  setHtml(parts["hasp-tok"], haspAt(HASPS.tok, pose.copyHasps));
  setHtml(parts["hasp-stk"], haspAt(HASPS.stk, pose.copyHasps));
}

// Lighting: stations on, everything else one tone down.
function light(on, dimRest, dimLine) {
  stationEls.forEach((node) => {
    const lit = on.includes(node.dataset.station);
    node.toggleAttribute("data-on", lit);
    const level = lit ? 0 : dimRest(node);
    if (level) node.setAttribute("data-dim", String(level));
    else node.removeAttribute("data-dim");
  });
  lineGroup.toggleAttribute("data-dim", dimLine);
}

const FINAL = buildPose(8, 1);
const EMPTY = runPose(plan, 0);
const HOLD = 2.6, FADE = 0.7;
const LOOP = plan.end + HOLD + FADE;
const loopPose = (t) => runPose(plan, Math.min(t, plan.end), clamp01((t - plan.end - HOLD) / FADE));
const passText = (pose) => "pass " + pose.pass + " · in " + pose.inCount + " · out " + pose.outCount;
let touring = !STILL.matches;
let idleTimer = 0;

`;

const VARIANTS = String.raw`
if (VARIANT === "map") {
  let clock = 0, chosen = -1, wait = 1.4;
  const nameEl = out("name"), jobEl = out("job"), linkEl = out("link");
  const intro = { name: nameEl.textContent, job: jobEl.textContent, href: linkEl.getAttribute("href") };
  drawBuild(FINAL);
  const choose = (index) => {
    chosen = index;
    const st = DATA.stations[index];
    if (st) {
      light([st.key], () => 1, true);
      setText(nameEl, st.name);
      setText(jobEl, st.job);
      linkEl.setAttribute("href", st.href);
      stage.setAttribute("aria-valuenow", String(index + 1));
      stage.setAttribute("aria-valuetext", st.name + ": " + st.job);
      say(st.name.toLowerCase());
    } else {
      light([], () => 0, false);
      setText(nameEl, intro.name);
      setText(jobEl, intro.job);
      linkEl.setAttribute("href", intro.href);
      stage.setAttribute("aria-valuetext", "No station chosen");
    }
    loop.kick();
  };
  const loop = figureLoop(stage, (dt, calm) => {
    if (!calm) {
      if (wait > 0) wait -= dt;
      else clock = (clock + dt) % LOOP;
    } else clock = plan.passes[1].end - 0.01;
    const pose = loopPose(clock);
    drawRun(pose);
    if (chosen < 0) say(passText(pose));
    return !calm;
  });
  const stationAt = (target) => {
    const node = target.closest && target.closest("[data-station]");
    return node ? DATA.stations.findIndex((st) => st.key === node.dataset.station) : -1;
  };
  svg.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const index = stationAt(event.target);
    if (index !== chosen) choose(index);
  });
  stage.addEventListener("pointerleave", (event) => { if (event.pointerType !== "touch" && document.activeElement !== stage) choose(-1); });
  svg.addEventListener("click", (event) => {
    const index = stationAt(event.target);
    if (index < 0) return;
    if (event.pointerType === "touch" && index !== chosen) { choose(index); return; }
    location.href = DATA.stations[index].href;
  });
  stage.addEventListener("keydown", (event) => {
    const count = DATA.stations.length;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") choose((chosen + 1) % count);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") choose((chosen - 1 + count) % count);
    else if (event.key === "Home") choose(0);
    else if (event.key === "End") choose(count - 1);
    else if (event.key === "Enter" && chosen >= 0) location.href = DATA.stations[chosen].href;
    else if (event.key === "Escape") choose(-1);
    else return;
    event.preventDefault();
  });
  stage.addEventListener("blur", () => choose(-1));
  drawRun(loopPose(STILL.matches ? plan.passes[1].end - 0.01 : 0));
}

if (VARIANT === "run") {
  let clock = 0, playing = !STILL.matches, wait = 1.4, lastPass = 0;
  const playBtn = root.querySelector('[data-act="play"]');
  const replayBtn = root.querySelector('[data-act="replay"]');
  const phase = out("phase"), live = out("live");
  drawBuild(FINAL);
  light([], (node) => (node.closest('[data-part="back"]') ? 2 : 0), false);
  const label = () => setText(playBtn, playing ? "Pause" : "Play");
  const stepTo = (t) => { clock = t; loop.kick(); };
  const endOf = (p) => plan.passes[Math.min(plan.passes.length, Math.max(1, p)) - 1].end - 0.01;
  const draw = () => {
    const pose = loopPose(clock);
    drawRun(pose);
    const text = passText(pose);
    say(text);
    const done = clock >= plan.end;
    setText(phase, done ? "Request done: " + pose.outCount + " tokens written" : pose.pass === 1 ? "Pass 1: all " + plan.N + " prompt tokens go through" : "Pass " + pose.pass + ": only the newest token goes through");
    if (pose.pass !== lastPass) { lastPass = pose.pass; setText(live, "Pass " + pose.pass + ". Input " + pose.inCount + ". Output " + pose.outCount + "."); }
  };
  const loop = figureLoop(stage, (dt, calm) => {
    if (playing && !calm) {
      if (wait > 0) wait -= dt;
      else { clock += dt; if (clock >= LOOP) clock = 0; }
    }
    draw();
    return playing && !calm;
  });
  const toggle = () => {
    if (STILL.matches) { const next = plan.passes.find((pass) => pass.end > clock + 0.02); stepTo(next ? next.end - 0.01 : endOf(1)); return; }
    playing = !playing; wait = 0; label(); loop.kick();
  };
  const replay = () => { clock = STILL.matches ? endOf(1) : 0; wait = 0.4; if (!STILL.matches) playing = true; label(); loop.kick(); };
  playBtn.addEventListener("click", toggle);
  replayBtn.addEventListener("click", replay);
  stage.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") toggle();
    else if (event.key === "Home") replay();
    else return;
    event.preventDefault();
  });
  if (STILL.matches) { clock = endOf(1); playing = false; }
  label();
  draw();
}

if (VARIANT === "tour") {
  const STEPS = DATA.steps;
  const B = DATA.buildSteps;
  const minDur = 2.4;
  const durOf = (s) => (s <= B ? plan.timesBuild[s - 1] : Math.max(minDur, (plan.windows[s - B - 1][1] - plan.windows[s - B - 1][0]) * 1.3));
  let step = 1, local = 0, playing = !STILL.matches, paused = false, wait = 1.4, holdLeft = 0;
  const playBtn = root.querySelector('[data-act="play"]');
  const range = root.querySelector('input[type="range"]');
  const title = out("title"), text = out("text"), stepOut = out("step");
  const label = () => setText(playBtn, playing ? "Pause" : "Play");
  const describe = () => {
    const st = STEPS[step - 1];
    stage.setAttribute("aria-valuenow", String(step));
    stage.setAttribute("aria-valuetext", "Step " + step + " of " + STEPS.length + ": " + st.title + ". " + st.text);
    setText(title, st.title);
    setText(text, st.text);
    setText(stepOut, step + " / " + STEPS.length);
    if (range.value !== String(step)) range.value = String(step);
    light(st.lit, (node) => ((step <= B) === !node.closest('[data-part="back"]') ? 2 : 1), step <= B);
  };
  const draw = () => {
    const u = clamp01(local / durOf(step));
    if (step <= B) {
      drawBuild(buildPose(step, u));
      drawRun(EMPTY);
    } else {
      drawBuild(FINAL);
      const w = plan.windows[step - B - 1];
      drawRun(runPose(plan, w[0] + (w[1] - w[0]) * u));
    }
    const t = STEPS[step - 1].title;
    say("step " + step + " of " + STEPS.length + " · " + t[0].toLowerCase() + t.slice(1));
  };
  const go = (next, manual) => {
    step = ((next - 1 + STEPS.length) % STEPS.length) + 1;
    local = STILL.matches ? durOf(step) : 0;
    holdLeft = 0;
    describe();
    if (manual) steer();
    loop.kick();
  };
  function steer() {
    if (!playing && paused) return;
    playing = false;
    label();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!paused && !STILL.matches) { playing = true; label(); loop.kick(); } }, 6000);
  }
  const loop = figureLoop(stage, (dt, calm) => {
    let moving = false;
    if (calm) local = durOf(step);
    else if (wait > 0 && playing) { wait -= dt; moving = true; }
    else if (local < durOf(step)) { local = Math.min(durOf(step), local + dt); moving = true; }
    else if (playing) {
      holdLeft += dt;
      moving = true;
      if (holdLeft > (step === STEPS.length ? 3.2 : 1.8)) go(step + 1, false);
    }
    draw();
    return moving || playing;
  });
  root.querySelector('[data-act="prev"]').addEventListener("click", () => go(step - 1, true));
  root.querySelector('[data-act="next"]').addEventListener("click", () => go(step + 1, true));
  playBtn.addEventListener("click", () => {
    if (STILL.matches) return;
    playing = !playing;
    paused = !playing;
    clearTimeout(idleTimer);
    wait = 0;
    label();
    loop.kick();
  });
  range.addEventListener("input", () => go(Number(range.value), true));
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(step + 1, true);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(step - 1, true);
    else if (event.key === "Home") go(1, true);
    else if (event.key === "End") go(STEPS.length, true);
    else if (event.key === " ") { playBtn.click(); }
    else return;
    event.preventDefault();
  });
  if (STILL.matches) { playing = false; local = durOf(1); playBtn.disabled = true; }
  label();
  describe();
  draw();
}
`;

function cssOf(id) {
  const f = `[data-fig="${id}"]`;
  return `
${f} .iso-stage{--mx-hi:var(--anatomy-hi);--mx-mid:var(--anatomy-mid);--mx-lo:var(--anatomy-lo);--mx-faint:var(--anatomy-faint);--mx-lit:var(--anatomy-lit);--mx-s3:var(--anatomy-shade-3);--mx-top:var(--anatomy-top)}
${f} [data-dim]{--anatomy-hi:var(--mx-mid);--anatomy-mid:var(--mx-lo);--anatomy-lo:var(--mx-faint);--anatomy-lit:var(--mx-mid);--anatomy-dot:var(--mx-lo)}
${f} [data-dim="2"]{--anatomy-hi:var(--mx-lo);--anatomy-mid:var(--mx-faint);--anatomy-lo:var(--mx-faint);--anatomy-lit:var(--mx-lo)}
${f} [data-on]{--anatomy-hi:var(--mx-lit);--anatomy-mid:var(--mx-hi);--anatomy-lo:var(--mx-mid)}
${f} .iso-line,${f} .iso-edge{transition:stroke .3s var(--anatomy-ease)}
${f} [data-station]{cursor:${"default"}}
${f}.mx-map [data-station]{cursor:pointer}
${f} .mx-hole{fill:var(--anatomy-shade-0);stroke:none}
${f} .mx-window{fill:var(--anatomy-paper);stroke:none}
${f} .mx-digit{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-weight:500}
${f} .mx-card{fill:var(--anatomy-mid);stroke:none}
${f} .mx-lamp{fill:var(--anatomy-lit);stroke:none}
${f} .mx-ball{fill:var(--anatomy-shade-1);stroke:var(--anatomy-hi);stroke-width:.6px;vector-effect:non-scaling-stroke}
${f} .mx-shine{fill:var(--anatomy-top);stroke:none}
${f} .mx-slug>.iso-top{fill:var(--anatomy-lit)}
${f} .mx-slug>.iso-shade{fill:var(--anatomy-hi)}
${f} .mx-slug>.iso-fill{fill:var(--anatomy-hi)}
${f} .mx-slug>.iso-edge{stroke:var(--anatomy-lit)}
${f} .mx-slug>.iso-crease,${f} .mx-slug>.iso-bevel{stroke:var(--anatomy-mid)}
${f} .mx-id{fill:var(--anatomy-paper);font-family:var(--anatomy-mono);font-weight:600;letter-spacing:0}
${f} .mx-note{display:grid;grid-template-columns:auto 1fr auto;gap:4px 14px;align-items:baseline;margin:14px 0 0;min-height:3.2em;font-size:15px;line-height:1.5}
${f} .mx-note .label{color:var(--anatomy-strong);white-space:nowrap}
${f} .mx-note a{white-space:nowrap;font-size:14px}
${f} .mx-phase{margin-left:auto}
@media (max-width:640px){${f} .mx-note{grid-template-columns:1fr}}
`;
}
