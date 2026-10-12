// Publicar solução: 4-step wizard with import, duplicate check and approval checklist.
import { icon } from "../ui/icons.js";
import { esc } from "../ui/format.js";
import { ACCESS, CATEGORIES, LIFECYCLES, categoryOf } from "../domain/constants.js";
import { band, btn, status } from "../ui/components.js";
import { STEPS, similarTo, validate } from "../publishing.js";
import { teamById, userById } from "../seed/people.js";

const err = (d, k) => (d.errors?.[k] ? `<span class="error" id="e-${k}">${esc(d.errors[k])}</span>` : "");
const inv = (d, k) => (d.errors?.[k] ? `class="input invalid" aria-invalid="true" aria-describedby="e-${k}"` : 'class="input"');
const input = (d, k, label, help = "", { mono = false, placeholder = "" } = {}) =>
  `<div class="field"><label for="f-${k}">${label}</label><input id="f-${k}" ${inv(d, k).replace('class="input', `class="input${mono ? " mono" : ""}`)} data-field="${k}" value="${esc(d[k])}" placeholder="${esc(placeholder)}">${err(d, k) || (help ? `<span class="help">${help}</span>` : "")}</div>`;
const area = (d, k, label, help = "") =>
  `<div class="field"><label for="f-${k}">${label}</label><textarea id="f-${k}" class="textarea ${d.errors?.[k] ? "invalid" : ""}" data-field="${k}">${esc(d[k])}</textarea>${err(d, k) || (help ? `<span class="help">${help}</span>` : "")}</div>`;

function step1(d) {
  return `${input(d, "name", "Nome da solução", "Curto e fácil de buscar.", { placeholder: "Ex.: Leitor de Contratos" })}
    ${area(d, "summary", "O que ela faz", "Uma ou duas frases. Aparece nos cards do catálogo.")}
    <div class="field"><span class="label">Tipo de solução</span><div class="row wrap-row" style="gap:8px" role="radiogroup">${CATEGORIES.map((c) => `<button type="button" role="radio" aria-checked="${d.category === c.id}" class="chip ${d.category === c.id ? "on" : ""}" data-action="draftCategory" data-value="${c.id}">${esc(c.type)}</button>`).join("")}</div></div>
    ${area(d, "purpose", "Finalidade e problemas que resolve (opcional)", "Ajuda outras equipes a saber se a solução serve para elas.")}`;
}

