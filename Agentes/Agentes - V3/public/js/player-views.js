// Views of the scenario player: the footer controls, the scenario list, the cover while earlier scenarios run, the
// opening slides, the cards that open (today / with the Aval) and close (the numbers and the sentence to keep) each
// scenario, and the closing slide with the three pillars of the scope.
import { FEATURE_GROUPS } from "./features.js";
import { EXECUTIVE, EXECUTIVE_MIN, SCENARIOS, TRACKS, isPitch, nextInTrack } from "./scenarios.js";
import { PILLARS, SCENARIO_CHIP, SLIDES } from "./slides.js";
import { avalLogo, esc, icon, money } from "./ui.js";

export const SPEEDS = [["devagar", "Devagar", 1.5], ["normal", "Normal", 1], ["rapido", "Rápido", 0.6]];
const MODES = [["manual", "Eu avanço"], ["auto", "Automático"]];
const EXECUTIVE_LABEL = `Versão executiva · ${EXECUTIVE_MIN} min`;
const FULL_LABEL = `Demonstração completa · ${TRACKS.full.length} cenários`;

/** Money that left the vault: by approval, by the 7-day deadline or by a dispute agreement. */
const releasedLine = (d) => [money(d.releasedCents), "liberados para quem prestou"];
/** An offer shown in an earlier scenario may be accepted in this one: then only the accepted count makes sense. */
const offersLine = (d) => [
  d.offersShown >= d.offersAccepted ? `${d.offersAccepted} de ${d.offersShown}` : String(d.offersAccepted),
  d.offersAccepted === 1 ? "oferta do banco aceita" : "ofertas do banco aceitas",
];

