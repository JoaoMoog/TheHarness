// Only panel width is persisted. No account data, messages or context here.
export function dockChat(pane, shell) {
  const splitter = document.createElement("div");
  splitter.className = "chat-resize hidden";
  splitter.tabIndex = 0;
  splitter.setAttribute("role", "separator");
  splitter.setAttribute("aria-orientation", "vertical");
  splitter.setAttribute("aria-label", "Redimensionar Copilot Chat");
  splitter.title = "Arraste para redimensionar o chat; use também as setas";
  shell.append(splitter, pane);
  let preferred = 420;
  try {
    const saved = Number(window.localStorage.getItem("chatWidth"));
    if (saved >= 320) preferred = saved;
  } catch {
    /* Storage can be disabled. */
  }
  const bounds = () => {
    const shellWidth = shell.getBoundingClientRect().width || window.innerWidth;
    const leftWidth =
      shell.querySelector(".sidebar")?.getBoundingClientRect().width || 275;
    return {
      min: 320,
      max: Math.max(320, Math.min(760, shellWidth - leftWidth - 48 - 10 - 240)),
    };
  };
  function resize(value = preferred, persist = false) {
    const { min, max } = bounds();
    const width = Math.max(min, Math.min(max, value));
    pane.style.width = `${width}px`;
    for (const [name, v] of Object.entries({ min, max, now: width }))
      splitter.setAttribute(`aria-value${name}`, String(v));
    if (persist) {
      preferred = width;
      try {
        window.localStorage.setItem("chatWidth", String(width));
      } catch {
        /* Optional preference. */
      }
    }
    return width;
  }
  splitter.onpointerdown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x = e.clientX,
      start = resize();
    splitter.setPointerCapture(e.pointerId);
    splitter.classList.add("dragging");
    splitter.onpointermove = (move) => resize(start + x - move.clientX, true);
    const stop = () => {
      splitter.onpointermove = null;
      splitter.classList.remove("dragging");
      if (splitter.hasPointerCapture(e.pointerId))
        splitter.releasePointerCapture(e.pointerId);
    };
    splitter.onpointerup =
      splitter.onpointercancel =
      splitter.onlostpointercapture =
        stop;
  };
  splitter.onkeydown = (e) => {
    const { min, max } = bounds();
    const keys = {
      ArrowLeft: resize() + 16,
      ArrowRight: resize() - 16,
      Home: min,
      End: max,
    };
    if (keys[e.key] !== undefined) {
      e.preventDefault();
      resize(keys[e.key], true);
    }
  };
  window.addEventListener("resize", () => resize());
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => resize());
    observer.observe(shell);
    const sidebar = shell.querySelector(".sidebar");
    if (sidebar) observer.observe(sidebar);
  }
  resize();
  return (visible) => {
    pane.classList.toggle("hidden", !visible);
    splitter.classList.toggle("hidden", !visible);
    if (visible) resize();
  };
}

export function dismissChatMenus(pane) {
  const menus = [...pane.querySelectorAll("details.chat-menu")];
  const close = () => {
    for (const menu of menus) menu.open = false;
  };
  for (const menu of menus) {
    menu.ontoggle = () => {
      if (menu.open)
        for (const other of menus) if (other !== menu) other.open = false;
    };
  }
  const outside = (e) => {
    for (const menu of menus) if (!menu.contains(e.target)) menu.open = false;
  };
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("focusin", outside, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  return close;
}
