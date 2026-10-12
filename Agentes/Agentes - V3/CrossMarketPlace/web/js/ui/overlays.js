// Modals and toasts. Modal content is plain HTML; buttons use data-action handled in main.js.
import { esc } from "./format.js";

const TOAST_MS = 4200;

export function toast(message, kind = "") {
  const root = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), TOAST_MS);
}

const SAMPLE = `name: Stress Test Bot\nsummary: Gera cenários de estresse com IA a partir das notícias do dia\ncategory: agentes\ntags: [risco, stress-test, genai]\naccess: autorizacao\nlifecycle: piloto\nrepo: git.btg/risco-quant/stress-test-bot`;

const field = (id, label, control, help = "", error = "") => `<div class="field"><label for="${id}">${esc(label)}</label>${control}${error ? `<span class="error" id="${id}-err">${esc(error)}</span>` : help ? `<span class="help">${esc(help)}</span>` : ""}</div>`;
const yesNo = (name, value) => `<div class="yes-no" role="radiogroup">${[["sim", "Sim"], ["nao", "Não"]].map(([v, l]) => `<label class="chip ${value === v ? "on" : ""}"><input class="sr-only" type="radio" name="${name}" value="${v}" ${value === v ? "checked" : ""} data-action="pickRadio">${l}</label>`).join("")}</div>`;

function shell(title, body, actions, sub = "") {
  return `<div class="backdrop" data-action="closeModal" data-self="1"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head"><div><h2 id="modal-title">${esc(title)}</h2>${sub ? `<p class="small muted" style="margin-top:4px">${esc(sub)}</p>` : ""}</div><button type="button" class="close" aria-label="Fechar" data-action="closeModal">×</button></div>
    ${body}<div class="modal-actions">${actions}</div></div></div>`;
}
const cancel = '<button type="button" class="btn secondary" data-action="closeModal">Cancelar</button>';
const submit = (label, action, kind = "primary") => `<button type="button" class="btn ${kind}" data-action="${action}">${esc(label)}</button>`;

const RENDERERS = {
  request: (m, sol) => shell("Pedir acesso", field("m-justification", "Como você vai usar a solução?", `<textarea id="m-justification" class="textarea" aria-describedby="m-justification-err">${esc(m.text ?? "")}</textarea>`, "O responsável decide com base nesta justificativa.", m.error), cancel + submit("Enviar pedido", "submitRequest"), `${sol.name} exige autorização do responsável.`),
  use: (m, sol) => shell("Confirmar uso", `<div class="field"><span class="label">A solução foi útil?</span>${yesNo("m-useful", m.useful ?? "sim")}</div><div class="field"><span class="label">Você usaria de novo?</span>${yesNo("m-reuse", m.reuse ?? "sim")}</div>${field("m-hours", "Quanto tempo você economizou? (horas)", `<input id="m-hours" class="input" type="number" min="0" max="1000" step="0.5" value="${esc(m.hours ?? "2")}">`, "Uma estimativa é suficiente.", m.error)}`, cancel + submit("Confirmar uso", "submitUse"), `Só contamos uso quando você confirma. Abrir o detalhe de ${sol.name} conta apenas como interesse.`),
  rate: (m, sol) => shell("Avaliar solução", `<div class="field"><span class="label">Sua nota</span><div class="stars" role="radiogroup" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${m.stars === n}" aria-label="${n} estrela${n > 1 ? "s" : ""}" class="${n <= (m.stars ?? 0) ? "on" : ""}" data-action="pickStar" data-stars="${n}">★</button>`).join("")}</div>${m.error ? `<span class="error">${esc(m.error)}</span>` : ""}</div>${field("m-comment", "Comentário (opcional)", `<textarea id="m-comment" class="textarea">${esc(m.comment ?? "")}</textarea>`)}`, cancel + submit("Salvar avaliação", "submitRate"), sol.name),
  reject: (m) => shell("Recusar pedido", field("m-note", "Justificativa", `<textarea id="m-note" class="textarea">${esc(m.note ?? "")}</textarea>`, "O solicitante vê este texto.", m.error), cancel + submit("Recusar pedido", "submitReject", "danger")),
  import: (m) => shell("Importar JSON ou YAML", `${field("m-import", "Conteúdo", `<textarea id="m-import" class="textarea mono" style="min-height:180px">${esc(m.text ?? "")}</textarea>`, "Campos: name, summary, category, tags, access, lifecycle, repo, endpoint, version.")}${m.errors ? `<div class="note danger" role="alert"><div>${Object.values(m.errors).map((e) => `<div>${esc(e)}</div>`).join("")}</div></div>` : ""}<button type="button" class="link sm" data-action="importSample">Preencher com um exemplo</button>`, cancel + submit("Importar", "submitImport")),
  version: (m, sol) => shell("Publicar nova versão", `${field("m-version", "Nova versão", `<input id="m-version" class="input mono" value="${esc(m.version ?? "")}" placeholder="v1.2.3">`, `Versão atual: ${sol.version}`, m.error)}${field("m-vnote", "O que mudou", `<textarea id="m-vnote" class="textarea">${esc(m.note ?? "")}</textarea>`)}`, cancel + submit("Publicar versão", "submitVersion")),
  archive: (m, sol) => shell("Arquivar solução", `<p>${esc(sol.name)} vai sair do catálogo. O histórico, as avaliações e os indicadores ficam guardados.</p>`, cancel + submit("Arquivar", "submitArchive", "danger")),
};

export const IMPORT_SAMPLE = SAMPLE;

export function renderModal(modal, state) {
  if (!modal) return "";
  const sol = modal.id ? state.solutions.find((x) => x.id === modal.id) : null;
  return RENDERERS[modal.type]?.(modal, sol ?? {}) ?? "";
}
