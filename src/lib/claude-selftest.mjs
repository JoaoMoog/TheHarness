#!/usr/bin/env node
/**
 * Self-test for the Claude Code target.
 *
 * The generators are pure, so most of this reads their output directly. What
 * cannot be read off the code is the part that touches a file somebody else
 * owns: .claude/settings.local.json holds the user's own keys and possibly their own
 * hooks, and the harness has to add its entries there without taking the file
 * over. Those cases run against real files in a temporary directory.
 */
import {
  claudeAgents,
  claudeCommands,
  claudeHooks,
  claudeMcp,
  claudeMd,
  mergeSettings,
  harnessHookSlice,
  stripHarnessHooks,
  unmappedTools,
  agentsWithUnmappedTools,
  frontMatterValue,
  TOOL_MAP,
} from './claude-gen.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { harnessPath } from './paths.mjs';
import { installRepo } from '../commands/install.mjs';
import { uninstallRepo } from '../commands/unlink.mjs';
import { driftedGenerated, driftedMerged } from '../commands/doctor.mjs';
import { generatedFilesFor, contestedPaths } from './generators.mjs';
import { TARGETS, mergedSurfaces, targetPaths, unmappedEvents, unmappedSurfaces } from './targets.mjs';

const results = [];
const check = (label, condition, detail = '') => {
  const passed = Boolean(condition);
  results.push(passed);
  console.log(
    '  ' + (passed ? 'pass' : 'FAIL') + '  ' + label + (passed || !detail ? '' : '  (' + String(detail).slice(0, 160) + ')')
  );
};

const byPath = (files) => new Map(files.map((f) => [f.path, f.content]));

console.log('Claude target self-test\n');

console.log('agents: front matter is translated, the body is not');
{
  const files = byPath(claudeAgents());
  const reviewer = files.get('.claude/agents/reviewer.md');

  check('one file per agent, named without the .agent infix', Boolean(reviewer), [...files.keys()].join(' '));
  check('name comes from the source front matter', /^---\r?\nname: reviewer\r?\n/.test(reviewer ?? ''));
  check(
    'description is carried across verbatim',
    (reviewer ?? '').includes('description: Reviews a change set for correctness')
  );
  check(
    'tools are mapped, deduped and kept in source order',
    /\ntools: Read, Grep, Glob, Bash\r?\n/.test(reviewer ?? ''),
    (reviewer ?? '').split('\n').find((l) => l.startsWith('tools:'))
  );
  check(
    'a model list picks the first Claude alias it contains',
    /\nmodel: sonnet\r?\n/.test(reviewer ?? ''),
    (reviewer ?? '').split('\n').find((l) => l.startsWith('model:'))
  );
  check('the six sections pass through untouched', (reviewer ?? '').includes('## Identity'));
  check(
    'the body is not rewritten at all',
    (reviewer ?? '').includes('It is the harness judge, not only its code reviewer.')
  );

  const orchestrator = files.get('.claude/agents/orchestrator.md');
  check('the agent tool becomes Task', /\ntools:[^\n]*Task/.test(orchestrator ?? ''));
  check('problems has no equivalent and is dropped', TOOL_MAP.problems.length === 0);
}

console.log('\ncommands: the VS Code input variable becomes $ARGUMENTS');
{
  const files = byPath(claudeCommands());
  const feature = files.get('.claude/commands/feature.md');

  check('one command per prompt, named without the .prompt infix', Boolean(feature), [...files.keys()].join(' '));
  check('description is carried across', (feature ?? '').includes('description: Starts a session.'));
  check('the variable name becomes the argument hint', /\nargument-hint: request\r?\n/.test(feature ?? ''));
  check('the placeholder is replaced', (feature ?? '').includes('Request: $ARGUMENTS'));
  check('no VS Code placeholder survives', !(feature ?? '').includes('${input:'));
  check('mode has no equivalent and is dropped', !/\nmode:/.test(feature ?? ''));

  const evaluate = files.get('.claude/commands/loop-evaluate.md');
  check('a different variable name gives a different hint', /\nargument-hint: task\r?\n/.test(evaluate ?? ''));
}

