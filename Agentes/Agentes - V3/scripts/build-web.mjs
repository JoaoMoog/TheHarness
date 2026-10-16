import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["release", "validation"].includes(mode)) throw new Error("Use release or validation");
const source = resolve(root, "public");
const output = resolve(root, "dist", mode);
if (!output.startsWith(resolve(root, "dist") + sep)) throw new Error("Unsafe build path");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
if (mode === "validation") await cp(source, output, { recursive: true });
else {
  for (const folder of ["css", "img"]) await cp(resolve(source, folder), resolve(output, folder), { recursive: true });
  const copied = new Set();
  async function moduleGraph(file) {
    if (!file.startsWith(source + sep)) throw new Error("Import outside source");
    if (copied.has(file)) return;
    copied.add(file);
    const text = await readFile(file, "utf8");
    const dest = resolve(output, relative(source, file));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, text);
    for (const match of text.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)) {
      await moduleGraph(resolve(dirname(file), match[1]));
    }
  }
  await moduleGraph(resolve(source, "js/main.js"));
  const html = (await readFile(resolve(source, "index.html"), "utf8"))
    .replace(/<header id="presenter"[\s\S]*?<\/header>/, "")
    .replace(/<footer id="dock"[\s\S]*?<\/footer>/, "")
    .replace(/<title>.*?<\/title>/, "<title>Aval</title>");
  await writeFile(resolve(output, "index.html"), html);
  const files = await readdir(resolve(output, "js"), { recursive: true });
  if (files.some((f) => /scenarios|player|guide|slides|tours|balloon|moments|presentation-adapter|mocks[\\/]|actions[\\/]clock\.js/.test(f))) throw new Error("Presentation leaked into release");
}
await writeFile(resolve(output, "js/runtime.js"), `export const VALIDATION = ${mode === "validation"};\nexport const VERSION = "1.1.0";\n`);
console.log(`Built ${mode}: ${output}`);
