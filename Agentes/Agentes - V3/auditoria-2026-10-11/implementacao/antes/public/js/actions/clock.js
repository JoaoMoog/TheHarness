// Demo clock: moving time forward runs the contract rules in code (tacit approval, collections, credit analysis, dispute SLA).
import { daysBetween, fmtDate, parseDdMm, shiftDate } from "../domain/dates.js";
import { peopleOf, addDays, addLedger, contractById, notify, notifyBank, notifyClient, notifyProvider, now, personOfName, today, update } from "../store.js";
import { money } from "../ui.js";
import { actions as A, ok } from "./core.js";
import { decideCredit } from "./credit.js";
import { releaseStage } from "./delivery.js";
import { reminderFor } from "../domain/protected.js";

const LATE_FEE_RATE = 0.003;
const REMINDER_DAYS = 3;
const TACIT_MODE = "Liberado sozinho (7 dias sem resposta)";
const isPast = (ddmm, s) => parseDdMm(ddmm).getTime() < now(s).getTime();
const isReached = (ddmm, s) => parseDdMm(ddmm).getTime() <= now(s).getTime();

/** Reminds whoever pays 2 days and 1 day before a delivered stage is released by itself. */
function releaseReminders(s, events) {
  for (const c of s.contracts) {
    c.stages.forEach((st, i) => {
      if (st.status !== "awaitingApproval" || !st.delivery) return;
      const r = reminderFor(st.delivery.deadline, now(s));
      if (!r || (st.reminded ?? []).includes(r.daysLeft)) return;
      st.reminded = [...(st.reminded ?? []), r.daysLeft];
      const when = r.daysLeft === 1 ? "amanhã" : `em ${r.daysLeft} dias`;
      notifyClient(s, c, `${c.stages.length > 1 ? `Marco ${i + 1}` : "O serviço"} libera sozinho ${when}`, `Aprove ou peça ajuste · ${c.title}`, "clock", `#/servico/${c.id}`);
      events.push(`Lembrete: ${c.title} libera sozinho ${when}`);
    });
  }
}

function tacitApprovals(s, events) {
  for (const c of s.contracts) {
    c.stages.forEach((st, i) => {
      if (st.status !== "awaitingApproval" || !st.delivery || !isReached(st.delivery.deadline, s)) return;
      releaseStage(s, contractById(s, c.id), i, TACIT_MODE);
      events.push(`Marco ${i + 1} de ${c.title} liberado por confirmação tácita`);
    });
  }
}

/** Collections ladder: reminder three days before, late fee and paused credit after the due date. */
function collections(s, events) {
  for (const inst of s.installments.filter((i) => i.status === "open")) {
    const owner = peopleOf(s)[inst.owner]?.clientName ?? "";
    const left = daysBetween(now(s), parseDdMm(inst.due));
    if (left === REMINDER_DAYS) {
      notify(s, owner, `Parcela ${inst.n} vence em ${REMINDER_DAYS} dias`, `${money(inst.valueCents)} · ative o Pix Automático`, "clock", "#/financeiro", "contratante");
      events.push(`Lembrete da parcela ${inst.n} enviado`);
    }
    const acc = s.accounts[inst.owner];
    if (left <= 0 && acc?.pixAuto && acc.balanceCents >= inst.valueCents) {
      acc.balanceCents -= inst.valueCents;
      inst.status = "paid";
      addLedger(s, inst.contractId, `Parcela ${inst.n} de ${inst.of} · Pix Automático`, inst.valueCents);
      events.push(`Parcela ${inst.n} paga por Pix Automático`);
      continue;
    }
    if (left < 0) {
      Object.assign(inst, { status: "late", lateFeeCents: Math.round(inst.valueCents * LATE_FEE_RATE) });
      notify(s, owner, `Parcela ${inst.n} atrasada`, "Crédito pausado até o pagamento", "warning-circle", "#/financeiro", "contratante");
      events.push(`Parcela ${inst.n} venceu e o crédito foi pausado`);
    }
  }
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const VISIT_APPROVAL_DAYS = 3;
const MONTH_DAYS = 30;

/** Recurring services: on the visit date Pix Automático funds the month, the visit goes to approval and the next month is scheduled. */
function recurringCycle(s, events) {
  for (const c of s.contracts.filter((x) => x.kind === "recurring" && x.status === "active")) {
    const idx = c.stages.findIndex((st) => st.status === "pending" && isReached(st.due, s));
    if (idx < 0) continue;
    const st = c.stages[idx];
    const owner = personOfName(c.client);
    if (owner) s.accounts[owner.id].balanceCents -= c.monthlyCents;
    c.paidInCents += c.monthlyCents;
    addLedger(s, c.id, `Pix Automático · ${c.client}`, c.monthlyCents);
    Object.assign(st, {
      status: "awaitingApproval",
      delivery: { description: `${st.name}: serviço do mês feito conforme o combinado.`, sentAt: today(), deadline: addDays(VISIT_APPROVAL_DAYS), attachments: [{ kind: "photo", caption: "Serviço do mês" }] },
    });
    const next = shiftDate(parseDdMm(st.due), MONTH_DAYS);
    c.stages.push({ ...st, name: `Mês de ${MONTHS[next.getMonth()]}`, due: fmtDate(next), status: "pending", delivery: null, releasedAt: null, releaseMode: null, coverage: null });
    c.totalCents += c.monthlyCents;
    notifyClient(s, c, `${c.title}: serviço do mês feito`, `Pix Automático de ${money(c.monthlyCents)} guardado. Aprove em 3 dias.`, "calendar-blank", `#/servico/${c.id}`);
    notifyProvider(s, c, "Mensalidade guardado", c.title, "lock-simple", `#/servico/${c.id}`);
    events.push(`${st.name}: Pix Automático e serviço do mês para aprovar`);
  }
}

function creditAnalyses(s, events) {
  for (const req of s.creditRequests.filter((r) => r.status === "analysis" && isReached(r.readyAt, s))) {
    decideCredit(s, req);
    events.push(`Análise de crédito ${req.id} concluída`);
  }
}

function disputeSla(s, events) {
  for (const d of s.disputes.filter((x) => x.status === "mediation" && !x.slaBreached && isPast(x.deadline, s))) {
    d.slaBreached = true;
    d.history.push(["Prazo da mediação vencido", `${today()} · caso priorizado no BTG`, "now"]);
    notifyBank(s, "SLA de disputa vencido", d.id, "scales", `#/banco/fila/${d.id}`);
    events.push(`Disputa ${d.id} passou do prazo e subiu de prioridade`);
  }
}

const LOG_SIZE = 30;

A.advanceClock = ({ days }) => {
  const events = [];
  for (let day = 0; day < Number(days); day += 1) {
    update((s) => { s.clock.offsetDays += 1; }, { silent: true });
    const todays = [];
    update((s) => {
      recurringCycle(s, todays);
      releaseReminders(s, todays);
      tacitApprovals(s, todays);
      collections(s, todays);
      creditAnalyses(s, todays);
      disputeSla(s, todays);
    }, { silent: true });
    events.push(...todays.map((text) => ({ at: today(), text })));
  }
  update((s) => { s.clock.log = [...[...events].reverse(), ...s.clock.log].slice(0, LOG_SIZE); });
  ok(events.length ? `Hoje é ${today()}. ${events.length} evento(s): ${events[0].text}${events.length > 1 ? " e mais" : ""}.` : `Hoje é ${today()}. Nenhum prazo venceu.`);
};
