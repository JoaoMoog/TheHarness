import { marked, Renderer } from "marked";
import createDOMPurify from "dompurify";
export function previewKind(path = "") {
  if (/\.(md|markdown)$/i.test(path)) return "markdown";
  if (/\.html?$/i.test(path)) return "html";
  return null;
}
export function relativeResource(documentPath, reference) {
  if (!reference || reference.startsWith("#")) return null;
  let ref;
  try {
    ref = decodeURIComponent(reference.split(/[?#]/)[0]).replace(/\\/g, "/");
  } catch {
    return null;
  }
  if (
    !ref ||
    /^[a-z][a-z\d+.-]*:/i.test(ref) ||
    ref.startsWith("//") ||
    ref.includes("\0")
  )
    return null;
  const parts = ref.startsWith("/")
    ? []
    : documentPath.replace(/\\/g, "/").split("/").slice(0, -1);
  for (const part of ref.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/") || null;
}
const escape = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
export async function renderMarkdownPreview(
  body,
  text,
  { path, readImage, openLocal, openExternal },
) {
  const win = body.ownerDocument.defaultView;
  if (text.length > 512 * 1024) {
    body.textContent =
      "Markdown acima de 512 KiB: use o editor de texto para evitar prévia pesada.";
    return;
  }
  const renderer = new Renderer();
  // Never insert raw source URLs: no implicit remote image loads or navigation.
  renderer.image = ({ href, title, text }) =>
    `<img data-md-src="${escape(href)}" alt="${escape(text || "")}"${title ? ` title="${escape(title)}"` : ""}>`;
  renderer.html = ({ text }) =>
    text
      .replace(/\bsrc\s*=/gi, "data-md-src=")
      .replace(/\bsrcset\s*=/gi, "data-blocked-srcset=");
  const cleaner = createDOMPurify(win);
  if (cleaner.isSupported !== true) {
    body.textContent = text;
    return;
  }
  body.innerHTML = cleaner.sanitize(
    marked.parse(text, { renderer, async: false, gfm: true }),
    {
      ALLOWED_TAGS: [
        "p",
        "div",
        "span",
        "br",
        "pre",
        "code",
        "strong",
        "em",
        "a",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "blockquote",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "hr",
        "del",
        "img",
        "kbd",
        "details",
        "summary",
      ],
      ALLOWED_ATTR: [
        "href",
        "title",
        "alt",
        "data-md-src",
        "align",
        "width",
        "height",
      ],
      ALLOW_DATA_ATTR: false,
    },
  );
  const slugs = new Map();
  for (const heading of body.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    const base = heading.textContent
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "-");
    const count = slugs.get(base) || 0;
    slugs.set(base, count + 1);
    heading.id = count ? `${base}-${count}` : base;
  }
  for (const link of body.querySelectorAll("a")) {
    const href = link.getAttribute("href") || "";
    link.removeAttribute("href");
    link.setAttribute("role", "link");
    link.tabIndex = 0;
    const follow = async () => {
      if (href.startsWith("#")) {
        let id;
        try {
          id = decodeURIComponent(href.slice(1));
        } catch {
          return;
        }
        [...body.querySelectorAll("[id]")]
          .find((e) => e.id === id)
          ?.scrollIntoView?.();
        return;
      }
      const local = relativeResource(path, href);
      if (local) {
        await openLocal(local);
        return;
      }
      let url;
      try {
        url = new URL(href);
      } catch {
        return;
      }
      if (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
        await openExternal(url.href);
    };
    const activate = () =>
      Promise.resolve(follow()).catch((e) => {
        link.title = e.message || String(e);
      });
    link.onclick = (e) => {
      e.preventDefault();
      return activate();
    };
    link.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        activate();
      }
    };
  }
  let loaded = 0;
  const generation = {};
  body._markdownGeneration = generation;
  for (const image of body.querySelectorAll("img")) {
    const src = image.getAttribute("data-md-src");
    image.removeAttribute("data-md-src");
    const local = relativeResource(path, src);
    const unavailable = (message) => {
      const hint = body.ownerDocument.createElement("span");
      hint.className = "markdown-image-hint";
      hint.textContent = `[${image.alt || "Imagem"}: ${message}]`;
      image.replaceWith(hint);
    };
    if (!local) {
      unavailable("imagem externa não carregada automaticamente");
      continue;
    }
    if (loaded++ >= 8) {
      unavailable("limite de 8 imagens locais; abra o arquivo no explorador");
      continue;
    }
    try {
      const data = await readImage(local);
      if (!body.isConnected || body._markdownGeneration !== generation) return;
      if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(data.dataUrl || ""))
        throw new Error("Formato inválido");
      image.src = data.dataUrl;
    } catch (e) {
      unavailable(e.message || String(e));
    }
  }
}
