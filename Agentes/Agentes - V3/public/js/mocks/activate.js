import { MOCK_ID } from "../mock-context.js";
import { update } from "../store.js";
import { registerLocalAccount, lockLocalAccount } from "../local-auth.js";
import { MOCKS, fixtureFor } from "./fixtures.js";

export async function activateMock() {
  const mock = MOCKS.find(entry => entry.id === MOCK_ID);
  if (!mock) throw new Error("Mock não encontrado. Abra o catálogo para escolher um exemplo.");
  if (mock.variant !== "signup" && mock.variant !== "signedOut") {
    await registerLocalAccount("483927");
    if (mock.variant === "login") lockLocalAccount();
  }
  update(s => { for (const key of Object.keys(s)) delete s[key]; Object.assign(s, fixtureFor(mock)); }, { silent: true });
  history.replaceState(null, "", `${location.pathname}${location.search}#/${mock.path}`);
  document.title = `Mock · ${mock.title} · Aval`;
  // The label remains visible even on legacy screens whose copy implies an integration.
  const label = document.createElement("div");
  label.className = "mock-label";
  label.textContent = "MOCK · dados fictícios · sem dinheiro real";
  label.setAttribute("role", "note");
  document.body.prepend(label);
  document.body.classList.add("mock-preview");
  const style = document.createElement("style");
  style.textContent = ".mock-label{position:fixed;top:0;left:0;right:0;z-index:10000;padding:6px 8px;background:var(--navy);color:white;text-align:center;font-size:11px;line-height:16px}.app-mode .mock-preview #stage{margin-top:28px;height:calc(100dvh - 28px)}.mock-preview #presenter,.mock-preview #dock,.mock-preview .app-demo{display:none}.mock-preview #stage{top:28px;bottom:0}";
  document.head.append(style);
}