console.log('\nhooks: every harness event, in the shape Claude Code reads');
{
  const { hooks, dropped } = claudeHooks();
  const events = Object.keys(hooks);
  const groups = Object.values(hooks).flat();
  const entries = groups.flatMap((g) => g.hooks ?? []);

  check(
    'all eight harness events survive - Claude Code has every one',
    ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'PreCompact', 'Stop'].every(
      (event) => events.includes(event)
    ),
    events.join(' ')
  );
  check('nothing is dropped: the mapping covers every matcher in use', dropped.length === 0, dropped.join(' '));
  check(
    'an event holds matcher groups, each wrapping its own hooks array',
    groups.every((g) => Array.isArray(g.hooks) && g.hooks.length > 0)
  );
  check(
    'every command points at the linked Claude scripts',
    entries.every((e) => e.command.includes('${CLAUDE_PROJECT_DIR}/.claude/harness/hooks/scripts/')),
    entries.map((e) => e.command).find((cmd) => !cmd.includes('.claude/harness/hooks/scripts/'))
  );
  check('no command still points at .github', !entries.some((e) => e.command.includes('.github/')));
  check(
    'the mode rides in argv, because a hook entry has no env field',
    entries.every((e) => e.command.includes('--hook-mode=claude') && !('env' in e))
  );
  check(
    'a shell matcher becomes the Bash tool',
    (hooks.PreToolUse ?? []).some((g) => g.matcher === 'Bash'),
    (hooks.PreToolUse ?? []).map((g) => g.matcher).join(' / ')
  );
  check(
    'an edit matcher becomes the editing tools, capitalised as Claude Code spells them',
    (hooks.PreToolUse ?? []).some((g) => g.matcher === 'Edit|Write|NotebookEdit')
  );
  check(
    'a read matcher becomes the reading tools',
    (hooks.PreToolUse ?? []).some((g) => g.matcher === 'Read|Grep|Glob|WebFetch')
  );
  check(
    'no VS Code tool name survives in a matcher',
    !groups.some((g) => /runCommands|editFiles|readFile|createFile/.test(g.matcher ?? ''))
  );
  check(
    'an entry with no matcher stays unmatched, firing on every occurrence',
    (hooks.SessionStart ?? []).every((g) => !('matcher' in g))
  );
  check('timeouts survive', entries.every((e) => typeof e.timeout === 'number'));
}

console.log('\nmcp: the harness schema becomes the Claude Code schema');
{
  const source = {
    servers: {
      github: { command: 'npx', args: ['-y', 'pkg'], env: { TOKEN: 'x' }, owner: 'team', trust: 'reads', scope: 'repo', version: '1.0.0' },
    },
    disabled: { aws: { command: 'npx', args: [] } },
  };
  const parsed = JSON.parse(claudeMcp(source).content);

  check('the top-level key is the one Claude Code reads', Object.keys(parsed).join() === 'mcpServers', Object.keys(parsed).join());
  check('an enabled server keeps command, args and env', parsed.mcpServers.github.command === 'npx' && parsed.mcpServers.github.env.TOKEN === 'x');
  check(
    'the fields that exist for a human to decide are dropped',
    !('owner' in parsed.mcpServers.github) && !('trust' in parsed.mcpServers.github) &&
      !('scope' in parsed.mcpServers.github) && !('version' in parsed.mcpServers.github),
    Object.keys(parsed.mcpServers.github).join()
  );
  check('a disabled server never reaches the file', !('aws' in parsed.mcpServers));
  check('the path is the project-scoped one', claudeMcp(source).path === '.mcp.json');
}

console.log('\nCLAUDE.md: an import, not a copy');
{
  const file = claudeMd();
  check('lands at the repository root', file.path === 'CLAUDE.md');
  check('imports AGENTS.md rather than duplicating it', /^@AGENTS\.md$/m.test(file.content));
  check('says who wrote it and what to edit instead', file.content.includes('AGENTS.md, not this file'));
  check('stays one line of content', file.content.split('\n').filter((l) => l.trim() && !l.startsWith('<!--')).length === 1);
}

