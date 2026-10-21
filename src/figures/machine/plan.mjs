// The run timeline and the poses of the machine, as pure data and pure functions. The build
// computes the plan once from the model; the page runs the pose functions every frame, so the
// readout, the counters and the moving parts always come from the same instant.
import { PROMPT_TOKENS, OUTPUT_TOKENS, PASSES, BLOCKS, COLUMNS, TIMING, BUILD_TIMES, drawerOf, logitsOf, pocketsOf, cacheAfter } from "./model.mjs";
import { SET_X, PITCH, CASTER_X } from "./draw.mjs";

// One request, laid out in seconds. Pass 1 cuts the prompt, looks up every prompt token and
// runs the stack over all of them. Each later pass looks up only the newest token.
export function runPlan() {
  const T = TIMING;
  const N = PROMPT_TOKENS.length;
  const slugs = [];
  const cuts = [];
  const passes = [];
  let t = 0.3;
  PROMPT_TOKENS.forEach((token, index) => {
    // Earlier slugs move one place left, then the tokenizer pushes the new slug out.
    slugs.push({ id: token.id, drawer: drawerOf(token.id), kind: "prompt", shift: [t, t + 0.2], emerge: [t + 0.18, t + 0.46], hops: [] });
    cuts.push([t, t + 0.3]);
    t += T.cut;
  });
  const cutEnd = t;
  // Pass 1 looks up every prompt token, one drawer after another.
  slugs.forEach((slug) => {
    slug.hops.push([t, t + T.read - 0.03]);
    t += T.read;
  });
  const readEnd = t;
  t = readEnd + 0.1;
  for (let p = 1; p <= PASSES; p++) {
    const pass = { p, start: p === 1 ? 0 : t };
    if (p > 1) {
      // Only the newest token goes through: its drawer opens.
      const newest = slugs[N + p - 2];
      newest.hops.push([t, t + T.readNew]);
      t += T.readNew + 0.05;
    }
    pass.stack = t;
    pass.layers = Array.from({ length: BLOCKS }, (_, i) => t + i * T.layer);
    t += BLOCKS * T.layer + 0.2;
    pass.logits = [t, t + T.logits];
    t += T.logits + 0.05;
    pass.spin = [t, t + T.spin];
    t += T.spin + 0.05;
    const token = OUTPUT_TOKENS[p - 1];
    const ride = Math.abs(CASTER_X - (SET_X + PITCH)) / T.speed;
    const slug = { id: token.id, drawer: drawerOf(token.id), kind: "output", pass: p, cast: [t, t + T.cast], ride: [t + T.cast, t + T.cast + ride], hops: [] };
    pass.cast = slug.cast;
    t += T.cast + ride;
    slug.shift = [t, t + T.append];
    pass.append = slug.shift;
    t += T.append + T.rest;
    pass.end = t;
    slugs.push(slug);
    passes.push(pass);
  }
  // Each pass's gauge heights (0 to 1) and sampler pockets.
  const LOW = -0.5;
  const HIGH = 5.6;
  const heights = passes.map(({ p }) => logitsOf(p).map((entry) => Math.max(0.04, Math.min(1, (entry.score - LOW) / (HIGH - LOW)))));
  const pockets = passes.map(({ p }) => pocketsOf(p).map((entry) => +entry.share.toFixed(4)));
  // Tour windows for the run steps (8 to 12), in run time.
  const first = passes[0];
  const windows = [
    [0, cutEnd],
    [cutEnd, readEnd],
    [first.stack, first.logits[0]],
    [first.logits[0], first.spin[1] + 0.02],
    [first.cast[0], passes[1].stack - 0.05],
  ];
  return { slugs, cuts, passes, heights, pockets, end: t, windows, N, timesBuild: BUILD_TIMES, columns: COLUMNS, blocks: BLOCKS, cache: passes.map(({ p }) => cacheAfter(p)) };
}

// ---------------------------------------------------------------- page functions

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};
const within = (t, [a, b]) => clamp01((t - a) / (b - a));

