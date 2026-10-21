// Writes a standalone preview of one figure, in the site's styles, for capture and line checks.
//   node src/preview.mjs effort-cam                 light theme
//   node src/preview.mjs effort-cam --dark          dark theme
//   node src/preview.mjs machine --variant tour     a figure variant
// Output: src/figures/<name>/out/<id>-<theme>.html
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPreview } from "./site/shell.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const name = argv.find((arg) => !arg.startsWith("--"));
if (!name) {
  console.log("usage: node src/preview.mjs <figure> [--dark] [--variant v] [--fig n]");
  process.exit(1);
}
const flag = (key) => {
  const at = argv.indexOf(key);
  return at < 0 ? undefined : argv[at + 1];
};
const theme = argv.includes("--dark") ? "dark" : "light";
const variant = flag("--variant");
const id = variant ? `${name}-${variant}` : name;
const module = await import(join(HERE, "figures", name, "figure.mjs"));
const built = module.build({ fig: `Fig ${flag("--fig") ?? 1}`, id, variant, page: "preview" });
const outDir = join(HERE, "figures", name, "out");
mkdirSync(outDir, { recursive: true });
const fonts = relative(outDir, join(HERE, "..", "fonts"));
const file = join(outDir, `${id}-${theme}.html`);
writeFileSync(file, renderPreview({ figure: { id, ...built }, fonts, theme, title: id }));
const svgBytes = (built.html.match(/<svg[\s\S]*<\/svg>/) || [""])[0].length;
console.log(`wrote ${relative(join(HERE, ".."), file)} · figure html ${(built.html.length / 1024).toFixed(0)} KB · svg ${(svgBytes / 1024).toFixed(0)} KB`);
