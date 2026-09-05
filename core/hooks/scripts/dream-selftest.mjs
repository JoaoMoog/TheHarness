#!/usr/bin/env node
/**
 * Self-test for consolidation, end to end, on synthetic sessions.
 *
 * Three things are worth proving and none of them can be read off the code:
 * that the collector finds the signals in a real session file, that it stays
 * silent on the second run, and that the next session start injects what it
 * found and then stops carrying it.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseDreams, setStatus, renderDecision, insertDecision } from '../../../src/lib/dreams.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NL = String.fromCharCode(10);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dream-'));

const results = [];
const check = (label, condition, detail = '') => {
  const passed = Boolean(condition);
  results.push(passed);
  console.log(
    '  ' +
      (passed ? 'pass' : 'FAIL') +
      '  ' +
      label +
      (passed || !detail ? '' : '  (' + String(detail).slice(0, 130) + ')')
  );
};

/** A closed session, carrying whatever signals the caller asks for. */
function writeSession(id, slug, { track, promotedFrom, escalated, implementPasses, gap }) {
  const dir = path.join(root, 'specs', `${id}-${slug}`);
  fs.mkdirSync(dir, { recursive: true });

  const summaries = [];
  for (let pass = 0; pass < implementPasses; pass += 1) {
    summaries.push(`### implement — implementer — 2026-09-0${pass + 1}T10:00:00Z`, '', 'Did the work.', '');
  }
  if (escalated) summaries.push('### review — reviewer — 2026-09-04T10:00:00Z', '', 'Sent it back.', '');

  fs.writeFileSync(
    path.join(dir, 'session.md'),
    [
      `# Session ${id}-${slug}`,
      '',
      `id: ${id}`,
      `track: ${track}`,
      `promoted from: ${promotedFrom ?? 'none'}`,
      'phase: done',
      '',
      '## Phases',
      '',
      '| phase | status | approved by | artifact | summary |',
      '|---|---|---|---|---|',
      '| specify | complete | ana | spec.md | done |',
      '| plan | complete | ana | plan.md | done |',
      `| review | ${escalated ? 'escalated' : 'complete'} | ana | verdict | done |`,
      '',
      '## Scores',
      '',
      '| phase | rubric | scores | lowest |',
      '|---|---|---|---|',
      '| review | code-review | 4 3 2 | 2 |',
      '',
      gap ? `Matrix: ${gap} GAP` : '',
      '',
      '## Summaries',
      '',
      ...summaries,
    ].join(NL),
    'utf8'
  );
  return dir;
}

const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
git(['init', '-q', '--initial-branch=main']);
git(['config', 'user.email', 'selftest@example.com']);
git(['config', 'user.name', 'selftest']);

writeSession('041', 'pool-headroom', { track: 'fix', escalated: true, implementPasses: 2, gap: 'FR-003' });
writeSession('043', 'retry-helper', { track: 'fix', escalated: true, implementPasses: 2 });
writeSession('044', 'export-csv', { track: 'feature', promotedFrom: 'spike', implementPasses: 1 });

const collector = path.join(HERE, 'dream-collect.mjs');
const runCollect = () => spawnSync(process.execPath, [collector], { cwd: root, encoding: 'utf8' });

console.log('Dreaming self-test' + NL);

const first = runCollect();
const pendingPath = path.join(root, '.harness', 'dream-pending.json');
check('the collector writes material for newly closed sessions', fs.existsSync(pendingPath), first.stdout);

let pending = null;
try {
  pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
} catch {
  /* asserted below */
}
check('it reports all three closed sessions', pending?.closed?.length === 3, String(pending?.closed?.length));
check(
  'it names the phase that escalated, and its agent',
  pending?.closed?.some((s) => s.escalations.some((e) => e.phase === 'review' && e.agent === 'reviewer')),
  JSON.stringify(pending?.closed?.[0]?.escalations)
);
check(
  'it notices a phase that ran twice',
  pending?.closed?.filter((s) => s.repeatedPhases.some((p) => p.phase === 'implement')).length === 2,
  JSON.stringify(pending?.closed?.map((s) => s.repeatedPhases))
);
check(
  'it carries the track promotion',
  pending?.closed?.some((s) => s.promotedFrom === 'spike'),
  JSON.stringify(pending?.closed?.map((s) => s.promotedFrom))
);
check(
  'it carries the uncovered requirement',
  pending?.closed?.some((s) => s.gaps.includes('FR-003')),
  JSON.stringify(pending?.closed?.map((s) => s.gaps))
);
check(
  'it carries the low rubric score',
  pending?.closed?.some((s) => s.lowScores.length > 0),
  JSON.stringify(pending?.closed?.[0]?.lowScores)
);

