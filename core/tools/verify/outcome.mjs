#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot, verificationIdentity } from './identity.mjs';

export function recordOutcome({ root = repositoryRoot(), session, status, records = [], reason = '', track = 'direct', review = null }) {
  if (typeof session !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(session)) throw new Error('A session id is required');
  if (!['validated', 'failed', 'blocked', 'not-run'].includes(status)) throw new Error('Unknown outcome status');
  if (status === 'validated' && !records.length) throw new Error('Validated requires at least one actual verification record');
  if (status === 'validated' && track !== 'direct' && !['approve', 'approve-with-comments'].includes(review)) throw new Error('Structured work requires an independent review verdict');
  if (status !== 'validated' && !reason) throw new Error('An incomplete outcome needs a reason');
  const evidence = [];
  for (const name of records) {
    const full = path.resolve(root, name);
    const directory = path.join(path.resolve(root), '.harness', 'verification') + path.sep;
    if (!full.startsWith(directory) || !full.endsWith('.json')) throw new Error('Evidence must be a local verification record');
    if (!fs.realpathSync(full).startsWith(fs.realpathSync(path.join(root,'.harness','verification'))+path.sep)) throw new Error('Evidence escapes verification directory');
    const record = JSON.parse(fs.readFileSync(full, 'utf8'));
    const current = verificationIdentity(root, record.argv, record.environmentLabel, record.inputs);
    if (status === 'validated' && (record.status !== 'passed' || !record.cacheable || current.key !== record.identity.key)) throw new Error('Required verification is failed, stale or not reusable');
    evidence.push(path.relative(root, full).split(path.sep).join('/'));
  }
  const record = { version: 2, at: new Date().toISOString(), event: 'outcome', session, status, track, review, evidence, reason };
  const dir = path.join(root, '.harness'); fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'sessions.jsonl'), JSON.stringify(record) + '\n');
  return record;
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  try {
    const args = Object.fromEntries(process.argv.slice(2).map(v => { const i = v.indexOf('='); return [v.slice(2, i), v.slice(i + 1)]; }));
    console.log(JSON.stringify(recordOutcome({ session: args.session, status: args.status, records: JSON.parse(args.records ?? '[]'), reason: args.reason, track: args.track ?? 'direct', review: args.review })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
