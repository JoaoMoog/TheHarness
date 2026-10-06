// Small per-session controls. No listeners on document, polling or new timers.
export function createTerminalTab({
  document,
  session,
  active,
  icon,
  onSelect,
  onClose,
  onError,
}) {
  const tab = document.createElement("div");
  tab.className = `term-tab${active ? " active" : ""}`;
  const select = document.createElement("button");
  select.type = "button";
  select.className = "term-tab-select";
  select.title = session.root;
  select.setAttribute("aria-pressed", String(active));
  const label = document.createElement("span");
  label.textContent = `${session.profile} ${session.id}${session.exit !== null ? " · encerrado" : ""}`;
  select.append(
    icon(session.profile === "powershell" ? "terminal" : "robot", 16),
    label,
  );
  select.onclick = () => onSelect(session.id);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "term-tab-close";
  const title = `${session.profile.startsWith(".NET") ? "Fechar terminal e parar API" : "Encerrar terminal"} · ${session.profile} ${session.id}`;
  close.title = title;
  close.setAttribute("aria-label", title);
  close.disabled = Boolean(session.closing || session.closed);
  close.append(icon("close", 14));
  close.onclick = () => Promise.resolve(onClose(session.id)).catch(onError);
  tab.append(select, close);
  return tab;
}

export async function closeTerminalSession({
  state,
  id,
  confirm,
  close,
  refresh,
}) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session || session.closed || session.closing) return false;
  session.closing = true;
  try {
    if (session.exit === null && !(await confirm(session))) return false;
    // A failed close must leave the terminal usable, including its output poll.
    await close(id);
    session.closed = true;
    if (session.resizing) clearTimeout(session.resizing);
    session.resizing = null;
    session.term.dispose();
    session.host.remove();
    state.sessions = state.sessions.filter((s) => s !== session);
    if (state.selectedSession === id)
      state.selectedSession = state.sessions.at(-1)?.id ?? null;
    refresh();
    return true;
  } finally {
    session.closing = false;
  }
}
