import fs from 'node:fs';
import path from 'node:path';
import { harnessPath, DIR_SURFACES } from '../lib/paths.mjs';
import { estimateTokens, formatTokens } from '../lib/tokens.mjs';
import { effectiveHotTokens } from '../lib/audit.mjs';
import { BUDGETS } from '../lib/contracts.mjs';
import { loadLock } from '../lib/lock.mjs';
import { log, c } from '../lib/log.mjs';

const TIERS = {
  hot: ['core/copilot-instructions.md'],
  warm: ['core/instructions', 'core/skills', 'core/agents', 'core/prompts', 'core/chatmodes'],
  cold: ['core/mcp.json', 'core/hooks'],
};

/** Scripts and references are loaded on demand, not injected as context. */
const NOT_CONTEXT = /(^|\/)(scripts|references|assets)\//;

function walk(target) {
  const abs = harnessPath(target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((e) => walk(path.join(target, e.name).split(path.sep).join('/')))
    .filter((f) => !NOT_CONTEXT.test(path.relative(harnessPath('.'), f).split(path.sep).join('/')));
}

const measure = (files) =>
  files.reduce((total, file) => total + estimateTokens(fs.readFileSync(file, 'utf8'), file), 0);

function reportSessions() {
  const lock = loadLock();
  const rows = [];
  for (const [name, entry] of Object.entries(lock.repos ?? {})) {
    const file = path.join(entry.dir, '.harness', 'sessions.jsonl');
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
      try {
        rows.push({ repo: name, ...JSON.parse(line) });
      } catch {
        // A truncated last line is expected while a session is running.
      }
    }
  }

  log.title('Sessions');
  if (rows.length === 0) {
    log.info('No sub-agent telemetry recorded yet. It appears once a session runs in VS Code.');
    return;
  }

  const byAgent = new Map();
  for (const row of rows) {
    const current = byAgent.get(row.agent) ?? { runs: 0, ms: 0, tokens: 0 };
    byAgent.set(row.agent, {
      runs: current.runs + 1,
      ms: current.ms + (row.durationMs ?? 0),
      tokens: current.tokens + (row.tokens ?? 0),
    });
  }

  log.plain(`  ${'agent'.padEnd(16)}${'runs'.padStart(6)}${'avg sec'.padStart(10)}${'tokens'.padStart(10)}`);
  for (const [agent, s] of [...byAgent.entries()].sort((a, b) => b[1].tokens - a[1].tokens)) {
    const avg = s.runs > 0 ? (s.ms / s.runs / 1000).toFixed(1) : '-';
    log.plain(`  ${agent.padEnd(16)}${String(s.runs).padStart(6)}${avg.padStart(10)}${formatTokens(s.tokens).padStart(10)}`);
  }
}

/**
 * Reports what the context surface actually costs. The number that matters is
 * "effective hot": the always-loaded file plus every instruction whose applyTo
 * matches everything. Measuring only the first understated it several times over.
 */
export default function budget(args) {
  log.title('Context budget');

  const rows = Object.entries(TIERS).map(([tier, targets]) => {
    const files = targets.flatMap(walk);
    return { tier, files: files.length, tokens: measure(files) };
  });

  const billing = {
    hot: 'every turn',
    warm: 'on glob or relevance match',
    cold: 'per session or event',
  };

  log.plain(`  ${'tier'.padEnd(8)}${'files'.padStart(7)}${'tokens'.padStart(10)}   billing`);
  for (const row of rows) {
    log.plain(
      `  ${row.tier.padEnd(8)}${String(row.files).padStart(7)}${formatTokens(row.tokens).padStart(10)}   ${c.dim(billing[row.tier])}`
    );
  }

  const { tokens: effective, files: alwaysOn } = effectiveHotTokens();
  const over = effective > BUDGETS.effectiveHotTokens;
  log.plain('');
  log.plain(
    `  effective hot ${effective}/${BUDGETS.effectiveHotTokens} tokens  ${over ? c.red('OVER BUDGET') : c.green('within budget')}`
  );
  log.plain(`  ${c.dim(`${alwaysOn.length + 1} files load on every turn: copilot-instructions.md, ${alwaysOn.join(', ')}`)}`);

  const hotBytes = fs.existsSync(harnessPath('core/copilot-instructions.md'))
    ? fs.statSync(harnessPath('core/copilot-instructions.md')).size
    : 0;
  log.plain(`  hot file ${hotBytes}/${BUDGETS.hotTierBytes} bytes`);

  log.title('Heaviest warm surfaces');
  const heavy = DIR_SURFACES.flatMap((s) => walk(s.source))
    .map((file) => ({ file, tokens: estimateTokens(fs.readFileSync(file, 'utf8'), file) }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8);

  for (const item of heavy) {
    const rel = path.relative(harnessPath('.'), item.file).split(path.sep).join('/');
    log.plain(`  ${formatTokens(item.tokens).padStart(7)}  ${item.tokens > BUDGETS.skillBodyTokens ? c.yellow(rel) : rel}`);
  }

  if (args.sessions) reportSessions();
  if (args.json) log.plain(`\n${JSON.stringify({ tiers: rows, effective, hotBytes }, null, 2)}`);

  return over ? 1 : 0;
}