console.log('\nsettings.local.json: the harness is a guest in someone else\'s file');
{
  /** A settings file as a repository that already uses Claude Code would have it. */
  const theirs = () => ({
    model: 'opus',
    permissions: { allow: ['Bash(npm run test)'] },
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node ./their-own-hook.mjs' }] }],
      Notification: [{ hooks: [{ type: 'command', command: 'node ./notify.mjs' }] }],
    },
  });

  const merged = mergeSettings(theirs(), claudeHooks().hooks);

  check('a key the harness knows nothing about is untouched', merged.model === 'opus');
  check('a nested key the harness knows nothing about is untouched', merged.permissions.allow[0] === 'Bash(npm run test)');
  check(
    'an event the harness does not write is untouched',
    merged.hooks.Notification?.[0].hooks[0].command === 'node ./notify.mjs'
  );
  check(
    'their hook survives in an event the harness does write',
    merged.hooks.PreToolUse.some((g) => (g.hooks ?? []).some((h) => h.command === 'node ./their-own-hook.mjs'))
  );
  check(
    'the harness hooks are there too',
    merged.hooks.PreToolUse.some((g) => (g.hooks ?? []).some((h) => h.command.includes('secret-block.mjs')))
  );
  check('an event only the harness writes is added', Array.isArray(merged.hooks.SessionStart));

  const twice = mergeSettings(merged, claudeHooks().hooks);
  check(
    'installing twice does not duplicate anything',
    JSON.stringify(twice) === JSON.stringify(merged),
    'second install differs'
  );

  const slice = harnessHookSlice(merged);
  check(
    'the slice holds only what the harness wrote',
    Object.values(slice).flat().flatMap((g) => g.hooks).every((h) => h.command.includes('.claude/harness/hooks/scripts/'))
  );
  check(
    'the slice is what the drift check compares against',
    JSON.stringify(harnessHookSlice(mergeSettings(theirs(), claudeHooks().hooks))) === JSON.stringify(slice)
  );

  const stripped = stripHarnessHooks(merged);
  check('removal puts their file back exactly as it was', JSON.stringify(stripped) === JSON.stringify(theirs()), JSON.stringify(stripped));

  const ours = mergeSettings({}, claudeHooks().hooks);
  check(
    'a file the harness created from nothing empties completely on removal',
    JSON.stringify(stripHarnessHooks(ours)) === '{}',
    JSON.stringify(stripHarnessHooks(ours))
  );
}

console.log('\ntarget: what a repository wired for Claude Code receives');
{
  const surfaces = mergedSurfaces(['claude']);
  const dirs = new Map(surfaces.dirSurfaces.map((s) => [s.target, s.source]));
  const files = new Map(surfaces.fileSurfaces.map((s) => [s.target, s.source]));

  check('the target is detected by its own directory', TARGETS.claude?.detect === '.claude');
  check('skills are linked where Claude Code already reads them', dirs.get('.claude/skills') === 'core/skills');
  check('nothing wraps a skill: the format already matches', !TARGETS.claude.generators.includes('skills'));
  check('AGENTS.md is shared, not regenerated', files.get('AGENTS.md') === 'core/AGENTS.md');
  check('tools land at the shared path the content refers to', dirs.get('.agents/tools') === 'core/tools');
  check('rubrics land there too', dirs.get('.agents/rubrics') === 'core/rubrics');
  check('hook scripts are linked where the generated commands point', dirs.get('.claude/harness/hooks') === 'core/hooks');

  const paths = targetPaths('claude');
  for (const written of ['CLAUDE.md', '.mcp.json', '.claude/agents', '.claude/commands', '.claude/settings.local.json']) {
    check(`${written} is excluded from git, so the team never sees it`, paths.includes(written), paths.join(' '));
  }
}

