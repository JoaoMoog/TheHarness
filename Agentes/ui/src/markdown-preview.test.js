import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  previewKind,
  relativeResource,
  renderMarkdownPreview,
} from "./markdown-preview.js";
test("preview kind matches Markdown and HTML only; relative resources cannot escape workspace", () => {
  assert.equal(previewKind("README.MD"), "markdown");
  assert.equal(previewKind("docs/file.markdown"), "markdown");
  assert.equal(previewKind("index.htm"), "html");
  assert.equal(previewKind("EventMapa.ts"), null);
  assert.equal(
    relativeResource("docs/README.md", "../assets/screen.png"),
    "assets/screen.png",
  );
  for (const ref of [
    "../../secret.png",
    "https://example.com/a.png",
    "//example.com/a.png",
    "C:/secret.png",
    "%2e%2e/%2e%2e/private.png",
    "javascript:alert(1)",
  ])
    assert.equal(relativeResource("docs/readme.md", ref), null);
});
test("Markdown preview renders buffer, tables, code and raw-HTML local images without remote loads/scripts", async () => {
  const win = new JSDOM("<main></main>", { url: "http://speedcode.localhost" })
    .window;
  const body = win.document.querySelector("main");
  const loaded = [],
    opened = [],
    external = [];
  await renderMarkdownPreview(
    body,
    '# Local preview\n\nUnsaved **buffer**.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```\n\n![Local](../assets/one.png)\n\n<p align="center"><kbd><img src="../assets/two.jpg" onerror="alert(1)" style="background:url(https://tracker)"></kbd></p>\n\n![Remote](https://tracker.example/x.png)\n\n[File](../other.md) [Docs](https://example.com/docs) [Unsafe](javascript:alert)\n<script>bad()</script><iframe src="https://tracker"></iframe>',
    {
      path: "docs/README.md",
      readImage: async (path) => {
        loaded.push(path);
        return { dataUrl: "data:image/png;base64,AQ==" };
      },
      openLocal: async (path) => opened.push(path),
      openExternal: async (url) => external.push(url),
    },
  );
  assert.equal(body.querySelector("h1").textContent, "Local preview");
  assert.equal(body.querySelector("strong").textContent, "buffer");
  assert.ok(body.querySelector("table"));
  assert.match(body.querySelector("pre").textContent, /const x/);
  assert.deepEqual(loaded, ["assets/one.png", "assets/two.jpg"]);
  assert.equal(body.querySelectorAll("img").length, 2);
  assert.equal(
    body.querySelectorAll("script,iframe,[onerror],[style],img[src^='http']")
      .length,
    0,
  );
  assert.match(body.textContent, /imagem externa não carregada/);
  const links = [...body.querySelectorAll("a")];
  await links
    .find((x) => x.textContent === "File")
    .onclick({ preventDefault() {} });
  await links
    .find((x) => x.textContent === "Docs")
    .onclick({ preventDefault() {} });
  await links
    .find((x) => x.textContent === "Unsafe")
    .onclick({ preventDefault() {} });
  assert.deepEqual(opened, ["other.md"]);
  assert.deepEqual(external, ["https://example.com/docs"]);
  win.close();
});
test("Markdown image count and rendering budget are bounded; unavailable image is explained", async () => {
  const win = new JSDOM("<main></main>").window,
    body = win.document.querySelector("main");
  let reads = 0;
  await renderMarkdownPreview(
    body,
    Array.from({ length: 10 }, (_, i) => `![img${i}](a${i}.png)`).join("\n\n"),
    {
      path: "README.md",
      readImage: async () => {
        reads++;
        throw new Error("Image limit");
      },
      openLocal: async () => {},
      openExternal: async () => {},
    },
  );
  assert.equal(reads, 8);
  assert.match(body.textContent, /limite de 8 imagens/);
  await renderMarkdownPreview(body, "x".repeat(512 * 1024 + 1), {
    path: "README.md",
  });
  assert.match(body.textContent, /acima de 512 KiB/);
  win.close();
});
