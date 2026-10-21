// Builds every page of the site from src/pages and src/figures.
//   node src/build.mjs            write index.html and articles/*.html
//   node src/build.mjs tokenizer  write one page
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, REDIRECTS } from "./pages/site.mjs";
import { renderPage, escape } from "./site/shell.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const only = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
// --strict fails on a figure that does not exist yet; without it the page gets a marked placeholder.
const strict = process.argv.includes("--strict");
const missing = [];
const placeholder = (name, variant) => ({
  build: ({ fig, id }) => ({
    html: `<figure class="iso-figure" data-fig="${id}"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">${fig}</span><span class="iso-plate-corner" data-corner="title">In progress</span></div><p class="fine" style="margin:40px 0;text-align:center">Figure ${name}${variant ? ` (${variant})` : ""} is not built yet.</p></div></figure>`,
    css: "",
    script: "",
  }),
});

// <!-- figure:name key=value key="two words" -->
const MARKER = /<!--\s*figure:([a-z0-9-]+)((?:\s+[a-z]+=(?:"[^"]*"|\S+))*)\s*-->/g;
const optionsOf = (text) => Object.fromEntries([...text.matchAll(/([a-z]+)=("([^"]*)"|\S+)/g)].map((match) => [match[1], match[3] ?? match[2]]));

async function buildPage(page) {
  const source = readFileSync(join(HERE, "pages", page.source), "utf8");
  const figures = [];
  let count = 0;
  const parts = [];
  let last = 0;
  for (const match of source.matchAll(MARKER)) {
    const [text, name, rest] = match;
    const options = optionsOf(rest);
    let module;
    try {
      module = await import(join(HERE, "figures", name, "figure.mjs"));
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND" || strict) throw error;
      missing.push(`${page.slug}: ${name}`);
      module = placeholder(name, options.variant);
    }
    // Exercises that are not drawings (module.numbered === false) take no figure number.
    if (module.numbered !== false) count += 1;
    const fig = options.fig ? `Fig ${options.fig}` : `Fig ${count}`;
    const id = options.id || (options.variant ? `${name}-${options.variant}` : name);
    const built = module.build({ fig, id, variant: options.variant, page: page.slug });
    figures.push({ id, ...built });
    parts.push(source.slice(last, match.index), built.html);
    last = match.index + text.length;
  }
  parts.push(source.slice(last));
  const html = renderPage({ ...page, body: parts.join(""), figures });
  writeFileSync(join(ROOT, page.out), html);
  console.log(`wrote ${page.out} · ${(html.length / 1024).toFixed(0)} KB · ${figures.length} figure${figures.length === 1 ? "" : "s"}`);
}

function redirect({ out, to, title }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Model Mechanics</title>
<link rel="canonical" href="${to}">
<meta http-equiv="refresh" content="0; url=${to}">
</head>
<body>
<p>This page moved to <a href="${to}">${escape(title)}</a>.</p>
</body>
</html>
`;
  writeFileSync(join(ROOT, out), html);
  console.log(`wrote ${out} · redirect to ${to}`);
}

for (const page of PAGES) if (!only.length || only.includes(page.slug)) await buildPage(page);
if (!only.length) for (const entry of REDIRECTS) redirect(entry);
if (missing.length) console.warn(`placeholders for ${missing.length} missing figure${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