// Silence. A second run with nothing newly closed must produce nothing at all.
fs.rmSync(pendingPath, { force: true });
const second = runCollect();
check('a second run with no new session writes nothing', !fs.existsSync(pendingPath), second.stdout.trim());
check('and says so instead of failing', /nothing to collect/i.test(second.stdout), second.stdout.trim());

// A newly closed session makes it speak again.
writeSession('045', 'rate-limit', { track: 'fix', escalated: true, implementPasses: 2 });
runCollect();
check('a newly closed session revives it', fs.existsSync(pendingPath));

// The next session start injects the material, then stops carrying it.
const contextScript = path.join(HERE, 'session-context.mjs');
const runContext = () =>
  spawnSync(process.execPath, [contextScript, '--hook-mode=kiro'], {
    cwd: root,
    encoding: 'utf8',
    input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'x' }),
  });

const injected = runContext();
check(
  'session start injects the consolidation section',
  /Consolidation pending/.test(injected.stdout),
  injected.stdout.slice(0, 160)
);
check('and names the skill that governs it', /dreaming/.test(injected.stdout));
check('and states the spec layout', /Spec layout/.test(injected.stdout));
check('the material is consumed, not re-injected', !fs.existsSync(pendingPath));

const again = runContext();
check('a second start carries no consolidation section', !/Consolidation pending/.test(again.stdout));

// A Kiro repository consolidates into the Kiro spec directory.
fs.mkdirSync(path.join(root, '.kiro', 'harness'), { recursive: true });
const kiroContext = runContext();
check(
  'a Kiro repository is told to write requirements.md, not spec.md',
  /requirements\.md/.test(kiroContext.stdout) && /kiro..specs/.test(kiroContext.stdout),
  kiroContext.stdout.slice(0, 220)
);
fs.rmSync(path.join(root, '.kiro'), { recursive: true, force: true });

// The candidates file: parsing, promotion, discard.
const dreams = [
  '# Dream candidates',
  '',
  '---',
  '',
  '## D-001 · Review escalates when implement ships without named tests',
  '',
  'Status: open',
  '',
  'Evidence: 041 (escalated at review), 043 (same shape)',
  '',
  'Proposes: the tasker names the test file for each task',
  '',
  'Rejected: raising the review threshold, because the reviewer was right both times',
  '',
  'Contradicts: none',
  '',
  '## D-002 · Something that happened once',
  '',
  'Status: open',
  '',
  'Evidence: 044',
  '',
  'Proposes: nothing yet',
  '',
].join(NL);

const parsed = parseDreams(dreams);
check('both candidates are parsed', parsed.length === 2, JSON.stringify(parsed.map((c) => c.id)));
check('the well-evidenced one cites two sessions', parsed[0].sessions.length === 2, JSON.stringify(parsed[0].sessions));
check('the thin one cites one', parsed[1].sessions.length === 1, JSON.stringify(parsed[1].sessions));
check('fields are read off the block', parsed[0].fields.proposes?.startsWith('the tasker'), parsed[0].fields.proposes);

const promoted = setStatus(dreams, 'D-001', 'promoted 2026-09-05');
check(
  'promotion rewrites only that block',
  parseDreams(promoted).find((c) => c.id === 'D-001')?.status === 'promoted' &&
    parseDreams(promoted).find((c) => c.id === 'D-002')?.status === 'open',
  promoted.slice(promoted.indexOf('D-001'), promoted.indexOf('D-001') + 90)
);

const discarded = setStatus(dreams, 'D-002', 'discarded 2026-09-05', 'Why: one session is not a pattern');
check(
  'discard records the reason in the block',
  /Why: one session is not a pattern/.test(discarded),
  discarded.slice(discarded.indexOf('D-002'), discarded.indexOf('D-002') + 170)
);
check('discard sets the status', parseDreams(discarded).find((c) => c.id === 'D-002')?.status === 'discarded');

const decisions = [
  '# Decisions',
  '',
  'Preamble.',
  '',
  '---',
  '',
  '## 2026-01-01 · an older decision',
  '',
  'Session: 001',
  '',
].join(NL);
const merged = insertDecision(decisions, renderDecision(parsed[0], '2026-09-05'));
check('the promoted decision lands newest-first', merged.indexOf('2026-09-05') < merged.indexOf('2026-01-01'));
check(
  'it carries the sessions as evidence',
  /Session: 041, 043/.test(merged),
  merged.slice(merged.indexOf('2026-09-05'), merged.indexOf('2026-09-05') + 200)
);
check('it carries the rejected alternative', /Rejected: raising the review threshold/.test(merged));
check('the preamble survives', merged.startsWith('# Decisions'));

const failed = results.filter((r) => !r).length;
console.log(NL + '  ' + (results.length - failed) + ' passed, ' + failed + ' failed');
console.log('  sandbox: ' + root);
process.exit(failed === 0 ? 0 : 1);
