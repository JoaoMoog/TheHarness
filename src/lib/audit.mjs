import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from './paths.mjs';
import { parseFrontmatter, headings } from './frontmatter.mjs';
import { estimateTokens } from './tokens.mjs';
import { auditAgents, auditRatio } from './audit-graph.mjs';
import {
  SKILL_SECTIONS, SKILL_FRONTMATTER, INSTRUCTION_FRONTMATTER, PROMPT_FRONTMATTER,
  SFA_KEYS, BUDGETS, REQUIRED_INSTRUCTIONS, LOOP_REQUIRED_KEYS, MCP_SERVER_FIELDS,
  SESSION_PHASES, SESSION_TRACKS, MANDATORY_PHASE,
  RUBRIC_SECTIONS, RUBRIC_FRONTMATTER, RUBRIC_REQUIRED_PHASES,
  PLACEHOLDER_MARKERS,
} from './contracts.mjs';

const listDir = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []);
const missing = (required, present) => required.filter((r) => !present.includes(r));
const hasPlaceholder = (text) => PLACEHOLDER_MARKERS.some((m) => text.includes(m));

export function auditHotTier(report) {
  const file = harnessPath('core/copilot-instructions.md');
  if (!fs.existsSync(file)) return report.fail('core/copilot-instructions.md is missing');
  const bytes = fs.statSync(file).size;
  if (bytes >= BUDGETS.hotTierBytes) {
    report.fail(`hot tier is ${bytes} bytes, over the ${BUDGETS.hotTierBytes} byte budget`);
  } else {
    report.pass(`hot tier ${bytes}/${BUDGETS.hotTierBytes} bytes`);
  }
}

/**
 * Everything with applyTo of two stars is loaded whenever the agent touches any
 * file, so it bills like the hot tier even though it is filed as warm.
 * Measuring only copilot-instructions.md understated the real per-turn cost
 * several times over.
 */