/** The numbers of a scenario, as tiles: only what changed. */
const TILES = [
  ["guardedCents", (d) => [money(d.guardedCents), "guardados no BTG"]],
  ["releasedCents", releasedLine],
  ["anticipatedCents", (d) => [money(d.anticipatedCents), "antecipados ao prestador"]],
  ["revenueCents", (d) => [money(d.revenueCents), "de receita para o banco"]],
  ["offersAccepted", offersLine],
  ["accounts", (d) => [String(d.accounts), d.accounts === 1 ? "pessoa nova no Aval" : "pessoas novas no Aval"]],
  ["disputesClosed", (d) => [String(d.disputesClosed), d.disputesClosed === 1 ? "disputa resolvida no app" : "disputas resolvidas no app"]],
  ["payments", (d) => [String(d.payments), d.payments === 1 ? "pagamento com Aval" : "pagamentos com Aval"]],
];
/** The [value, label] of each number that moved. */
export const metricTiles = (d) => TILES.filter(([k]) => d[k] > 0).map(([, f]) => f(d));
const tiles = (d) => `<div class="pv-tiles">${metricTiles(d).map(([v, l]) => `<div class="pv-tile"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join("")}</div>`;
const segment = (items, current, action, key) => items.map(([k, name]) => `<button type="button" class="${current === k ? "on" : ""}" data-action="${action}" data-${key}="${k}" aria-pressed="${current === k}">${name}</button>`).join("");
const pillarOf = (id) => PILLARS.find((pl) => pl.id === id);

/** The button that maximizes the presentation (or restores it); F does the same. */
export function fullButton(cls, withText = false) {
  const full = Boolean(document.fullscreenElement);
  const label = full ? "Sair da tela cheia (F)" : "Tela cheia (F)";
  return `<button type="button" class="${cls}" data-action="toggleFullscreen" aria-label="${label}" title="${label}" aria-pressed="${full}">${icon(full ? "corners-in" : "corners-out")}${withText ? `<span>${full ? "Sair da tela cheia" : "Tela cheia"}</span>` : ""}</button>`;
}

/** The presentation half of the Demo menu: what to present, full screen and how it moves forward. */
export function demoPlay(p) {
  const speed = p.mode === "auto" ? `<div class="p-speed" role="group" aria-label="Velocidade">${segment(SPEEDS, p.speed, "playerSpeed", "speed")}</div>` : "";
  return `<section class="dm-sec"><small>Apresentar</small><button type="button" class="p-primary" data-action="playExecutive">${icon("play")}${EXECUTIVE_LABEL}</button>
      <div class="dm-row"><button type="button" class="dm-btn" data-action="playSlides">${icon("image-square")}<span>Slides</span></button>${fullButton("dm-btn", true)}</div></section>
    <section class="dm-sec"><small>Como avança</small><div class="p-speed" role="group" aria-label="Como avança">${segment(MODES, p.mode, "playerMode", "mode")}</div>${speed}</section>
    <button type="button" class="dm-reset" data-action="resetDemo">${icon("arrows-clockwise")}Reiniciar demo</button>`;
}

/** One row of the scenario list: its number in the track, title and what happens. */
const pickRow = (i, n) => {
  const sc = SCENARIOS[i];
  return `<li><button type="button" data-action="playScenario" data-index="${i}"><span class="p-num">${n + 1}</span><strong>${esc(sc.title)}</strong><small>${esc(sc.intro)}</small><span class="p-watch">${icon("play")}Assistir</span></button></li>`;
};

export function picker() {
  return `<div class="p-modal" role="dialog" aria-modal="true" aria-label="Cenários"><div class="p-box p-box-wide">
    <div class="p-box-head"><h2>Cenários</h2><button type="button" class="p-x" data-action="closeScenarios" aria-label="Fechar">${icon("x")}</button></div>
    <p>Cada parte mostra uma situação real. Balões explicam cada tela e cada passo.</p>
    <div class="p-actions"><button type="button" class="p-all" data-action="playExecutive">${icon("play")}${EXECUTIVE_LABEL}</button><button type="button" class="p-secondary" data-action="playAll">${FULL_LABEL}</button></div>
    <h3 class="p-track">Versão executiva</h3><ul class="p-list">${TRACKS.executive.map(pickRow).join("")}</ul>
    <h3 class="p-track">Demonstração completa</h3><ul class="p-list">${TRACKS.full.map(pickRow).join("")}</ul></div></div>`;
}

export function cover(p) {
  const { index, done, step, total } = p.prep;
  return `<div class="p-modal p-cover" role="status"><div class="p-box"><small class="pv-kicker">Preparando</small><h2>${esc(SCENARIOS[index].title)}</h2>
    <p>Passando por trás: ${esc(SCENARIOS[done].title)}</p>
    <div class="p-bar"><span style="width:${Math.round(((step + 0.5) / Math.max(1, total)) * 100)}%"></span></div>
    <button type="button" class="p-link" data-action="playerStop">Sair</button></div></div>`;
}

/** Opens a scenario: its pillar, then today against the Aval side by side (what is / what could be). */
function opening(p, introMs) {
  const sc = SCENARIOS[p.scenario];
  const track = p.list?.includes(p.scenario) ? p.list : TRACKS[isPitch(p.scenario) ? "executive" : "full"];
  const where = `${isPitch(p.scenario) ? "Parte" : "Cenário"} ${track.indexOf(p.scenario) + 1} de ${track.length}`;
  const timer = p.mode === "auto" ? `<div class="p-bar timer"><span style="animation-duration:${introMs}ms"></span></div>` : "";
  const pillars = sc.pillars.map((id) => `<span class="pv-pillar">${icon(pillarOf(id).icon)}Pilar ${id} · ${esc(pillarOf(id).name)}</span>`).join("");
  // The pitch already told the problem in the slides: its parts open with who, what and how they pay.
  const body = sc.facts
    ? `<ul class="pv-facts">${sc.facts.map(([ic, text]) => `<li>${icon(ic)}<span>${esc(text)}</span></li>`).join("")}</ul>`
    : `<div class="pv-cols"><section class="pv-problem"><small>${icon("warning-circle")}Hoje</small><p>${esc(sc.problem)}</p></section><section class="pv-solution"><small>${icon("shield-check")}Com o Aval</small><p>${esc(sc.solution)}</p></section></div>`;
  return `<div class="p-modal" role="dialog" aria-label="${esc(sc.title)}"><div class="p-box pv-card">
    <small class="pv-kicker">${where}</small><div class="pv-pillars">${pillars}</div><h2>${esc(sc.title)}</h2>
    ${body}
    <p class="pv-intro">${icon("eye")}${esc(sc.intro)}</p>${timer}
    <div class="p-actions"><button type="button" class="p-primary" data-action="playerNext">${icon("play")}Começar</button><button type="button" class="p-link" data-action="playerStop">Sair</button></div></div></div>`;
}

function summary(p) {
  const sc = SCENARIOS[p.scenario];
  const after = nextInTrack(p.scenario);
  const next = after !== null ? `<button type="button" class="p-primary" data-action="playScenario" data-index="${after}">Próximo: ${esc(SCENARIOS[after].title)}${icon("arrow-right")}</button>` : "";
  const actions = p.list ? `<button type="button" class="p-primary" data-action="playerNext">Continuar${icon("arrow-right")}</button>` : `${next}<button type="button" class="p-secondary" data-action="playScenario" data-index="${p.scenario}">Ver de novo</button><button type="button" class="p-link" data-action="playerStop">Fechar</button>`;
  return `<div class="p-modal" role="dialog" aria-label="Resultado do cenário"><div class="p-box pv-card">
    <small class="pv-kicker">${icon("check-circle")}Resultado · ${esc(sc.title)}</small>${tiles(p.summary)}
    <blockquote class="pv-take">${esc(sc.takeaway)}</blockquote>
    <div class="p-actions">${actions}</div></div></div>`;
}

const at = (ms) => `style="--d:${ms}ms"`;
const STEP_MS = 140;
const chip = ([ic, label], d, cls = "") => `<span class="sl-chip ${cls} sl-in" ${at(d)}>${icon(ic)}${esc(label)}</span>`;

/** A real screen of the app in a phone frame. */
const phone = ([file, alt], d) => `<figure class="sl-phone sl-in" ${at(d)}><img src="/img/slides/${esc(file)}" alt="${esc(alt)}"></figure>`;
/** A real product photo (transparent background), like the BTG Pay card machine. */
const photo = ([file, alt], d) => `<figure class="sl-photo sl-in" ${at(d)}><img src="/img/slides/${esc(file)}" alt="${esc(alt)}"></figure>`;
/** What a bank system sends to create a protected payment with milestones. */
const API_SAMPLE = `POST /pagamentos

