import { marked } from "marked";
import createDOMPurify from "dompurify";
const cleaners = new WeakMap();
export function renderAssistant(body, text, openLink, copy, fail) {
  let cleaner = cleaners.get(window);
  if (!cleaner) {
    cleaner = createDOMPurify(window);
    cleaners.set(window, cleaner);
  }
  if (cleaner.isSupported !== true) {
    body.textContent = text;
    return;
  }
  // Only run on completed responses. Streaming remains cheap plain text.
  if (text.length > 128 * 1024) {
    body.textContent = text;
    return;
  }
  body.innerHTML = cleaner.sanitize(
    marked.parse(text, { async: false, breaks: true }),
    {
      ALLOWED_TAGS: [
        "p",
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
      ],
      ALLOWED_ATTR: ["href", "title"],
    },
  );
  for (const link of body.querySelectorAll("a")) {
    let url;
    try {
      url = new URL(link.getAttribute("href"));
    } catch {
      /* Relative links are not a WebView navigation. */
    }
    if (
      !url ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      link.removeAttribute("href");
      continue;
    }
    link.onclick = (e) => {
      e.preventDefault();
      Promise.resolve(openLink(url.href)).catch(fail);
    };
  }
  for (const block of body.querySelectorAll("pre")) {
    const code = block.querySelector("code");
    if (!code) continue;
    const value = code.textContent;
    const button = document.createElement("button");
    button.className = "chat-copy-code";
    button.textContent = "Copiar código";
    button.onclick = () => Promise.resolve(copy(value)).catch(fail);
    block.prepend(button);
  }
}
export function nearBottom(element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 64;
}
// Prune ONLY presentation, never the SDK conversation. Bound maps as well as DOM.
export function pruneMessages(
  container,
  protectedNodes,
  maxNodes = 160,
  maxChars = 1024 * 1024,
) {
  let size = [...container.children].reduce(
    (n, node) => n + node.textContent.length,
    0,
  );
  let removed = 0;
  for (const node of [...container.children]) {
    if (container.children.length <= maxNodes && size <= maxChars) break;
    if (protectedNodes.has(node)) continue;
    size -= node.textContent.length;
    node.remove();
    removed++;
  }
  return removed;
}