export function effectiveHotTokens() {
  const hot = harnessPath('core/copilot-instructions.md');
  let total = fs.existsSync(hot) ? estimateTokens(fs.readFileSync(hot, 'utf8'), 'hot.md') : 0;
  const root = harnessPath('core/instructions');
  const always = [];
  for (const entry of listDir(root)) {
    if (!entry.isFile() || !entry.name.endsWith('.instructions.md')) continue;
    const file = path.join(root, entry.name);
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const applyTo = String(data.applyTo ?? '').trim().replace(/["']/g, '');
    if (applyTo !== '**') continue;
    always.push(entry.name);
    total += estimateTokens(body, file);
  }
  return { tokens: total, files: always };
}

export function auditEffectiveHot(report) {
  const { tokens, files } = effectiveHotTokens();
  const count = files.length + 1;
  if (tokens > BUDGETS.effectiveHotTokens) {
    report.fail(
      `effective hot tier is about ${tokens} tokens across ${count} always-loaded files, over the ${BUDGETS.effectiveHotTokens} budget`
    );
  } else {
    report.pass(`effective hot tier about ${tokens} of ${BUDGETS.effectiveHotTokens} tokens across ${count} files`);
  }
}

export function auditSkills(report) {
  const root = harnessPath('core/skills');
  const dirs = listDir(root).filter((e) => e.isDirectory());
  if (dirs.length === 0) report.warn('no skills defined');

  for (const dir of dirs) {
    const file = path.join(root, dir.name, 'SKILL.md');
    const label = `skill ${dir.name}`;
    if (!fs.existsSync(file)) {
      report.fail(`${label}: SKILL.md missing`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const { data, body, hasFrontmatter } = parseFrontmatter(text);

    if (!hasFrontmatter) {
      report.fail(`${label}: no frontmatter`);
      continue;
    }

    const missingKeys = missing(SKILL_FRONTMATTER, Object.keys(data));
    if (missingKeys.length > 0) report.fail(`${label}: frontmatter missing ${missingKeys.join(', ')}`);

    const sfa = String(data.sfa ?? '');
    const missingSfa = SFA_KEYS.filter((k) => !sfa.includes(k));
    if (data.sfa && missingSfa.length > 0) report.fail(`${label}: sfa must state ${SFA_KEYS.join(', ')}`);

    const missingSections = missing(SKILL_SECTIONS, headings(body));
    if (missingSections.length > 0) report.fail(`${label}: missing section(s) ${missingSections.join(', ')}`);

    if (hasPlaceholder(text)) {
      report.fail(`${label}: still contains scaffold placeholder text, so the contract is only formal`);
    }

    if (data.alwaysApply === true && !data.justification) {
      report.fail(`${label}: alwaysApply true without a justification field; it bills every turn`);
    }

    const tokens = estimateTokens(body, file);
    if (tokens > BUDGETS.skillBodyTokens) {
      report.warn(`${label}: about ${tokens} tokens, over the ${BUDGETS.skillBodyTokens} budget; split it or move detail into references`);
    } else if (missingSections.length === 0 && missingKeys.length === 0 && !hasPlaceholder(text)) {
      report.pass(`${label}: about ${tokens} tokens, contract satisfied`);
    }
  }
  return dirs.length;
}

export function auditInstructions(report) {
  const root = harnessPath('core/instructions');
  const files = listDir(root).filter((e) => e.isFile() && e.name.endsWith('.instructions.md'));
  const names = files.map((f) => f.name.replace('.instructions.md', ''));

  for (const name of REQUIRED_INSTRUCTIONS) {
    if (names.includes(name)) report.pass(`instruction ${name} present`);
    else report.fail(`instruction ${name} missing - this is the coverage gap most repositories have`);
  }

  for (const entry of files) {
    const file = path.join(root, entry.name);
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const missingKeys = missing(INSTRUCTION_FRONTMATTER, Object.keys(data));
    if (missingKeys.length > 0) {
      report.fail(`instruction ${entry.name}: frontmatter missing ${missingKeys.join(', ')}`);
    }
    const tokens = estimateTokens(body, file);
    if (tokens > BUDGETS.instructionTokens) {
      report.warn(`instruction ${entry.name}: about ${tokens} tokens, over the ${BUDGETS.instructionTokens} budget`);
    }
  }
  return files.length;
}

export function auditPrompts(report) {
  const root = harnessPath('core/prompts');
  const files = listDir(root).filter((e) => e.isFile() && e.name.endsWith('.prompt.md'));
  for (const entry of files) {
    const file = path.join(root, entry.name);
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const missingKeys = missing(PROMPT_FRONTMATTER, Object.keys(data));
    if (missingKeys.length > 0) {
      report.fail(`prompt ${entry.name}: frontmatter missing ${missingKeys.join(', ')}`);
    }
    const tokens = estimateTokens(body, file);
    if (tokens > BUDGETS.promptTokens) {
      report.warn(`prompt ${entry.name}: about ${tokens} tokens, over the ${BUDGETS.promptTokens} budget`);
    }
  }
  return files.length;
}

export function auditLoops(report) {
  const file = harnessPath('loops/budgets.json');
  if (!fs.existsSync(file)) return report.fail('loops/budgets.json is missing, so loops would be unbounded');
  const budgets = JSON.parse(fs.readFileSync(file, 'utf8'));
  const loops = Object.entries(budgets.loops ?? {});
  if (loops.length === 0) return report.warn('no loops defined');

  for (const [name, cfg] of loops) {
    const missingKeys = missing(LOOP_REQUIRED_KEYS, Object.keys(cfg));
    if (missingKeys.length > 0) {
      report.fail(`loop ${name}: missing ${missingKeys.join(', ')} - an unbounded loop violates a hard constraint`);
    } else if (!fs.existsSync(harnessPath('loops', `${name}.md`))) {
      report.fail(`loop ${name}: budget declared but loops/${name}.md does not exist`);
    } else if (cfg.maxIterations > 1 && !cfg.escalateWhen) {
      report.warn(`loop ${name}: no escalateWhen, so a stuck loop only stops at the cap`);
    } else {
      report.pass(`loop ${name}: max ${cfg.maxIterations} iterations, ${cfg.tokenBudget} token budget`);
    }
  }
}

/**
 * MCP servers are the widest blast radius in the configuration: an enabled
 * server is a tool an agent can reach. Nothing reaches an agent unvetted.
 */
export function auditMcp(report) {
  const file = harnessPath('core/mcp.json');
  if (!fs.existsSync(file)) return report.warn('core/mcp.json is missing');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const servers = Object.entries(config.servers ?? {});

  if (servers.length === 0) return report.pass('no MCP server is enabled');

  for (const [name, server] of servers) {
    const missingKeys = missing(MCP_SERVER_FIELDS, Object.keys(server));
    if (missingKeys.length > 0) {
      report.fail(`mcp ${name}: enabled without ${missingKeys.join(', ')}; nothing reaches an agent unvetted`);
    }
    const values = JSON.stringify(server.env ?? {}).match(/[A-Za-z0-9_-]{20,}/g) ?? [];
    const literal = values.filter((v) => !v.includes('env:') && !v.includes('input:'));
    if (literal.length > 0) {
      report.fail(`mcp ${name}: a credential looks inlined; read it from the environment instead`);
    }
    if (missingKeys.length === 0 && literal.length === 0) {
      report.pass(`mcp ${name}: owner ${server.owner}, scope ${server.scope}`);
    }
  }
}

/**
 * A track is only allowed to omit phases, never to reorder them or invent one.
 * Without this check a track could quietly drop review, which is the phase the
 * whole model rests on.
 */
const readJsonOrNull = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

export function auditTracks(report) {
  const budgets = readJsonOrNull(harnessPath('loops/budgets.json'));
  const declared = budgets?.loops?.session?.tracks ?? {};

  for (const [name, track] of Object.entries(SESSION_TRACKS)) {
    const indexes = track.phases.map((p) => SESSION_PHASES.indexOf(p));

    const unknown = track.phases.filter((p) => !SESSION_PHASES.includes(p));
    if (unknown.length > 0) {
      report.fail(`track ${name}: unknown phase ${unknown.join(", ")}`);
      continue;
    }
    if (!indexes.every((v, i) => i === 0 || v > indexes[i - 1])) {
      report.fail(`track ${name}: phases are out of order, a track may only omit`);
      continue;
    }
    if (track.phases.length === 0) {
      report.fail(`track ${name}: has no phases`);
      continue;
    }
    if (track.phases.includes('deliver') && !track.phases.includes(MANDATORY_PHASE)) {
      report.fail(`track ${name}: delivers without ${MANDATORY_PHASE}, nothing ships unreviewed`);
      continue;
    }
    if (track.promoteTo !== null && !SESSION_TRACKS[track.promoteTo]) {
      report.fail(`track ${name}: promotes to ${track.promoteTo}, which is not a track`);
      continue;
    }
    if (!declared[name]) {
      report.fail(`track ${name}: no token budget in loops/budgets.json`);
      continue;
    }
    if (track.requiresArtifact) {
      const template = harnessPath(`templates/${track.requiresArtifact}.md`);
      if (!fs.existsSync(template)) {
        report.fail(`track ${name}: requires a ${track.requiresArtifact}, but templates/${track.requiresArtifact}.md does not exist`);
        continue;
      }
    }
    report.pass(`track ${name}: ${track.phases.length} phases, ${declared[name].tokenBudget} tokens`);
  }
}

/**
 * Rubrics are checked like every other authored artifact. A rubric without a
 * threshold is a scoring exercise with no decision attached to it.
 */
export function auditRubrics(report) {
  const root = harnessPath('core/rubrics');
  const files = listDir(root).filter((e) => e.isFile() && e.name.endsWith('.rubric.md'));
  const covered = new Set();

  for (const entry of files) {
    const label = `rubric ${entry.name.replace(/[.]rubric[.]md$/, "")}`;
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(root, entry.name), 'utf8'));

    const missingKeys = missing(RUBRIC_FRONTMATTER, Object.keys(data));
    if (missingKeys.length > 0) {
      report.fail(`${label}: frontmatter missing ${missingKeys.join(", ")}`);
      continue;
    }
    const missingSections = missing(RUBRIC_SECTIONS, headings(body));
    if (missingSections.length > 0) {
      report.fail(`${label}: missing section(s) ${missingSections.join(", ")}`);
      continue;
    }
    const threshold = Number(data.threshold);
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 5) {
      report.fail(`${label}: threshold must be an integer from 1 to 5, got ${data.threshold}`);
      continue;
    }
    if (!SESSION_PHASES.includes(String(data.appliesTo))) {
      report.fail(`${label}: appliesTo "${data.appliesTo}" is not a phase`);
      continue;
    }
    covered.add(String(data.appliesTo));
    report.pass(`${label}: scores ${data.appliesTo}, threshold ${threshold}`);
  }

  for (const phase of RUBRIC_REQUIRED_PHASES) {
    if (!covered.has(phase)) {
      report.fail(`phase ${phase} produces a judgement but no rubric scores it`);
    }
  }
}

/**
 * Reach checks. Round 3 added tracks, rubrics and skills that nothing consumed,
 * and every form check passed because the artifacts were well formed. These
 * verify the other direction: that what exists is reachable from the agents.
 */
function agentBodies() {
  const root = harnessPath('core/agents');
  return listDir(root)
    .filter((e) => e.isFile() && e.name.endsWith('.agent.md'))
    .map((e) => ({ id: e.name.replace('.agent.md', ''), text: fs.readFileSync(path.join(root, e.name), 'utf8') }));
}

export function auditReach(report) {
  const agents = agentBodies();
  const allAgentText = agents.map((a) => a.text).join('\n');

  // Every skill that is not stack-scoped must be named by some agent.
  const skillsRoot = harnessPath('core/skills');
  for (const dir of listDir(skillsRoot).filter((e) => e.isDirectory())) {
    const file = path.join(skillsRoot, dir.name, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const { data } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const stackScoped = Array.isArray(data.stacks) && data.stacks.length > 0;
    if (stackScoped) continue;
    if (!allAgentText.includes('`' + dir.name + '`')) {
      report.fail(`skill ${dir.name}: no agent names it, so nothing in a session can reach it`);
    }
  }

  // Every rubric must be scored by an agent that carries rubric-review.
  const judges = agents.filter((a) => a.text.includes('`rubric-review`'));
  if (judges.length === 0) {
    report.fail('no agent carries rubric-review, so no rubric can be applied');
  } else {
    const judgeText = judges.map((a) => a.text).join('\n');
    const rubricsRoot = harnessPath('core/rubrics');
    for (const entry of listDir(rubricsRoot).filter((e) => e.isFile() && e.name.endsWith('.rubric.md'))) {
      const name = entry.name.replace(/[.]rubric[.]md$/, '');
      if (!judgeText.includes('`' + name + '`')) {
        report.fail(`rubric ${name}: no judging agent names it, so nothing scores against it`);
      }
    }
  }

  // Every track must be known to the agent that chooses tracks and the skill that owns the choice.
  const chooser = agents.find((a) => a.id === 'orchestrator')?.text ?? '';
  const selection = fs.existsSync(harnessPath('core/skills/track-selection/SKILL.md'))
    ? fs.readFileSync(harnessPath('core/skills/track-selection/SKILL.md'), 'utf8')
    : '';
  for (const track of Object.keys(SESSION_TRACKS)) {
    if (!chooser.includes(track)) report.fail(`track ${track}: the orchestrator never names it, so it cannot be chosen`);
    if (!selection.includes(track)) report.fail(`track ${track}: track-selection never names it`);
  }

  // A track budget below the sum of its phase budgets is a cap that fires mid-phase.
  const budgets = readJsonOrNull(harnessPath('loops/budgets.json'));
  const phaseBudgets = budgets?.loops?.session?.phases ?? {};
  const trackBudgets = budgets?.loops?.session?.tracks ?? {};
  for (const [name, track] of Object.entries(SESSION_TRACKS)) {
    const sum = track.phases.reduce((s, p) => s + (phaseBudgets[p]?.tokenBudget ?? 0), 0);
    const cap = trackBudgets[name]?.tokenBudget ?? 0;
    if (sum > 0 && cap < sum) {
      report.fail(`track ${name}: budget ${cap} is below the ${sum} its phases add up to, so it stops mid-phase`);
    }
  }

  // The finops file and the contract must agree on the agent budget.
  const finops = readJsonOrNull(harnessPath('finops/token-budgets.json'));
  const declared = finops?.tiers?.warm?.agentTokens;
  if (declared !== undefined && declared !== BUDGETS.agentTokens) {
    report.fail(`finops/token-budgets.json says agentTokens ${declared}, contracts.mjs says ${BUDGETS.agentTokens}`);
  }

  report.pass('reach: every skill, rubric and track is named by the agent that would use it');
}

export function auditSelf(report) {
  auditHotTier(report);
  auditEffectiveHot(report);
  const skills = auditSkills(report);
  const agents = auditAgents(report);
  auditRatio(report, agents, skills);
  auditInstructions(report);
  auditPrompts(report);
  auditLoops(report);
  auditTracks(report);
  auditRubrics(report);
  auditReach(report);
  auditMcp(report);
  return { skills, agents: agents.length, agentList: agents };
}

/**
 * The diagnostic questions, answered from the audit rather than from the mere
 * existence of a file. A question whose answer cannot be wrong is decoration,
 * so these feed the exit code.
 */
export function diagnose({ skills = 0, agentList = [], installed = null, lockExists = false } = {}) {
  const invocable = agentList.filter((a) => a.userInvocable);
  const withTools = agentList.filter((a) => a.tools.length > 0);
  const delegating = agentList.filter((a) => a.subagents.length > 0 || a.wildcard);
  const versioned = agentList.length > 0 && agentList.every((a) => Boolean(a.data.version));

  const questions = [
    {
      question: 'Do you know every skill that is active right now?',
      answer: skills > 0,
      blocking: true,
      why: 'no skills are defined',
    },
    {
      question: 'Does every custom agent declare its tools explicitly?',
      answer: agentList.length > 0 && withTools.length === agentList.length,
      blocking: true,
      why: `${agentList.length - withTools.length} agent(s) declare no tools, so their blast radius is unbounded`,
    },
    {
      question: 'Is there an orchestrator that can actually delegate?',
      answer: delegating.length > 0,
      blocking: true,
      why: 'no agent lists sub-agents, so every session is single-agent',
    },
    {
      question: 'Is routing a written decision tree rather than intuition?',
      answer: fs.existsSync(harnessPath('core/instructions/routing.instructions.md')),
      blocking: true,
      why: 'core/instructions/routing.instructions.md is missing',
    },
    {
      question: 'Are all agents versioned?',
      answer: versioned,
      blocking: false,
      why: 'at least one agent has no version field',
    },
    {
      question: 'Is the agent to skill ratio inside the band?',
      answer: invocable.length > 0 && skills / invocable.length >= 6,
      blocking: false,
      why: 'too many user-invocable agents for the number of skills',
    },
  ];

  if (installed !== null) {
    questions.push({
      question: 'Can you trace what is installed where?',
      answer: lockExists && installed > 0,
      blocking: false,
      why: installed === 0 ? 'the harness is not installed anywhere yet' : 'no lock file',
    });
  }
  return questions;
}