{
  "valor": 16000,
  "marcos": [60, 40],
  "quem_paga": "Ana",
  "quem_recebe": "Carlos"
}`;
const code = (d) => `<figure class="sl-code sl-in" ${at(d)} aria-label="Exemplo de chamada da API"><pre>${esc(API_SAMPLE)}</pre></figure>`;
const channelVisual = (v, name, d) => (v.shot ? phone([v.shot, `Tela: ${name}`], d) : v.photo ? photo(v.photo, d) : code(d));

/** The cover picture: the Aval at the center like a vault, the three pillars around it, the example floating by. */
function orbit(cards) {
  const pillars = PILLARS.map((pl, i) => `<span class="sl-sat" style="--a:${-90 + i * 120}deg"><span class="sl-sat-in"><span class="sl-ic">${icon(pl.icon)}</span><b>${esc(pl.name)}</b></span></span>`).join("");
  const floats = cards.map(([ic, name, line], i) => `<div class="sl-float f${i + 1}"><span class="sl-ic">${icon(ic)}</span><span><b>${esc(name)}</b><small>${esc(line)}</small></span></div>`).join("");
  return `<figure class="sl-orbit sl-in" ${at(200)} aria-label="O Aval no centro, com os pilares ${esc(PILLARS.map((pl) => pl.name).join(", "))}">
    <svg class="sl-ring" viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="196"></circle></svg>
    <div class="sl-core">${avalLogo({ size: 34, inverse: true })}<b>Aval</b><small>nova forma de pagar</small></div>
    ${pillars}${floats}</figure>`;
}

/** A flowchart read left to right: the steps, the question, and the two ways out (yes on top, no below). */
const fcArrow = () => `<span class="fc-arrow" aria-hidden="true"><i></i>${icon("caret-right")}</span>`;
const fcEnd = ([ic, name, line, tone], label) => `<div class="fc-end ${tone}"><small>${label}</small><span class="sl-ic">${icon(ic)}</span><span><b>${esc(name)}</b><p>${esc(line)}</p></span></div>`;
function flowchart(f) {
  const steps = f.steps.map(([ic, name, line], i) => `${i ? fcArrow() : ""}<div class="fc-node"><span class="sl-ic">${icon(ic)}</span><b>${esc(name)}</b><p>${esc(line)}</p></div>`).join("");
  const loop = f.loop ? `<div class="fc-loop" aria-hidden="true"><span>${icon("arrows-clockwise")}${esc(f.loop)}</span></div>` : "";
  const bar = f.bar ? `<div class="fc-bar"><small>${esc(f.bar.label)}</small><div class="fc-segs">${f.bar.stages.map(([name, share], i) => `<div class="fc-seg ${i === 0 ? "paid" : ""}" style="flex:${share}"><b>Marco ${i + 1} · ${share}%</b><small>${esc(name)}${i === 0 ? " · liberado" : ""}</small></div>`).join("")}</div></div>` : "";
  return `<div class="fc">${steps}${fcArrow()}
    <div class="fc-ask"><span class="fc-diamond" aria-hidden="true"></span><b>${esc(f.ask)}</b>${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</div>
    <svg class="fc-fork" viewBox="0 0 64 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100 H24 V44 H64"></path><path d="M0 100 H24 V156 H64"></path></svg>
    <div class="fc-ends">${fcEnd(f.yes, "Sim")}${fcEnd(f.no, "Não")}</div>${loop}${bar}</div>`;
}

/** The body of each slide: one picture per idea, a few words each, coming in one after the other. */
const SLIDE_BODY = {
  agenda: (sl) => {
    const items = sl.agenda.map(([name, line], i) => `<li class="sl-in" ${at(500 + i * STEP_MS)}><em>${String(i + 1).padStart(2, "0")}</em><span><b>${esc(name)}</b><small>${esc(line)}</small></span></li>`).join("");
    const team = `<div class="sl-team sl-in" ${at(100)}><span class="sl-team-mark" aria-hidden="true">${icon("users-three")}</span><span><small>Apresentado por</small><b>${esc(sl.presenter)}</b></span></div>`;
    return `${team}<div class="sl-cover-main"><p class="sl-lead sl-in" ${at(300)}>${esc(sl.lead)}</p><ol class="sl-agenda-list">${items}</ol></div>${orbit(sl.cards)}`;
  },
  problem: (sl) => `${flowchart(sl.flow)}<p class="sl-note">${esc(sl.note)}</p>`,
  solution: (sl) => {
    const side = ([ic, name, items]) => `<div class="sl-side"><div class="sl-side-head"><span class="sl-ic">${icon(ic)}</span><b>${esc(name)}</b></div><ul>${items.map(([i, text]) => `<li>${icon(i)}<span>${esc(text)}</span></li>`).join("")}</ul></div>`;
    const [, hname, hline] = sl.hub;
    return `<p class="sl-lead">${esc(sl.lead)}</p><div class="sl-sides">${side(sl.sides[0])}<div class="sl-hubmark">${avalLogo({ size: 30, inverse: true })}<b>${esc(hname)}</b><small>${esc(hline)}</small></div>${side(sl.sides[1])}</div>`;
  },
  milestones: (sl) => `<div class="sl-chips">${chip(sl.analogy, 0, "analogy")}</div>${flowchart(sl.flow)}`,
  channels: (sl) => {
    const cols = sl.channels.map(([ic, name, line, visual], i) => `<div class="sl-channel"><div class="sl-visual">${channelVisual(visual, name, 200 + i * 2 * STEP_MS)}</div><div class="sl-cap sl-in" ${at(300 + i * 2 * STEP_MS)}><span class="sl-ic">${icon(ic)}</span><span><b>${esc(name)}</b><p>${esc(line)}</p></span></div><span class="sl-drop" ${at(1300 + i * STEP_MS)}><i></i></span></div>`).join("");
    const [ic, name, line] = sl.hub;
    return `<div class="sl-chan-grid">${cols}</div><div class="sl-hub sl-in" ${at(1800)}><span class="sl-ic big">${icon(ic)}</span><span class="sl-hub-text"><b>${esc(name)}</b><p>${esc(line)}</p></span></div>`;
  },
  revenue: (sl) => `<p class="sl-lead sl-in" ${at(100)}>${esc(sl.lead)}</p>
    <div class="sl-revenue-groups">${sl.groups.map((group, i) => `<section class="sl-revenue-group sl-in" ${at(200 + i * STEP_MS)} aria-labelledby="revenue-group-${i}">
      <header><h2 id="revenue-group-${i}">${esc(group.name)}</h2><span>${esc(group.line)}</span></header>
      <ul>${group.items.map(([ic, name, line]) => `<li><span class="sl-ic">${icon(ic)}</span><span><h3>${esc(name)}</h3><p>${esc(line)}</p></span></li>`).join("")}</ul>
    </section>`).join("")}</div><p class="sl-revenue-note sl-in" ${at(200 + sl.groups.length * STEP_MS)}>${esc(sl.note)}</p>`,
  case: (sl, p) => {
    const person = ([ic, name, role], d) => `<div class="sl-person sl-in" ${at(d)}><span class="sl-ic big">${icon(ic)}</span><b>${esc(name)}</b><p>${esc(role)}</p></div>`;
    const { deal } = sl;
    const stages = deal.stages.map(([name, share], i) => `<span class="sl-chip sl-in" ${at(1500 + i * STEP_MS)}><em>${i + 1}</em>Marco ${i + 1} · ${esc(name)} · ${share}%</span>`).join("");
    const agenda = (p.list ?? EXECUTIVE).map((i, n) => `<span class="sl-chip ghost sl-in" ${at(2000 + n * STEP_MS)}><em>${n + 1}</em>${icon(SCENARIO_CHIP[i][0])}${esc(SCENARIO_CHIP[i][1])}</span>`).join("");
    return `<div class="sl-deal">${person(deal.from, 200)}
      <div class="sl-money sl-in" ${at(600)}><span class="sl-amount">R$ <span class="sl-count" style="--to:${deal.thousands}"></span> mil</span><span class="sl-link long"><i></i></span><small>${icon("calendar-blank")}entrega ${esc(deal.due)}</small></div>
      ${person(deal.to, 400)}</div><div class="sl-chips">${stages}</div><div class="sl-chips"><span class="sl-label sl-in" ${at(1900)}>Na demonstração</span>${agenda}</div>`;
  },
};

/** The frame of every slide in the BTG navy: the logo, the progress (when there is one), the maximize button. */
function frame({ key, title, label, progress = "", body, foot }) {
  return `<section class="slide sl-${key}" role="dialog" aria-label="${esc(label ?? title)}">
    <header class="sl-top"><img src="/img/btg-logo-white.png" alt="BTG Pactual"><div class="sl-tools">${progress}${fullButton("sl-full")}</div></header>
    <div class="sl-body"><h1 class="sl-in">${esc(title)}</h1>${body}</div>
    <footer class="sl-foot">${foot}</footer></section>`;
}

/** The opening slides: the questions as the progress, one short title and its picture. */
function deck(p) {
  const i = p.slide ?? 0;
  const sl = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const steps = SLIDES.map((s, n) => `<button type="button" class="${n === i ? "on" : ""} ${n < i ? "done" : ""}" data-action="slideGo" data-index="${n}" aria-current="${n === i}"><i></i>${esc(s.nav)}</button>`).join("");
  return frame({
    key: sl.key, title: sl.title, progress: `<nav class="sl-progress" aria-label="Slides">${steps}</nav>`, body: SLIDE_BODY[sl.key](sl, p),
    foot: `<button type="button" class="sl-back" data-action="slidePrev" ${i === 0 ? "disabled" : ""} aria-label="Voltar">${icon("arrow-left")}</button>
      ${last ? "" : `<button type="button" class="sl-skip" data-action="slidesSkip">Pular para a demonstração</button>`}
      <button type="button" class="sl-next" data-action="playerNext">${last ? "Ir para a demonstração" : "Próximo"}${icon("arrow-right")}</button>`,
  });
}

/** What each pillar produced in the demonstration (only the numbers that moved). */
const PILLAR_LINES = {
  1: (d) => [[d.guardedCents, money(d.guardedCents), "guardados no BTG"], [d.releasedCents, ...releasedLine(d)], [d.disputesClosed, String(d.disputesClosed), d.disputesClosed === 1 ? "disputa resolvida" : "disputas resolvidas"]],
  2: (d) => [[d.offersAccepted, ...offersLine(d)], [d.anticipatedCents, money(d.anticipatedCents), "antecipados ao prestador"]],
  3: (d) => [[d.revenueCents, money(d.revenueCents), "de receita para o banco"], [d.accounts, String(d.accounts), d.accounts === 1 ? "pessoa nova no Aval" : "pessoas novas no Aval"]],
};

/** The close of a whole presentation: the three pillars of the opening, now checked and with the demo's numbers. */
function closing(p) {
  const d = p.summary ?? {};
  const seen = new Set(p.pillarsSeen ?? []);
  const cols = PILLARS.map((pl, i) => {
    const lines = PILLAR_LINES[pl.id](d).filter(([v]) => v > 0).map(([, v, l]) => `<li><strong>${esc(v)}</strong><span>${esc(l)}</span></li>`).join("");
    return `<div class="sl-result sl-in ${seen.has(pl.id) ? "seen" : ""}" ${at(300 + i * 400)}><span class="sl-ic big">${icon(pl.icon)}</span><span class="sl-check">${icon("check")}</span><b>${esc(pl.name)}</b><ul>${lines}</ul></div>`;
  }).join("");
  const again = p.list === EXECUTIVE ? "playExecutive" : "playAll";
  return frame({
    key: "closing", title: p.list === EXECUTIVE ? "O que você viu no BTG Aval" : `O que você viu em ${p.list?.length ?? 0} cenários`, label: "Encerramento", body: `<div class="sl-results">${cols}</div>`,
    foot: `<button type="button" class="sl-skip" data-action="playerStop">Fechar</button><button type="button" class="sl-next" data-action="${again}">${icon("arrows-clockwise")}Ver de novo</button>`,
  });
}

/** The window over the stage: opening, numbers of a scenario, or the slides that open and close a whole presentation. */
export function card(p, introMs) {
  return { intro: () => opening(p, introMs), summary: () => summary(p), slides: () => deck(p), listEnd: () => closing(p) }[p.card]();
}

/** The footer line while playing: who acts and what happens now (the balloon carries the explanation). */
export function nowLine(p) {
  const c = p.caption;
  if (!c) return "";
  const note = p.stuck ? `<div class="g-line"><p class="p-note">Não consegui seguir sozinho. Clique no destaque e depois em Avançar.</p></div>` : "";
  return `<div class="p-caption" aria-live="polite"><span class="p-who">${esc(c.who)}</span><p class="p-do">${esc(c.do)}</p>${note}</div>`;
}

/** The three pillars in the footer while a presentation plays: each one lights up once a scenario has shown it. */
function pillarsLine(p) {
  if (!p.list) return "";
  const seen = new Set(p.pillarsSeen ?? []);
  const now = new Set(p.card ? [] : SCENARIOS[p.scenario]?.pillars ?? []);
  return `<div class="dock-pillars" aria-label="Pilares do escopo">${PILLARS.map((pl) => `<span class="${seen.has(pl.id) ? "on" : ""} ${now.has(pl.id) ? "now" : ""}" title="Pilar ${pl.id} · ${esc(pl.name)}">${icon(seen.has(pl.id) ? "check-circle" : pl.icon)}${esc(pl.name)}</span>`).join("")}</div>`;
}

export function controls(p) {
  if (!p.on) {
    return `<div class="dock-controls"><button type="button" class="p-play" data-action="playCurrent" aria-label="Apresentar este cenário" title="Apresentar este cenário">${icon("play")}</button></div>`;
  }
  const main = p.mode === "manual"
    ? `<button type="button" class="p-play on" data-action="playerNext" aria-label="Avançar (→)">${icon("arrow-right")}</button><div class="dock-col"><strong class="p-adv">Avançar</strong><small class="p-keys">→, espaço ou passador</small></div>`
    : `<button type="button" class="p-play ${p.paused ? "" : "on"}" data-action="playerToggle" aria-label="${p.paused ? "Continuar" : "Pausar"} (espaço)">${icon(p.paused ? "play" : "pause")}</button><button type="button" class="p-secondary" data-action="playerNext" title="Próximo (→)">${icon("skip-forward")}Próximo</button>`;
  const keys = p.mode === "auto" ? (p.paused ? `<small class="p-keys p-paused">${icon("pause")}Pausado · espaço continua</small>` : `<small class="p-keys">Espaço pausa · → próximo · F tela cheia · Esc sai</small>`) : "";
  // Mode, speed and full screen live in the Demo menu; the bar keeps only moving on and leaving.
  return `<div class="dock-controls">${main}${keys ? `<div class="dock-col">${keys}</div>` : ""}${pillarsLine(p)}
    <button type="button" class="p-x" data-action="playerStop" aria-label="Sair (Esc)" title="Sair (Esc)">${icon("x")}</button></div>`;
}

/**
 * Beside Ana's phone in the opening of the pitch: everything the BTG Aval does, by pillar. The item on screen lights up,
 * the ones already shown stay marked, and each says in which part of the pitch it is shown live.
 */
export function featureMap({ active, seen }) {
  const done = new Set(seen);
  const state = (key) => (active === "all" || active === key ? "on" : done.has(key) || done.has("all") ? "seen" : "");
  const item = ([key, ic, name, part]) => `<li class="${state(key)}">${icon(ic)}<span>${esc(name)}</span>${part ? `<em>parte ${part}</em>` : ""}</li>`;
  const groups = FEATURE_GROUPS.map((g) => `<section class="pf-group"><h3>${icon(g.icon)}${esc(g.name)}</h3><ul>${g.items.map(item).join("")}</ul></section>`).join("");
  return `<aside class="p-features" aria-label="O que o BTG Aval faz"><header><small>O que o BTG Aval faz</small><b>Uma nova forma de pagar serviços</b></header>${groups}</aside>`;
}