// The run's pose at time t (page). `fade` dims slugs and cards at the end of a loop.
export function runPose(plan, t, fade = 0) {
  const pose = { slugs: [], drawers: [], lamps: [], cards: [], sliders: [], fade };
  const N = plan.N;
  let inCount = 0;
  let tape = 0;
  let knife = 0;
  plan.cuts.forEach((cut) => {
    const u = within(t, cut);
    tape += 5.2 * ease(u);
    if (t >= (cut[0] + cut[1]) / 2) inCount += 1;
    if (u > 0 && u < 1) knife = Math.sin(Math.PI * u);
  });
  pose.inCount = inCount;
  pose.tape = tape;
  pose.knife = knife;
  // Slugs: each one's place in the row counts the slugs that arrived after it.
  const drawerOpen = new Array(12).fill(0);
  plan.slugs.forEach((slug, j) => {
    let behind = 0;
    for (let a = j + 1; a < plan.slugs.length; a++) behind += ease(within(t, plan.slugs[a].shift));
    let hop = 0;
    slug.hops.forEach((window) => {
      const u = within(t, window);
      if (u > 0 && u < 1) hop = Math.max(hop, Math.sin(Math.PI * u));
      const open = u <= 0 || u >= 1 ? 0 : Math.min(1, Math.min(u, 1 - u) * 5);
      drawerOpen[slug.drawer] = Math.max(drawerOpen[slug.drawer], ease(open));
    });
    const s = { show: false, x: SET_X - behind * PITCH, y: 0, z: hop * 3, place: "row" };
    if (slug.kind === "prompt") {
      if (t >= slug.emerge[0]) {
        s.show = true;
        const u = ease(within(t, slug.emerge));
        if (u < 1) {
          s.place = "exit";
          s.x = SET_X;
          s.y = -12 * (1 - u);
        }
      }
    } else if (t >= slug.cast[0]) {
      s.show = true;
      if (t < slug.cast[1]) {
        s.place = "outlet";
        s.x = CASTER_X;
        s.y = -16 * (1 - ease(within(t, slug.cast)));
      } else if (t < slug.ride[1]) {
        const u = within(t, slug.ride);
        s.x = CASTER_X + (SET_X + PITCH - CASTER_X) * u;
      } else if (t < slug.shift[1]) {
        s.x = SET_X + PITCH * (1 - ease(within(t, slug.shift)));
      }
    }
    pose.slugs.push(s);
  });
  pose.drawers = drawerOpen;
  // Passes: lamps, cache cards, gauge heights, the sampler, the output counter, the belt.
  let current = 1;
  let outCount = 0;
  let belt = 0;
  const lamps = new Array(plan.blocks).fill(0);
  const cardPasses = new Array(plan.blocks).fill(0);
  let heights = new Array(plan.columns).fill(0);
  let ball = null;
  let pockets = null;
  let pocketTurn = 0;
  plan.passes.forEach((pass, index) => {
    if (t >= pass.start) current = pass.p;
    pass.layers.forEach((start, i) => {
      const age = t - start;
      if (age >= 0) {
        cardPasses[i] = pass.p;
        lamps[i] = Math.max(lamps[i], age < 0.08 ? age / 0.08 : Math.exp(-(age - 0.08) / 0.35));
      }
    });
    if (t >= pass.logits[0]) {
      const from = index ? plan.heights[index - 1] : heights;
      const u = ease(within(t, pass.logits));
      heights = plan.heights[index].map((h, c) => from[c] + (h - from[c]) * u);
    }
    if (t >= pass.spin[0]) {
      pockets = plan.pockets[index];
      pocketTurn = 0.7 + pass.p * 1.9;
      const u = within(t, pass.spin);
      // The ball ends in the middle of the first (largest) pocket.
      const end = pocketTurn + pockets[0] * Math.PI;
      const angle = end + 9 * (1 - u) * (1 - u);
      const r = 12.6 - 3.8 * ease((u - 0.62) / 0.3);
      ball = { angle, r, hop: u < 1 ? Math.abs(Math.sin(u * 30)) * 0.4 * (1 - u) : 0 };
    }
    if (t >= (pass.cast[0] + pass.cast[1]) / 2) outCount = pass.p;
    belt += 260 * Math.max(0, Math.min(t, pass.cast[1] + (Math.abs(CASTER_X - (SET_X + PITCH)) / 260)) - pass.cast[1]);
  });
  pose.pass = current;
  pose.outCount = outCount;
  pose.lamps = lamps.map((x) => Math.min(1, x));
  pose.cards = cardPasses.map((p) => (p ? plan.cache[p - 1] : 0));
  pose.sliders = heights;
  pose.ball = ball;
  pose.pockets = pockets;
  pose.pocketTurn = pocketTurn;
  pose.belt = belt;
  return pose;
}

// The build deck's pose for tour step s (1 to 7) at progress u (page). Step 0 is before any
// build step; step 8 is the finished, locked build.
export function buildPose(s, u) {
  const done = (step) => (s > step ? 1 : s < step ? 0 : u);
  const pose = {};
  const sel = done(1);
  // Three sheets pass the filter; each lands on the selected stack, which then grows.
  pose.selected = 0.25;
  pose.sheet = -1;
  pose.sheetFade = 0;
  for (let i = 0; i < 3; i++) {
    const f = clamp01(sel * 3 - i);
    pose.selected += 0.25 * ease((f - 0.78) / 0.22);
    if (f > 0 && f < 1) {
      pose.sheet = Math.min(1, f / 0.78);
      pose.sheetFade = ease((f - 0.78) / 0.22);
    }
  }
  pose.step = s;
  const tok = done(2);
  pose.blade = s === 2 ? Math.sin(Math.PI * clamp01(u / 0.32)) : 0;
  pose.vocab = ease((tok - 0.3) / 0.62);
  pose.strip = ease(done(3));
  // Forward pass: the bridge reads the batch across the board. Loss: the gauge reads how far
  // the predictions miss. Backward pass: the bridge returns and turns each trim screw.
  const fwd = done(4);
  const back = done(5);
  const sweep = (back - 0.28) / 0.6;
  pose.bridge = ease(fwd) * (1 - ease(sweep));
  pose.sweep = clamp01(sweep);
  pose.loss = 0.82 * ease(back / 0.25) - 0.2 * ease((back - 0.88) / 0.12);
  const save = done(6);
  pose.cart = ease(save / 0.6);
  pose.label = ease((save - 0.62) / 0.3);
  const lock = done(7);
  pose.hasps = 1 - ease((lock - 0.45) / 0.4);
  pose.copies = ease(lock / 0.4);
  pose.copyHasps = 1 - ease((lock - 0.5) / 0.4);
  return pose;
}
