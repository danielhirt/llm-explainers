// The page template: one self-contained HTML document per page, with the kit's styles,
// the site styles, every figure's styles and one module script inlined.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ISO_CSS } from "../kit/iso-kit.mjs";
import { ROUTE, SITE } from "../pages/site.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_CSS = readFileSync(join(HERE, "site.css"), "utf8");
const RUNTIME = readFileSync(join(HERE, "runtime.js"), "utf8");
const exportsOf = (source) => [...source.matchAll(/^export (?:function|const|let) ([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
// The kit's core inlines at the top level, so live code can call iso() or k.iso().
const KIT_SOURCE = readFileSync(join(HERE, "..", "kit", "iso-kit.mjs"), "utf8");
const KIT = `${KIT_SOURCE.replace(/^export /gm, "")}\nconst k = { ${exportsOf(KIT_SOURCE).join(", ")} };`;
// lathe.mjs and tube.mjs share helper names with the core, so each inlines in its own scope as G and TB.
const scoped = (file, name) => {
  const source = readFileSync(join(HERE, "..", "kit", file), "utf8");
  const body = source.replace(/^import .*$/gm, "").replace(/^export /gm, "");
  return `const ${name} = (() => {\n${body}\nreturn { ${exportsOf(source).join(", ")} };\n})();`;
};
const TUBE_SOURCE = readFileSync(join(HERE, "..", "kit", "tube.mjs"), "utf8");
const LIBS = {
  lathe: () => scoped("lathe.mjs", "G"),
  tube: () => `const TB = ((G) => {\n${TUBE_SOURCE.replace(/^import .*$/gm, "").replace(/^export /gm, "")}\nreturn { ${exportsOf(TUBE_SOURCE).join(", ")} };\n})(G);`,
};

export const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// An isometric cube outline in ink on paper, the site's mark.
const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#f2f2ef"/><path d="M16 4 27 10v12l-11 6-11-6V10z" fill="#fbfbfa" stroke="#18181a" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 10l11 6 11-6M16 16v12" fill="none" stroke="#18181a" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 16 27 10v12l-11 6z" fill="#dcdcd9"/><path d="M16 16 27 10v12l-11 6zM5 10l11 6 11-6M16 16v12" fill="none" stroke="#18181a" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  );

const THEME_INIT = `(function(){var d=document.documentElement,t=null;try{t=localStorage.getItem("model-mechanics-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",t)})();`;

function mast({ prefix, crumb }) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="mast"><div class="mast-inner"><a class="mast-brand" href="${prefix}index.html">${escape(SITE.name)}</a>${crumb ? `<span class="mast-crumb">${escape(crumb)}</span>` : ""}<button class="btn mast-theme" type="button" data-theme-toggle>Theme</button></div></header>`;
}

function footer({ prefix, current }) {
  // The landing page lists the route in its body, so its footer carries only the byline.
  if (current === "index") return `<footer class="foot"><div class="foot-inner"><div class="foot-meta"><span>${escape(SITE.tagline)}</span><span>${escape(SITE.author)} · <a href="https://danielhirt.dev">danielhirt.dev</a></span></div></div></footer>`;
  const items = ROUTE.map((entry) => {
    const href = prefix + entry.file;
    const head = `<b>${entry.n} · ${escape(entry.kind)}</b>${escape(entry.title)}`;
    return entry.slug === current ? `<li><span aria-current="page">${head}</span></li>` : `<li><a href="${href}">${head}</a></li>`;
  }).join("");
  return `<footer class="foot"><div class="foot-inner"><span class="label">${escape(SITE.name)} · the route</span><ol class="route">${items}</ol><div class="foot-meta"><span>${escape(SITE.tagline)}</span><span>${escape(SITE.author)} · <a href="https://danielhirt.dev">danielhirt.dev</a></span></div></div></footer>`;
}

const cssOf = (fonts, figures) => [ISO_CSS, SITE_CSS.replaceAll("__FONTS__", fonts), ...figures.map((figure) => figure.css || "")].join("\n");

function scriptOf(figures) {
  const scripts = figures
    .filter((figure) => figure.script)
    .map((figure) => `(function (root) {\nif (!root) return;\n${figure.script}\n})(document.querySelector('[data-fig="${figure.id}"]'));`)
    .join("\n");
  const needs = new Set(figures.flatMap((figure) => figure.needs || []));
  if (needs.has("tube")) needs.add("lathe");
  const libs = ["lathe", "tube"].filter((name) => needs.has(name)).map((name) => LIBS[name]()).join("\n");
  return `${KIT}\n${libs}\n${RUNTIME}\n${scripts}`.replace(/<\/(script)/gi, "<\\/$1");
}

// A bare page with one figure in the wide column, for capture and line checks.
export function renderPreview({ figure, fonts, theme = "light", title = "Preview" }) {
  return `<!doctype html>
<html lang="en" class="iso" data-theme="${theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>${cssOf(fonts, [figure])}</style>
</head>
<body>
<main class="page" style="padding:32px 0">
${figure.html}
</main>
<script type="module">${scriptOf([figure])}</script>
</body>
</html>
`;
}

// figures: [{ id, html, css, script }] in page order.
export function renderPage({ slug, title, description, depth = 1, crumb, body, figures = [] }) {
  const prefix = depth ? "../".repeat(depth) : "";
  const fonts = `${prefix}fonts`;
  const css = cssOf(fonts, figures);
  const script = scriptOf(figures);
  return `<!doctype html>
<html lang="en" class="iso" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta name="theme-color" content="#f2f2ef" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0b0b" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${ICON}">
<link rel="preload" href="${fonts}/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${fonts}/GeistMono-Variable.woff2" as="font" type="font/woff2" crossorigin>
<script>${THEME_INIT}</script>
<style>${css}</style>
</head>
<body>
${mast({ prefix, crumb })}
<main id="main" class="page">
${body}
</main>
${footer({ prefix, current: slug })}
<script type="module">${script}</script>
</body>
</html>
`;
}
