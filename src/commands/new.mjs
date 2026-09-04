import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from '../lib/paths.mjs';
import { SKILL_SECTIONS, AGENT_SECTIONS } from '../lib/contracts.mjs';
import { log } from '../lib/log.mjs';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const section = (name, hint) => `## ${name}\n\n${hint}\n`;

const SKILL_HINTS = {
  Rules: 'Domain rules, naming conventions and the anti-patterns to refuse. Be specific; a rule that could apply to any codebase teaches nothing.',
  Workflow: '1. First step.\n2. Second step.\n3. Third step.\n\nNumbered and reproducible: two runs on the same input should produce the same shape of output.',
  Output: 'A concrete example of the expected output, not a description of it.',
  Validation: '- [ ] A check that must pass before delivery.\n- [ ] Another check.\n- [ ] What to do when a check fails.',
};

const AGENT_HINTS = {
  Identity: 'Who this agent is, its domain and its tone. One paragraph.',
  Tools: 'The MCP servers, CLIs and APIs this agent may use. List them explicitly; an agent with unlisted tools has unbounded blast radius.',
  Scope: 'What it handles, and just as importantly what it refuses and hands back.',
  Contracts: 'Typed input and output for handoff. State the fields.',
  Skills: 'The SKILL.md files this agent loads.',
  Escalation: 'The conditions under which it stops and returns to a human or to the orchestrator.',
};

function skillTemplate(name) {
  return [
    '---',
    `name: ${name}`,
    'description: One sentence stating when this skill applies. It is scanned every turn, so make it routable.',
    'version: 0.1.0',
    'sfa: "scope: ... | format: ... | audience: ..."',
    'globs: []',
    'stacks: []',
    'alwaysApply: false',
    '---',
    '',
    `# ${name}`,
    '',
    ...SKILL_SECTIONS.map((s) => section(s, SKILL_HINTS[s])),
  ].join('\n');
}

/**
 * The scaffold carries the delegation wiring, not just the section headings.
 * An orchestrator created without the agent tool, or naming a sub-agent that
 * does not exist, fails harness doctor - so the generator emits both together.
 */
function agentTemplate(name, { internal = false, subagents = [], model = null } = {}) {
  const tools = internal
    ? ['codebase', 'search', 'editFiles']
    : ['codebase', 'search', 'usages'];
  if (subagents.length > 0) tools.unshift('agent');

  const frontmatter = [
    '---',
    `name: ${name}`,
    'description: One sentence on the task class this agent owns.',
    'version: 0.1.0',
  ];
  if (!internal) frontmatter.push('argument-hint: what you want this agent to do');
  frontmatter.push(`user-invocable: ${internal ? false : true}`);
  frontmatter.push(`tools: [${tools.join(", ")}]`);
  frontmatter.push(`agents: [${subagents.join(", ")}]`);
  if (model) frontmatter.push(`model: [${model}]`);
  frontmatter.push('---');

  const hints = { ...AGENT_HINTS };
  if (subagents.length > 0) {
    hints.Tools =
      'The agent tool is present because this agent delegates to ' +
      subagents.join(', ') +
      '. List every other MCP server, CLI and API it may use; an agent with ' +
      'unlisted tools has unbounded blast radius.';
    hints.Contracts =
      'The typed envelope each sub-agent returns, and what this agent carries ' +
      'between them. Carry summaries, not artifacts.';
  }
  if (internal) {
    hints.Identity =
      'Who this agent is and which phase it owns. It is internal: the ' +
      'orchestrator invokes it, users do not.';
  }

  const body = AGENT_SECTIONS.map((s) => section(s, hints[s]));
  return [...frontmatter, '', '# ' + name, '', ...body].join('\n');
}
function instructionTemplate(name) {
  return [
    '---',
    'applyTo: "**"',
    `description: Scoped rules for ${name}.`,
    '---',
    '',
    `# ${name}`,
    '',
    'Rules here apply to every file matching applyTo. Multiple matching instruction',
    'files merge rather than override, so keep each one to a single concern.',
    '',
  ].join('\n');
}

const KINDS = {
  skill: (name) => ({ file: harnessPath('core/skills', name, 'SKILL.md'), content: skillTemplate(name) }),
  agent: (name, opts) => ({
    file: harnessPath('core/agents', `${name}.agent.md`),
    content: agentTemplate(name, opts),
  }),
  instruction: (name) => ({
    file: harnessPath('core/instructions', `${name}.instructions.md`),
    content: instructionTemplate(name),
  }),
};

export default function create(args) {
  const [kind, rawName] = args._;
  if (!kind || !rawName) {
    throw new Error(
      'Usage: harness new <skill|agent|instruction> <name> [--internal] [--subagents=a,b] [--model=X]'
    );
  }
  const build = KINDS[kind];
  if (!build) throw new Error(`Unknown kind: ${kind}. Use skill, agent or instruction.`);

  const name = slug(rawName);
  const options = {
    internal: Boolean(args.internal),
    subagents: String(args.subagents ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    model: args.model ?? null,
  };
  const { file, content } = build(name, options);
  if (fs.existsSync(file)) throw new Error(`${path.relative(harnessPath('.'), file)} already exists.`);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');

  log.ok(`Created ${path.relative(harnessPath('.'), file).split(path.sep).join('/')}`);
  log.info('Every mandatory section is scaffolded. Fill them in, then run "harness doctor".');
  return 0;
}
