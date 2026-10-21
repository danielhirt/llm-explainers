// The figure card. Wraps the kit's plate so each figure carries data-fig (its script's root)
// and optional controls inside the card, under the drawing.
import { plateHtml } from "../kit/iso-kit.mjs";

export function plate({ id, fig, title, hint, readout = "", keys = [], caption, stage, controls = "", wide = false, extraClass = "" }) {
  const body = `${stage}${controls}`;
  const html = plateHtml({ fig, title, hint, readout, keys, caption, body });
  const classes = ["iso-figure", wide ? "hero" : "", extraClass].filter(Boolean).join(" ");
  return html.replace('<figure class="iso-figure">', `<figure class="${classes}" data-fig="${id}">`);
}

// The focusable stage around the SVG.
export function stageHtml({ svg, label, role = "group", attrs = "" }) {
  return `<div class="iso-stage" tabindex="0" role="${role}" aria-label="${label.replace(/"/g, "&quot;")}"${attrs ? ` ${attrs}` : ""}>${svg}</div>`;
}
