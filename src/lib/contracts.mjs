/**
 * The structural contracts every authored artifact must satisfy. Doctor, eval
 * and the scaffolder all read from here so a contract change lands in one place.
 */

/** Section 1 is the frontmatter itself; these are the four required headings. */
export const SKILL_SECTIONS = ['Rules', 'Workflow', 'Output', 'Validation'];
export const SKILL_FRONTMATTER = ['name', 'description', 'version', 'sfa'];

export const AGENT_SECTIONS = ['Identity', 'Tools', 'Scope', 'Contracts', 'Skills', 'Escalation'];
/**
 * `tools` is required, not optional. An agent whose tool manifest is implicit
 * has unbounded blast radius, and the previous contract asked for the manifest
 * in prose while never checking that one existed.
 */
export const AGENT_FRONTMATTER = ['name', 'description', 'version', 'tools'];

export const INSTRUCTION_FRONTMATTER = ['applyTo'];
export const PROMPT_FRONTMATTER = ['description', 'version'];

/** SFA test: a skill must state its scope, output format and audience. */
export const SFA_KEYS = ['scope', 'format', 'audience'];

export const BUDGETS = {
  hotTierBytes: 2048,
  /**
   * Everything with applyTo "**" loads on any file the agent touches, so it is
   * hot in every sense except the name. Measuring only copilot-instructions.md
   * understated the real per-turn cost by roughly seven times.
   */
  effectiveHotTokens: 4500,
  skillBodyTokens: 2000,
  instructionTokens: 1200,
  agentTokens: 1400,
  promptTokens: 700,
};

/**
 * The ratio is measured over user-invocable agents only. Phase agents are the
 * orchestrator's implementation, not routing surface, and counting them would
 * make the gate punish the very architecture it exists to support.
 */
export const AGENT_SKILL_RATIO = { min: 6, max: 14 };

/**
 * Universal instruction coverage that real-world repositories usually lack.
 * token-economy is required because the rules it carries - verify once per
 * tree state, warn rather than fix what predates the change, use a token-saving
 * MCP server when one is connected - are the ones every phase drifts from.
 */
export const REQUIRED_INSTRUCTIONS = ['security', 'performance', 'testing', 'routing', 'token-economy'];

export const LOOP_REQUIRED_KEYS = ['maxIterations', 'stopCriterion', 'tokenBudget'];

/**
 * A session runs one track, and a track is an ordered subset of the phases.
 * Not every request earns a specification: a typo does not become safer by
 * being specified first, it only becomes slower, and a process people route
 * around is worse than a shorter process they follow.
 *
 * Order is preserved within a track; only omission is allowed. A track may be
 * promoted mid-session when the work turns out larger than it looked, which is
 * what makes the short tracks safe to offer.
 */
export const SESSION_TRACKS = {
  patch: {
    phases: ['implement', 'review', 'deliver'],
    when: 'no behaviour changes: text, a version bump, formatting, dead code',
    promoteTo: 'fix',
  },
  fix: {
    phases: ['specify', 'implement', 'review', 'deliver'],
    when: 'a reported defect; specify produces the failing test that reproduces it',
    promoteTo: 'feature',
  },
  refactor: {
    phases: ['plan', 'tasks', 'implement', 'review', 'deliver'],
    when: 'structure changes and behaviour does not, so there is nothing to specify',
    promoteTo: 'feature',
  },
  feature: {
    phases: ['specify', 'plan', 'tasks', 'implement', 'review', 'deliver'],
    when: 'behaviour the system does not have yet',
    promoteTo: null,
  },
  incident: {
    phases: ['implement', 'review', 'deliver'],
    when: 'production is broken; you stanch the bleeding before you understand it',
    promoteTo: 'fix',
    requiresArtifact: 'runbook',
  },
  spike: {
    phases: ['specify', 'plan'],
    when: 'a question rather than a change; ends in an answer, never in a pull request',
    promoteTo: 'feature',
  },
};

/**
 * A rubric is the second half of verification. The deterministic checks answer
 * "did it work"; the rubric answers "is it good", and it has to be a versioned
 * artifact rather than a reviewer mood, or the answer changes week to week.
 */
export const RUBRIC_SECTIONS = ['Criteria', 'Levels', 'Threshold'];
export const RUBRIC_FRONTMATTER = ['name', 'description', 'version', 'appliesTo', 'threshold'];

/** A phase that produces a judgement must have a rubric to judge against. */
export const RUBRIC_REQUIRED_PHASES = ['specify', 'review', 'deliver'];

/** The one phase no track may omit: nothing ships unreviewed. */
export const MANDATORY_PHASE = 'review';

/** The ordered phases of a session. An agent may not skip forward. */
export const SESSION_PHASES = ['specify', 'plan', 'tasks', 'implement', 'review', 'deliver', 'done'];

/** Fields every phase agent must return so the orchestrator can advance. */
export const HANDOFF_FIELDS = ['stage', 'status', 'summary'];
export const HANDOFF_STATUSES = ['complete', 'blocked', 'escalated'];

/** MCP servers must declare who owns them and what they can reach. */
export const MCP_SERVER_FIELDS = ['owner', 'trust', 'scope', 'version'];

/**
 * A disabled server may carry TODO placeholders, because the file is also the
 * template for enabling one. An enabled server may not: a placeholder command
 * does not start, and a placeholder owner means nobody answers for it.
 */
export const MCP_PLACEHOLDER = /\bTODO\b/;

/** Text the scaffolder writes that must be replaced before the contract holds. */
export const PLACEHOLDER_MARKERS = [
  'One sentence stating when this skill applies',
  'One sentence on the task class this agent owns',
  'scope: ... | format: ... | audience: ...',
  'Domain rules, naming conventions and the anti-patterns to refuse',
  'Who this agent is, its domain and its tone',
  'A concrete example of the expected output, not a description of it',
];
