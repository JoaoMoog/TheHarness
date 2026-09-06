/**
 * The tools a repository can be wired for.
 *
 * Three targets, hard-coded. An adapter abstraction over three maps would hide
 * exactly what a reader needs to see - which surface each tool reads, and where
 * each one has no equivalent at all.
 *
 * The rule that shapes all three: link the real content, generate only what
 * changes format, and generate as little as possible. A generated file is a
 * copy, and a copy drifts.
 */

/** Directories linked into a repository. An edit in the harness is live at once. */
const SHARED_DIRS = [
  'core/instructions',
  'core/skills',
  'core/agents',
  'core/prompts',
  'core/rubrics',
  'core/tools',
  'core/hooks',
];

const under = (prefix, sources) =>
  sources.map((source) => ({ source, target: `${prefix}/${source.replace('core/', '')}` }));

/**
 * One path for content that no tool discovers on its own.
 *
 * Skills, tools and rubrics are referred to by path from inside agent and skill
 * prose - `node .agents/tools/spec/traceability.mjs`. That text is linked, not
 * generated, so every target reads the same bytes, and a target-specific prefix
 * inside it would be wrong everywhere but one. This is where that path
 * resolves, and every target links it in addition to its own native locations.
 *
 * It is not `.harness/`: that name already belongs to the runtime state the
 * hooks write (RUNTIME_DIRS in paths.mjs). `.agents/` is also where the Codex
 * CLI looks for project skills, which the next target gets for free.
 */
const SHARED_PATH = under('.agents', ['core/skills', 'core/tools', 'core/rubrics']);

export const TARGETS = {
  copilot: {
    id: 'copilot',
    label: 'GitHub Copilot',
    /** A repository that already has this directory is using this tool. */
    detect: '.github',
    dirSurfaces: [
      ...under('.github', SHARED_DIRS),
      { source: 'core/chatmodes', target: '.github/chatmodes' },
      ...SHARED_PATH,
    ],
    fileSurfaces: [
      { source: 'core/copilot-instructions.md', target: '.github/copilot-instructions.md' },
      { source: 'core/AGENTS.md', target: 'AGENTS.md' },
      { source: 'core/mcp.json', target: '.mcp.json' },
    ],
    /** Nothing is generated: every surface is in the shape Copilot already reads. */
    generators: [],
    /** Every harness event has a Copilot equivalent. */
    unmappedEvents: [],
    /** Directories unlink removes once they are empty again. */
    prunable: ['.github', '.agents'],
    hooksAt: '.github/hooks',
    specs: { dir: 'specs', layout: 'harness' },
  },

  kiro: {
    id: 'kiro',
    label: 'Kiro',
    detect: '.kiro',
    /**
     * The content lands under .kiro/harness/ rather than in .kiro/steering/
     * directly, because steering is a flat list of markdown files and the
     * harness ships directories. The generated steering files point here.
     */
    dirSurfaces: [...under('.kiro/harness', SHARED_DIRS), ...SHARED_PATH],
    fileSurfaces: [
      // Kiro reads AGENTS.md natively, from the workspace root.
      { source: 'core/AGENTS.md', target: 'AGENTS.md' },
      { source: 'core/mcp.json', target: '.kiro/settings/mcp.json' },
    ],
    generators: ['steering', 'hooks'],
    /**
     * Kiro has no equivalent for these three. They are dropped and reported,
     * never remapped onto a nearby event: a guardrail that fires at the wrong
     * moment is worse than one everybody knows is missing.
     */
    unmappedEvents: ['SubagentStart', 'SubagentStop', 'PreCompact'],
    // Excluding each generated file by name would put fifty lines in the git
    // exclude block; these two directories hold nothing else.
    excludeExtra: ['.kiro/steering', '.kiro/hooks'],
    // .kiro itself is Kiro's, not the harness's, so it stays even when empty.
    prunable: ['.kiro/harness', '.kiro/steering', '.kiro/hooks', '.kiro/settings', '.agents'],
    hooksAt: '.kiro/harness/hooks',
    specs: { dir: '.kiro/specs', layout: 'kiro' },
  },

  claude: {
    id: 'claude',
    label: 'Claude Code',
    detect: '.claude',
    dirSurfaces: [
      // Claude Code reads SKILL.md in the shape the harness already writes, so
      // this is a link rather than a wrapper. It is the one surface that needed
      // no translation at all.
      { source: 'core/skills', target: '.claude/skills' },
      // The scripts the generated hook commands point at.
      { source: 'core/hooks', target: '.claude/harness/hooks' },
      // Read by nothing automatically; linked so a generated agent that names
      // an instruction file has something to open.
      { source: 'core/instructions', target: '.claude/harness/instructions' },
      ...SHARED_PATH,
    ],
    fileSurfaces: [
      // Claude Code does not read AGENTS.md, but the generated CLAUDE.md
      // imports it, so the file still has to be here.
      { source: 'core/AGENTS.md', target: 'AGENTS.md' },
    ],
    generators: ['agents', 'commands', 'mcp', 'claude-md'],
    /** Claude Code has an equivalent for every event the harness fires. */
    unmappedEvents: [],
    /**
     * Instructions are the one surface with no equivalent. Claude Code has no
     * rule-per-glob concept - no applyTo, no fileMatch - so the files are
     * linked and reachable but never loaded on their own.
     */
    unmappedSurfaces: ['core/instructions'],
    // Generated and merged paths are not surfaces, so they are named here for
    // the git exclude block that keeps them out of everyone else's git status.
    excludeExtra: ['.claude/agents', '.claude/commands', '.claude/settings.local.json', 'CLAUDE.md', '.mcp.json'],
    // .claude itself belongs to the user, so it stays even when empty.
    prunable: ['.claude/harness', '.claude/agents', '.claude/commands', '.agents'],
    hooksAt: '.claude/harness/hooks',
    specs: { dir: 'specs', layout: 'harness' },
  },
};

