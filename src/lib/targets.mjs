/**
 * The tools a repository can be wired for.
 *
 * Two targets, hard-coded. An adapter abstraction with one implementation is
 * speculative generality; with two it is still cheaper to read the two maps
 * than to read an abstraction over them. A third tool is when to reconsider.
 *
 * The rule that shapes both maps: link the real content, generate only what
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

export const TARGETS = {
  copilot: {
    id: 'copilot',
    label: 'GitHub Copilot',
    /** A repository that already has this directory is using this tool. */
    detect: '.github',
    dirSurfaces: [
      ...under('.github', SHARED_DIRS),
      { source: 'core/chatmodes', target: '.github/chatmodes' },
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
    prunable: ['.github'],
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
    dirSurfaces: under('.kiro/harness', SHARED_DIRS),
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
    prunable: ['.kiro/harness', '.kiro/steering', '.kiro/hooks', '.kiro/settings'],
    hooksAt: '.kiro/harness/hooks',
    specs: { dir: '.kiro/specs', layout: 'kiro' },
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

/** The spec layout for a repository, when a repository has more than one target. */
export function specsFor(ids) {
  // Kiro owns the spec panel when it is present, so its layout wins.
  return getTarget(ids.includes('kiro') ? 'kiro' : DEFAULT_TARGET).specs;
}
