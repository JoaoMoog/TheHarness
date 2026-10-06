// Group icon actions at the right edge; the header stays outside the scroll body.
export function createGitManagerHeader({ el, button, refresh, close }) {
  const header = el("header", "git-manager-header");
  const actions = el("div", "git-manager-actions");
  const update = button("refresh", "Atualizar branches e stashes", refresh);
  const dismiss = button("close", "Fechar branches e stashes", close);
  actions.append(update, dismiss);
  header.append(el("h2", "", "Branches e stashes"), actions);
  return { header, update, dismiss };
}