export const TARGET_IDS = Object.keys(TARGETS);
export const DEFAULT_TARGET = 'copilot';

export function getTarget(id) {
  const target = TARGETS[id];
  if (!target) throw new Error(`Unknown target "${id}". Known targets: ${TARGET_IDS.join(', ')}.`);
  return target;
}

/**
 * Every path a target writes, for the git exclude block and for unlink.
 * Generated paths are added by the generators at install time.
 */
export function targetPaths(id) {
  const target = getTarget(id);
  return [
    ...target.dirSurfaces.map((s) => s.target),
    ...target.fileSurfaces.map((s) => s.target),
    ...(target.excludeExtra ?? []),
  ];
}

/**
 * Two targets can want the same file - AGENTS.md is read by both - so the
 * install loop dedupes by target path rather than installing it twice.
 */
export function mergedSurfaces(ids) {
  const dirs = new Map();
  const files = new Map();
  for (const id of ids) {
    const target = getTarget(id);
    for (const surface of target.dirSurfaces) dirs.set(surface.target, surface);
    for (const surface of target.fileSurfaces) files.set(surface.target, surface);
  }
  return { dirSurfaces: [...dirs.values()], fileSurfaces: [...files.values()] };
}

/** Directories a repository's targets may leave behind empty after removal. */
export function prunableDirs(ids) {
  return [...new Set(ids.flatMap((id) => getTarget(id).prunable ?? []))];
}

/**
 * Harness events no target of this repository can fire. A second target that
 * covers an event closes the gap, which is why this is an intersection.
 */
export function unmappedEvents(ids) {
  const lists = ids.map((id) => getTarget(id).unmappedEvents ?? []);
  if (lists.length === 0) return [];
  return lists[0].filter((event) => lists.every((list) => list.includes(event)));
}

/**
 * Content surfaces no target of this repository loads on its own. Same
 * intersection as the events, for the same reason: Copilot's applyTo covers
 * the instructions that Claude Code alone would leave inert.
 */
export function unmappedSurfaces(ids) {
  const lists = ids.map((id) => getTarget(id).unmappedSurfaces ?? []);
  if (lists.length === 0) return [];
  return lists[0].filter((surface) => lists.every((list) => list.includes(surface)));
}

/** The spec layout for a repository, when a repository has more than one target. */
export function specsFor(ids) {
  // Kiro owns the spec panel when it is present, so its layout wins.
  return getTarget(ids.includes('kiro') ? 'kiro' : DEFAULT_TARGET).specs;
}
