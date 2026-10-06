// Release preview DOM and remove stale file metadata after the final view closes.
export function resetEmptyEditorView({ document, editor }) {
  editor.setModel(null);
  for (const id of [
    "editor",
    "diff",
    "image-view",
    "markdown-view",
    "reveal-diff",
    "conflict",
  ])
    document.getElementById(id)?.classList.add("hidden");
  for (const id of ["image-view", "markdown-view", "conflict"])
    document.getElementById(id)?.replaceChildren();
  const markdown = document.getElementById("markdown-view");
  if (markdown) markdown._markdownGeneration = null;
  const crumb = document.getElementById("crumb");
  crumb.textContent = "Seu espaço de trabalho";
  crumb.removeAttribute("title");
  document.getElementById("encoding").textContent = "UTF-8";
  document.getElementById("welcome").classList.remove("hidden");
}