console.log('\ntarget: the shared path is shared, and the gaps are named');
{
  const copilot = new Map(mergedSurfaces(['copilot']).dirSurfaces.map((s) => [s.target, s.source]));
  const kiro = new Map(mergedSurfaces(['kiro']).dirSurfaces.map((s) => [s.target, s.source]));

  check('copilot gets the shared path too, so .agents/tools resolves there', copilot.get('.agents/tools') === 'core/tools');
  check('kiro gets it as well', kiro.get('.agents/tools') === 'core/tools');
  check('copilot keeps its own native path', copilot.get('.github/tools') === 'core/tools');

  // Every target links the shared path, so every target has to be able to take
  // it away again: a target that creates a directory and does not list it as
  // prunable leaves an empty one behind on unlink.
  for (const id of ['copilot', 'kiro', 'claude']) {
    check(`${id} can prune the shared path it created`, (TARGETS[id].prunable ?? []).includes('.agents'), JSON.stringify(TARGETS[id].prunable));
  }

  check('Claude Code fires every harness event', unmappedEvents(['claude']).length === 0);
  check(
    'the instruction glob has no Claude equivalent, and doctor is told',
    unmappedSurfaces(['claude']).includes('core/instructions')
  );
  check(
    'a second target that covers the surface closes the gap',
    unmappedSurfaces(['claude', 'copilot']).length === 0
  );
}

console.log('\ngenerators: dispatched per target, not hardcoded to one');
{
  const claude = generatedFilesFor(['claude']).map((f) => f.path);
  const kiro = generatedFilesFor(['kiro']).map((f) => f.path);
  const both = generatedFilesFor(['kiro', 'claude']).map((f) => f.path);

  check('an agent is generated', claude.includes('.claude/agents/reviewer.md'), claude.join(' '));
  check('a command is generated', claude.includes('.claude/commands/feature.md'));
  check('CLAUDE.md is generated', claude.includes('CLAUDE.md'));
  check('the MCP file is generated, not copied', claude.includes('.mcp.json'));
  check('settings.local.json is not generated: it is merged into', !claude.includes('.claude/settings.local.json'));
  check('kiro still generates its steering', kiro.some((p) => p.startsWith('.kiro/steering/')));
  check('kiro generates nothing of Claude\'s', !kiro.some((p) => p.startsWith('.claude/')));
  check('two targets produce the union', both.length === claude.length + kiro.length);
  check('a target with no generator produces nothing', generatedFilesFor(['copilot']).length === 0);
}

console.log('\ngenerators: two targets cannot both own .mcp.json');
{
  check(
    'copilot copies it while claude generates it, and that is reported',
    contestedPaths(['copilot', 'claude']).includes('.mcp.json'),
    contestedPaths(['copilot', 'claude']).join(' ')
  );
  check('one target alone contests nothing', contestedPaths(['claude']).length === 0);
  check('kiro writes its MCP elsewhere, so it never contests', contestedPaths(['kiro', 'claude']).length === 0);
}

console.log('\nagents: a tool nobody can map is named, not swallowed');
{
  check('the agents in the repository today map cleanly', agentsWithUnmappedTools().length === 0, agentsWithUnmappedTools().map((a) => a.name + ':' + a.tools.join('|')).join(' '));
  check('a name outside the map is reported', unmappedTools(['codebase', 'inventedTool']).join() === 'inventedTool');
  check('a name inside the map with no equivalent is not', unmappedTools(['problems']).length === 0);
}

console.log('\ncontent: a path in linked prose has to resolve under every target');
{
  /** Every file the harness links or copies into a repository, read as text. */
  const walk = (dir, acc = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, acc);
      else if (/\.(md|mjs|json)$/.test(entry.name)) acc.push(full);
    }
    return acc;
  };

  const offenders = [];
  for (const file of [...walk(harnessPath('core')), ...walk(harnessPath('templates'))]) {
    // The guardrail self-test carries .github paths as example commands it
    // feeds to ado-gate, which matches on the script filename rather than on
    // the prefix. Those are test data, not instructions to an agent.
    if (file.endsWith('selftest.mjs')) continue;
    // harness.json is the Copilot-shaped hook manifest, and the .github prefix
    // in it is what each generator rewrites for its own target. It is the
    // source of that rewrite, not a victim of the missing one.
    if (file.endsWith(path.join('hooks', 'harness.json'))) continue;
    const text = fs.readFileSync(file, 'utf8');
    // Only paths that get executed. Prose naming .github/skills as where
    // Copilot discovers skills is true for Copilot and stays: every tool has
    // its own native skills directory. core/tools has no native home in any of
    // them, so a tool script is only ever reached by explicit path.
    if (/\.github\/tools\//.test(text) || /node\s+\.github\//.test(text)) {
      offenders.push(path.relative(harnessPath('.'), file).split(path.sep).join('/'));
    }
  }

  check(
    'no linked file tells an agent to run something under .github/',
    offenders.length === 0,
    offenders.join(' ')
  );
}