function tagsField(d) {
  return `<div class="field"><label for="f-tag">Tags</label><div class="row wrap-row" style="gap:8px;border:1px solid ${d.errors?.tags ? "var(--danger)" : "var(--line)"};border-radius:4px;padding:8px 10px;background:#fff">
    ${d.tags.map((t) => `<button type="button" class="tag" data-action="removeTag" data-tag="${esc(t)}" aria-label="Remover tag ${esc(t)}">#${esc(t)} ×</button>`).join("")}
    <input id="f-tag" data-tag-input="1" style="border:0;outline:0;flex:1;min-width:140px;padding:4px" placeholder="Digite e tecle Enter"></div>${err(d, "tags") || '<span class="help">Ex.: risco, genai, python</span>'}</div>`;
}

function step2(d) {
  return `<div class="grid-2"><div class="field"><label for="f-lifecycle">Ciclo de vida</label><select id="f-lifecycle" class="select" data-field="lifecycle" data-rerender="1">${Object.entries(LIFECYCLES).map(([k, l]) => `<option value="${k}" ${d.lifecycle === k ? "selected" : ""}>${l}</option>`).join("")}</select><span class="help">Experimental, Piloto, Produção ou Descontinuada</span></div>
    ${input(d, "version", "Versão", "Versionamento semântico", { mono: true })}</div>
    <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:6px">Como as pessoas acessam</legend><div class="grid-2">
      ${[["direto", "Qualquer colaborador acessa sem pedir autorização.", "unlock"], ["autorizacao", "O responsável aprova cada pedido, com justificativa.", "lock"]].map(([k, t, ic]) => `<label class="radio-card"><input type="radio" name="access" value="${k}" data-field="access" data-rerender="1" ${d.access === k ? "checked" : ""}><span><strong class="row" style="gap:6px">${icon(ic, { size: 16 })}${ACCESS[k]}</strong><small>${t}</small></span></label>`).join("")}</div></fieldset>
    ${input(d, "repo", "Repositório", "Link do código-fonte ou do projeto", { mono: true, placeholder: "git.btg/equipe/projeto" })}
    ${input(d, "endpoint", "Endpoint ou aplicação", "Onde a solução roda: URL de aplicação, API ou notebook", { mono: true })}
    ${tagsField(d)}
    <div class="grid-2"><div class="field"><span class="label">Equipe</span><div class="input" style="background:var(--canvas)">${esc(teamById(d.teamId).name)}</div></div><div class="field"><span class="label">Responsável</span><div class="input" style="background:var(--canvas)">${esc(userById(d.ownerId).name)}</div></div></div>
    ${input(d, "contacts", "Contatos", "Aparece no detalhe para quem quiser tirar dúvidas")}`;
}

function step3(d) {
  return `<div class="field"><span class="label">Documentos e materiais</span>
      ${d.docs.map((f) => `<div class="row" style="border:1px solid var(--line);border-radius:4px;padding:10px 12px">${icon("file", { size: 18 })}<span class="grow">${esc(f.name)}</span><span class="small muted">${esc(f.size)}</span><button type="button" class="link sm" data-action="removeDoc" data-name="${esc(f.name)}" style="color:var(--danger)">Remover</button></div>`).join("")}
      <div class="row"><label class="sr-only" for="f-doc">Nome do arquivo</label><input id="f-doc" class="input ${d.errors?.docs ? "invalid" : ""}" placeholder="manual-de-uso.pdf"><button type="button" class="btn secondary" data-action="addDoc">${icon("upload", { size: 18 })}Anexar</button></div>
      ${err(d, "docs") || '<span class="help">Simulação: informe o nome do arquivo. Manual de uso, arquitetura, exemplos.</span>'}</div>
    ${area(d, "howTo", "Como usar (um passo por linha)", "Aparece na aba Documentação e uso do detalhe.")}`;
}

function step4(d) {
  const kv = (k, v) => `<dl class="kv"><dt>${k}</dt><dd>${v}</dd></dl>`;
  return `<p style="color:var(--text-2)">Confira antes de enviar. Depois do envio, a publicação fica em análise e só entra no catálogo quando for aprovada.</p>
    <div>${kv("Nome", esc(d.name))}${kv("Descrição", esc(d.summary))}${kv("Tipo", esc(categoryOf(d.category).type))}${kv("Ciclo de vida e acesso", `${esc(LIFECYCLES[d.lifecycle])} · ${esc(ACCESS[d.access])}`)}${kv("Versão", `<span class="mono">${esc(d.version)}</span>`)}${kv("Repositório", `<span class="mono">${esc(d.repo || "—")}</span>`)}${kv("Endpoint", `<span class="mono">${esc(d.endpoint || "—")}</span>`)}${kv("Tags", d.tags.map((t) => `#${esc(t)}`).join("  ") || "—")}${kv("Documentos", d.docs.map((f) => esc(f.name)).join(", ") || "—")}</div>
    ${d.errors?.diffNote ? `<div class="note danger" role="alert">${icon("eye")}<span>${esc(d.errors.diffNote)}</span></div>` : ""}`;
}

function similarPanel(d) {
  if (d.name.trim().length < 3 && d.summary.trim().length < 10) return `<section class="panel">${icon("eye")}<p class="small muted">Assim que você preencher nome e descrição, mostramos soluções parecidas para evitar trabalho duplicado.</p></section>`;
  const list = similarTo(d);
  if (!list.length) return `<section class="panel"><div class="note ok">${icon("check")}<span>Nenhuma solução parecida encontrada no catálogo.</span></div></section>`;
  return `<section class="panel" style="background:var(--warning-soft);border-color:var(--warning)">
    <h2 class="row" style="color:var(--warning);font-size:16px;font-weight:500">${icon("eye")}Encontramos ${list.length} ${list.length === 1 ? "solução parecida" : "soluções parecidas"}</h2>
    <p class="small">Antes de publicar, veja se alguma já resolve o seu problema. Assim evitamos trabalho duplicado.</p>
    ${list.map(({ solution: x, score }) => `<div class="row" style="background:#fff;border-radius:4px;padding:12px 14px"><div class="grow"><strong style="font-weight:500;display:block">${esc(x.name)}</strong><span class="small muted">${esc(categoryOf(x.category).type)} · ${esc(teamById(x.teamId).name)}${x.archived ? " · arquivada" : ""}</span></div><span class="status em_analise">${Math.round(score * 100)}% parecida</span><button type="button" class="link sm" data-go="#/solucao/${esc(x.id)}">Ver</button></div>`).join("")}
    <label class="check"><input type="checkbox" data-field="isDifferent" data-rerender="1" ${d.isDifferent ? "checked" : ""}>Minha solução é diferente</label>
    ${d.isDifferent ? `<textarea class="textarea ${d.errors?.diffNote ? "invalid" : ""}" data-field="diffNote" aria-label="Explique a diferença para o aprovador" placeholder="Explique a diferença para o aprovador">${esc(d.diffNote)}</textarea>` : ""}
  </section>`;
}

function checklist(d) {
  const items = [["Nome, descrição e tipo", 1], ["Detalhes técnicos e acesso", 2], ["Documentação e materiais", 3], ["Comparação com soluções parecidas", 4]];
  return `<section class="panel"><div><h2>Checklist para aprovação</h2><p class="small muted">O aprovador vê esta lista</p></div>
    ${items.map(([t, step]) => { const ok = !Object.keys(validate(d, step)).some((k) => (step === 1 ? ["name", "summary"] : step === 2 ? ["version", "repo", "tags", "contacts"] : step === 3 ? ["docs"] : ["diffNote"]).includes(k)); const now = d.step === step; return `<div class="row"><span style="color:var(--${ok ? "success" : now ? "primary" : "text-3"})">${icon(ok ? "check" : now ? "clock" : "check")}</span><span class="grow" style="color:var(--${ok || now ? "text" : "text-3"})">${t}</span>${now && !ok ? '<span class="small" style="color:var(--primary)">em andamento</span>' : ""}</div>`; }).join("")}
    <p class="small muted" style="border-top:1px solid var(--line);padding-top:14px">Depois do envio, você acompanha o andamento em Minha área.</p></section>`;
}

export function renderPublish(s) {
  const d = s.draft;
  const sol = d.id ? s.solutions.find((x) => x.id === d.id) : null;
  const title = sol ? (sol.approval === "correcao" ? `Corrigir: ${sol.name}` : `Editar: ${sol.name}`) : "Publicar solução";
  const stepper = `<div class="stepper" role="list">${STEPS.map((l, i) => { const n = i + 1; const st = n < d.step ? "done" : n === d.step ? "now" : "next"; return `${i ? `<span class="ln ${n <= d.step ? "done" : ""}"></span>` : ""}<button type="button" role="listitem" class="st ${st}" data-action="goStep" data-step="${n}" ${st === "now" ? 'aria-current="step"' : ""}><i>${st === "done" ? "✓" : n}</i>${l}</button>`; }).join("")}</div>`;
  const correction = sol?.approval === "correcao" ? (sol.history ?? []).filter((h) => h.to === "correcao").at(-1) : null;
  const body = [step1, step2, step3, step4][d.step - 1](d);
  const isLast = d.step === STEPS.length;
  return {
    band: band({ crumb: [["Início", "#/inicio"], [title, ""]], title, sub: "Preencha as informações, salve como rascunho e envie para aprovação.", right: btn("Importar JSON ou YAML", { kind: "ghost-white", action: "startImport" }), tabs: `<div style="padding-bottom:36px">${stepper}</div>` }),
    body: `${correction ? `<div class="note warn">${icon("edit")}<div><strong>Correção solicitada por ${esc(userById(correction.by).name)}</strong><div>“${esc(correction.note)}”</div></div></div>` : ""}
      <div class="split"><form class="panel" data-submit="noop" novalidate style="gap:22px">
        <div class="row between"><div><h2>${d.step}. ${STEPS[d.step - 1]}</h2><p class="small muted">Etapa ${d.step} de ${STEPS.length}</p></div>${status(sol?.approval ?? "rascunho")}</div>
        <hr style="border:0;border-top:1px solid var(--line);margin:0">${body}
        <hr style="border:0;border-top:1px solid var(--line);margin:0">
        <div class="row wrap-row">${d.step > 1 ? btn("Voltar", { kind: "secondary", action: "goStep", data: { step: d.step - 1 } }) : btn("Descartar", { kind: "secondary", action: "discardDraft" })}<span class="grow"></span>
          ${d.savedAt ? `<span class="small muted row" style="gap:6px">${icon("clock", { size: 16 })}Rascunho salvo às ${esc(d.savedAt)}</span>` : ""}
          ${btn("Salvar rascunho", { kind: "secondary", action: "saveDraft" })}${isLast ? btn("Enviar para aprovação", { action: "submitDraft" }) : btn("Continuar", { action: "goStep", data: { step: d.step + 1 } })}</div>
      </form><aside class="stack" style="gap:24px">${similarPanel(d)}${checklist(d)}</aside></div>`,
  };
}
