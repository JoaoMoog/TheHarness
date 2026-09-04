import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from './paths.mjs';
import { parseFrontmatter, headings } from './frontmatter.mjs';
import { estimateTokens } from './tokens.mjs';
import {
  AGENT_SECTIONS, AGENT_FRONTMATTER, BUDGETS, AGENT_SKILL_RATIO, PLACEHOLDER_MARKERS,
} from './contracts.mjs';

const listFiles = (dir, suffix) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(suffix))
    : [];

const missing = (required, present) => required.filter((r) => !present.includes(r));
const asArray = (v) => (Array.isArray(v) ? v : v === undefined || v === '' ? [] : [v]);

export function loadAgents() {
  const root = harnessPath('core/agents');
  return listFiles(root, '.agent.md').map((entry) => {
    const file = path.join(root, entry.name);
    const text = fs.readFileSync(file, 'utf8');
    const { data, body, hasFrontmatter } = parseFrontmatter(text);
    return {
      id: entry.name.replace('.agent.md', ''),
      file,
      data,
      body,
      hasFrontmatter,
      sections: headings(body),
      subagents: asArray(data.agents).filter((a) => a !== '*'),
      wildcard: asArray(data.agents).includes('*'),
      tools: asArray(data.tools),
      handoffs: parseHandoffs(text),
      userInvocable: data['user-invocable'] !== false,
    };
  });
}

/**
 * Handoff targets are read from the frontmatter list when it parses, and from
 * the "agent:" lines of the block when it does not. The minimal parser cannot
 * represent a list of objects, and rejecting the file over that would be worse
 * than reading the one field the graph check actually needs.
 */
function parseHandoffs(rawText) {
  // The minimal parser cannot represent a list of objects, so the targets are
  // read line by line from the frontmatter block. Line-based on purpose: this
  // function once used a regex that silently matched nothing, and every handoff
  // in the harness went unvalidated for a whole round.
  const lines = String(rawText).split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return [];
  const targets = [];
  let inHandoffs = false;
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break;
    if (/^handoffs:\s*$/.test(line)) { inHandoffs = true; continue; }
    if (inHandoffs && /^\S/.test(line)) inHandoffs = false;
    if (!inHandoffs) continue;
    const m = /^\s*-?\s*agent:\s*([A-Za-z0-9_-]+)/.exec(line);
    if (m) targets.push(m[1]);
  }
  return targets;
}

function skillNames() {
  const root = harnessPath('core/skills');
  return fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
}

/** Skills an agent claims to load, read from its Skills section. */
function claimedSkills(body) {
  const start = body.indexOf('## Skills');
  if (start === -1) return [];
  const rest = body.slice(start + 9);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);
  return [...section.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)].map((m) => m[1]);
}

export function auditAgents(report) {
  const agents = loadAgents();
  const byId = new Map(agents.map((a) => [a.id, a]));
  const skills = new Set(skillNames());

  for (const agent of agents) {
    const label = `agent ${agent.id}`;

    if (!agent.hasFrontmatter) {
      report.fail(`${label}: no frontmatter`);
      continue;
    }

    const missingKeys = missing(AGENT_FRONTMATTER, Object.keys(agent.data));
    if (missingKeys.length > 0) {
      report.fail(`${label}: frontmatter missing ${missingKeys.join(', ')}`);
    }

    const missingSections = missing(AGENT_SECTIONS, agent.sections);
    if (missingSections.length > 0) {
      report.fail(`${label}: missing section(s) ${missingSections.join(', ')}`);
    }

    for (const marker of PLACEHOLDER_MARKERS) {
      if (agent.body.includes(marker) || String(agent.data.description ?? '').includes(marker)) {
        report.fail(`${label}: still contains scaffold placeholder text, so the contract is only formal`);
        break;
      }
    }

    // Delegation graph. These are the checks that make an orchestrator real
    // rather than a paragraph describing one.
    for (const target of agent.subagents) {
      if (!byId.has(target)) {
        report.fail(`${label}: delegates to "${target}", which is not an agent in core/agents`);
      } else if (byId.get(target).data['disable-model-invocation'] === true) {
        report.fail(`${label}: delegates to "${target}", which refuses model invocation`);
      }
    }

    const delegates = agent.subagents.length > 0 || agent.wildcard;
    if (delegates && !agent.tools.includes('agent')) {
      report.fail(`${label}: lists sub-agents but has no "agent" tool, so it cannot invoke them`);
    }
    if (!delegates && agent.tools.includes('agent')) {
      report.warn(`${label}: carries the "agent" tool but delegates to nobody`);
    }

    for (const target of agent.handoffs) {
      if (!byId.has(target)) {
        report.fail(`${label}: hands off to "${target}", which is not an agent in core/agents`);
      }
    }

    for (const skill of claimedSkills(agent.body)) {
      if (!skills.has(skill)) {
        report.fail(`${label}: loads skill "${skill}", which does not exist in core/skills`);
      }
    }
    if (!agent.userInvocable && claimedSkills(agent.body).length === 0) {
      report.fail(`${label}: is an internal phase agent but names no skill, so its procedure lives nowhere`);
    }

    const tokens = estimateTokens(agent.body, agent.file);
    if (tokens > BUDGETS.agentTokens) {
      report.warn(`${label}: ~${tokens} tokens, over the ${BUDGETS.agentTokens} budget; move procedure into a skill`);
    } else if (missingSections.length === 0 && missingKeys.length === 0) {
      report.pass(`${label}: contract satisfied, ~${tokens} tokens`);
    }
  }

  detectCycles(agents, report);
  return agents;
}

/** A delegation cycle is an unbounded loop wearing an org chart. */
function detectCycles(agents, report) {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const state = new Map();

  const visit = (id, trail) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') {
      report.fail(`delegation cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    state.set(id, 'open');
    for (const next of byId.get(id)?.subagents ?? []) {
      if (byId.has(next)) visit(next, [...trail, id]);
    }
    state.set(id, 'done');
  };

  for (const agent of agents) visit(agent.id, []);
}

export function auditRatio(report, agents, skillCount) {
  const invocable = agents.filter((a) => a.userInvocable);
  if (invocable.length === 0) return report.fail('no user-invocable agent, so nobody can start a session');

  const ratio = skillCount / invocable.length;
  const { min, max } = AGENT_SKILL_RATIO;
  const internal = agents.length - invocable.length;
  const text = `${invocable.length} user-invocable agents (+${internal} internal) : ${skillCount} skills (1:${ratio.toFixed(1)})`;

  if (ratio < min) report.fail(`${text} - below 1:${min}; this work belongs in skills`);
  else if (ratio > max) report.warn(`${text} - above 1:${max}; consider another specialist agent`);
  else report.pass(text);
}