console.log('\ninstall: a real repository, installed, reinstalled and removed');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });

  // A repository that already uses Claude Code: its own settings, its own hook.
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  const theirSettings = {
    permissions: { allow: ['Bash(npm run test)'] },
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node ./theirs.mjs' }] }] },
  };
  fs.writeFileSync(path.join(root, '.claude', 'settings.local.json'), JSON.stringify(theirSettings, null, 2));

  const repo = {
    name: 'sample',
    dir: root,
    stacks: ['node'],
    settings: { mode: 'link', gitHooks: false, targets: ['claude'] },
  };
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const exists = (rel) => fs.existsSync(path.join(root, rel));

  const entry = installRepo(repo, {}, {});

  check('skills are linked where Claude Code reads them', exists('.claude/skills/debugging/SKILL.md'));
  check('the shared path resolves a tool script', exists('.agents/tools/spec/traceability.mjs'));
  check('a subagent is written', exists('.claude/agents/reviewer.md'));
  check('a command is written', exists('.claude/commands/feature.md'));
  check('CLAUDE.md imports AGENTS.md', read('CLAUDE.md').includes('@AGENTS.md'));
  check('AGENTS.md itself is there for it to import', exists('AGENTS.md'));
  check('the MCP file is in the Claude schema', 'mcpServers' in JSON.parse(read('.mcp.json')));

  const after = JSON.parse(read('.claude/settings.local.json'));
  check('their permissions survived the install', after.permissions.allow[0] === 'Bash(npm run test)');
  check(
    'their hook survived the install',
    after.hooks.PreToolUse.some((g) => (g.hooks ?? []).some((h) => h.command === 'node ./theirs.mjs'))
  );
  check(
    'the harness hooks were added',
    after.hooks.SessionStart?.[0].hooks[0].command.includes('session-context.mjs')
  );
  check('the lock records the merged file apart from the generated ones', Boolean(entry.mergedFiles?.['.claude/settings.local.json']));
  check('the lock does not claim to own their settings file', !(entry.createdFiles ?? []).includes('.claude/settings.local.json'));

  const second = installRepo(repo, entry, {});
  check(
    'reinstalling does not duplicate their hook',
    JSON.parse(read('.claude/settings.local.json')).hooks.PreToolUse.filter((g) =>
      (g.hooks ?? []).some((h) => h.command === 'node ./theirs.mjs')
    ).length === 1
  );
  check(
    'reinstalling does not duplicate the harness hooks',
    JSON.parse(read('.claude/settings.local.json')).hooks.SessionStart.length === 1
  );
  check('the recorded slice is stable across installs', second.mergedFiles['.claude/settings.local.json'] === entry.mergedFiles['.claude/settings.local.json']);

  uninstallRepo('sample', second);

  check('the generated agent is gone', !exists('.claude/agents/reviewer.md'));
  check('CLAUDE.md is gone', !exists('CLAUDE.md'));
  check(
    'their settings file is back to exactly what it was',
    read('.claude/settings.local.json').trim() === JSON.stringify(theirSettings, null, 2).trim(),
    read('.claude/settings.local.json')
  );
  check('the shared path is gone', !exists('.agents'));

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\ninstall: a settings file the harness created is removed with it');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });

  const repo = {
    name: 'fresh',
    dir: root,
    stacks: [],
    settings: { mode: 'link', gitHooks: false, targets: ['claude'] },
  };
  const entry = installRepo(repo, {}, {});
  check('the harness records that it created the file', (entry.createdFiles ?? []).includes('.claude/settings.local.json'));

  uninstallRepo('fresh', entry);
  check(
    'a file with nothing of theirs in it does not survive removal',
    !fs.existsSync(path.join(root, '.claude', 'settings.local.json'))
  );

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\ninstall: a generated path is refused when the file is already someone\'s');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });

  // The likeliest collision there is: a repository that already uses Claude
  // Code, with a CLAUDE.md somebody wrote by hand and their own MCP servers.
  const theirClaudeMd = '# Our conventions\n\nWritten by the team. Do not touch.\n';
  const theirMcp = '{\n  "mcpServers": { "ours": { "command": "our-own-server" } }\n}\n';
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), theirClaudeMd);
  fs.writeFileSync(path.join(root, '.mcp.json'), theirMcp);

  const repo = { name: 'occupied', dir: root, stacks: [], settings: { mode: 'link', gitHooks: false, targets: ['claude'] } };
  const entry = installRepo(repo, {}, {});

  check('a hand-written CLAUDE.md is not overwritten', fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8') === theirClaudeMd);
  check('their own MCP servers are not overwritten', fs.readFileSync(path.join(root, '.mcp.json'), 'utf8') === theirMcp);
  check('the lock does not claim a file it refused', !('CLAUDE.md' in (entry.generated ?? {})));
  check('everything else still installed', fs.existsSync(path.join(root, '.claude/agents/reviewer.md')));

  uninstallRepo('occupied', entry);
  check('removal leaves their CLAUDE.md where it was', fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8') === theirClaudeMd);
  check('removal leaves their .mcp.json where it was', fs.existsSync(path.join(root, '.mcp.json')));

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\ninstall: a generated file edited after the fact is not deleted');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });

  const repo = { name: 'edited', dir: root, stacks: [], settings: { mode: 'link', gitHooks: false, targets: ['claude'] } };
  const entry = installRepo(repo, {}, {});
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n\nAnd one line we added ourselves.\n');

  uninstallRepo('edited', entry);
  check(
    'a generated file somebody has since edited is kept, like a copied one',
    fs.existsSync(path.join(root, 'CLAUDE.md'))
  );

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\nsettings: an event that leaves the manifest leaves the file too');
{
  const installed = mergeSettings({}, claudeHooks().hooks);
  const shrunk = { ...claudeHooks().hooks };
  delete shrunk.PreCompact;

  const after = mergeSettings(installed, shrunk);
  check(
    'a harness event no longer in the manifest is stripped on reinstall',
    !('PreCompact' in (after.hooks ?? {})),
    Object.keys(after.hooks ?? {}).join(' ')
  );

  const withTheirs = mergeSettings(
    { hooks: { PreCompact: [{ hooks: [{ type: 'command', command: 'node ./theirs.mjs' }] }] } },
    claudeHooks().hooks
  );
  const afterTheirs = mergeSettings(withTheirs, shrunk);
  check(
    'their own hook on that event survives the strip',
    afterTheirs.hooks.PreCompact?.[0].hooks[0].command === 'node ./theirs.mjs'
  );
}

console.log('\nagents: front matter that cannot be expressed is not guessed at');
{
  check(
    'a description containing a colon does not corrupt the YAML',
    frontMatterValue('description', 'Reviews code: carefully, and reports') === '"Reviews code: carefully, and reports"',
    frontMatterValue('description', 'Reviews code: carefully, and reports')
  );
  check(
    'an agent whose tools all map to nothing is not generated at all',
    // Omitting `tools` would make Claude Code inherit every tool - the exact
    // opposite of a restriction, and the worst outcome the design names.
    claudeAgents().every((file) => /\ntools: \S/.test(file.content)),
    claudeAgents().find((f) => !/\ntools: \S/.test(f.content))?.path
  );
}

console.log('\ninstall: dropping a target takes its files with it');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });

  const asClaude = { name: 'switch', dir: root, stacks: [], settings: { mode: 'link', gitHooks: false, targets: ['claude'] } };
  const first = installRepo(asClaude, {}, {});

  // Same mode, different target: the repository is rewired for Copilot alone.
  const asCopilot = { ...asClaude, settings: { ...asClaude.settings, targets: ['copilot'] } };
  const second = installRepo(asCopilot, first, {});

  check('the generated subagents are gone', !fs.existsSync(path.join(root, '.claude/agents/reviewer.md')));
  check('CLAUDE.md is gone', !fs.existsSync(path.join(root, 'CLAUDE.md')));
  check('the lock no longer claims them', !Object.keys(second.generated ?? {}).some((p) => p.startsWith('.claude/')));

  // The dangerous leftover: hooks pointing at scripts that are no longer linked
  // would fail on every tool call.
  const local = path.join(root, '.claude', 'settings.local.json');
  const leftover = fs.existsSync(local) ? harnessHookSlice(JSON.parse(fs.readFileSync(local, 'utf8'))) : {};
  check('no harness hook is left pointing at an unlinked script', Object.keys(leftover).length === 0, JSON.stringify(leftover).slice(0, 120));
  check('the lock stops tracking the merged file', !second.mergedFiles?.['.claude/settings.local.json']);

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\ninstall: the team\'s git status stays clean');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q');
  git('config', 'user.email', 'selftest@example.com');
  git('config', 'user.name', 'selftest');

  // The case the exclude block cannot save: a settings file the team committed.
  // A tracked file the harness edits shows up as a local modification forever,
  // which is why the harness writes to the local layer instead.
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'settings.json'), JSON.stringify({ model: 'opus' }, null, 2) + '\n');
  git('add', '-A');
  git('commit', '-qm', 'their claude settings');

  installRepo(
    { name: 'tracked', dir: root, stacks: [], settings: { mode: 'link', gitHooks: false, targets: ['claude'] } },
    {},
    {}
  );

  check('nothing the harness installed shows up in git status', git('status', '--porcelain').trim() === '', git('status', '--porcelain').trim());
  check(
    'their committed settings file is byte-identical to what they committed',
    fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8') === JSON.stringify({ model: 'opus' }, null, 2) + '\n'
  );
  check('the hooks went to the local layer instead', fs.existsSync(path.join(root, '.claude', 'settings.local.json')));

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('\ndoctor: drift in the harness\'s slice, and silence about theirs');
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-claude-'));
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude', 'settings.local.json'), JSON.stringify({ model: 'opus' }, null, 2));

  const repo = { name: 'audited', dir: root, stacks: [], settings: { mode: 'link', gitHooks: false, targets: ['claude'] } };
  const entry = installRepo(repo, {}, {});
  const settings = path.join(root, '.claude', 'settings.local.json');

  check('a fresh install reports no generated drift', driftedGenerated(root, entry).length === 0, driftedGenerated(root, entry).join(' '));
  check('a fresh install reports no merged drift', driftedMerged(root, entry).length === 0);

  fs.writeFileSync(path.join(root, '.claude/agents/reviewer.md'), 'hand-edited\n');
  check('a hand-edited generated file is caught', driftedGenerated(root, entry).includes('.claude/agents/reviewer.md'));

  const theirs = JSON.parse(fs.readFileSync(settings, 'utf8'));
  theirs.model = 'sonnet';
  theirs.permissions = { allow: ['Bash(ls)'] };
  fs.writeFileSync(settings, JSON.stringify(theirs, null, 2));
  check(
    'changing a key that is theirs is not drift',
    driftedMerged(root, entry).length === 0,
    driftedMerged(root, entry).join(' ')
  );

  const tampered = JSON.parse(fs.readFileSync(settings, 'utf8'));
  tampered.hooks.SessionStart[0].hooks[0].command = 'node ./something-else.mjs --hook-mode=claude';
  fs.writeFileSync(settings, JSON.stringify(tampered, null, 2));
  check('editing what the harness wrote is drift', driftedMerged(root, entry).includes('.claude/settings.local.json'));

  fs.rmSync(root, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
