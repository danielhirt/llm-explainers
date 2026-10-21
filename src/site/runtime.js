// Shared page runtime. Inlined once per page, after the kit and before the figures.

const STILL = matchMedia("(prefers-reduced-motion: reduce)");

// The theme toggle in the mast. The head script has already set data-theme before paint.
(() => {
  const root = document.documentElement;
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  const label = () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    button.textContent = next === "dark" ? "Dark" : "Light";
    button.setAttribute("aria-label", `Switch to the ${next} theme`);
  };
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("model-mechanics-theme", root.dataset.theme); } catch (error) {}
    label();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    let saved = null;
    try { saved = localStorage.getItem("model-mechanics-theme"); } catch (error) {}
    if (saved) return;
    root.dataset.theme = event.matches ? "dark" : "light";
    label();
  });
  label();
})();

// One frame loop per figure. tick(dt, calm) returns true while anything still moves.
// The loop stops when the tick settles or the stage leaves the viewport, and kick() restarts it.
function figureLoop(stage, tick) {
  let frame = 0;
  let last = 0;
  let visible = false;
  const step = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const more = tick(dt, STILL.matches);
    frame = visible && more ? requestAnimationFrame(step) : 0;
  };
  const kick = () => {
    if (!frame && visible) {
      last = 0;
      frame = requestAnimationFrame(step);
    }
  };
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) kick();
  }, { rootMargin: "120px 0px" }).observe(stage);
  return { kick, isVisible: () => visible };
}

// Writes the card's readout only when the text changes.
function readoutOf(root) {
  const node = root.querySelector("[data-readout]");
  return (text) => {
    if (node && node.textContent !== text) node.textContent = text;
  };
}

// Exponential follow toward a target: x += (target − x)(1 − e^(−dt/τ)).
function follow(value, target, dt, seconds, calm) {
  if (calm) return target;
  const next = value + (target - value) * (1 - Math.exp(-dt / seconds));
  return Math.abs(target - next) < 1e-4 ? target : next;
}

// A sub-stepped spring on { at, rate }. Returns true once it has settled on the target.
function springTo(state, target, dt, stiffness, damping, calm) {
  if (calm) {
    state.at = target;
    state.rate = 0;
    return true;
  }
  const steps = 4;
  for (let index = 0; index < steps; index++) {
    state.rate += ((target - state.at) * stiffness - state.rate * damping) * (dt / steps);
    state.at += state.rate * (dt / steps);
  }
  if (Math.abs(target - state.at) < 5e-4 && Math.abs(state.rate) < 5e-4) {
    state.at = target;
    state.rate = 0;
    return true;
  }
  return false;
}
