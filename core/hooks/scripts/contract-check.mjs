#!/usr/bin/env node
/**
 * SubagentStop: checks that a phase agent returned the handoff envelope its
 * contract promises.
 *
 * Every phase agent must end its response with a fenced block:
 *
 *   ```harness-handoff
 *   stage: specify
 *   status: complete
 *   artifacts: specs/007-export-csv/spec.md
 *   summary: one paragraph, at most 200 words
 *   next: plan
 *   ```
 *
 * This warns rather than blocks. A malformed envelope is a contract defect
 * worth surfacing; killing the sub-agent mid-session would turn a formatting
 * mistake into lost work.
 */
import fs from 'node:fs';
import { readHookInput, isHookMode, emit, EXIT_OK } from './lib/io.mjs';

const REQUIRED = ['stage', 'status', 'summary'];
const FENCE = /```harness-handoff\s*\n([\s\S]*?)```/g;
const MAX_SUMMARY_WORDS = 200;

function lastEnvelope(text) {
  let match;
  let last = null;
  while ((match = FENCE.exec(text)) !== null) last = match[1];
  if (!last) return null;
  // A field runs until the next "word:" line, so a summary wrapped across
  // lines keeps every line. Counting only the first let 400 words pass as 14.
  const fields = {};
  let current = null;
  for (const line of last.split(/\r?\n/)) {
    const pair = /^([a-z][a-zA-Z]*)\s*:\s*(.*)$/.exec(line);
    if (pair) {
      current = pair[1].toLowerCase();
      fields[current] = pair[2].trim();
    } else if (current && line.trim()) {
      fields[current] = (fields[current] + " " + line.trim()).trim();
    }
  }
  return fields;
}

function readTranscript(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

const input = await readHookInput();
if (!isHookMode(input)) process.exit(EXIT_OK);

const agent = input.agent_name ?? input.subagent_name ?? 'the sub-agent';
const transcript = input.transcript_path ? readTranscript(input.transcript_path) : null;

if (transcript === null) {
  emit({
    systemMessage:
      `Could not read the transcript, so ${agent} handoff envelope was not verified. ` +
      'Confirm it returned stage, status, artifacts and summary before advancing the phase.',
  });
  process.exit(EXIT_OK);
}

const envelope = lastEnvelope(transcript);
const problems = [];

if (!envelope) {
  problems.push('no harness-handoff block was returned');
} else {
  for (const field of REQUIRED) {
    if (!envelope[field]) problems.push(`missing field: ${field}`);
  }
  const words = (envelope.summary ?? '').split(/\s+/).filter(Boolean).length;
  if (words > MAX_SUMMARY_WORDS) {
    problems.push(`summary is ${words} words, over the ${MAX_SUMMARY_WORDS} limit that keeps the parent context small`);
  }
  if (envelope.status && !['complete', 'blocked', 'escalated'].includes(envelope.status)) {
    problems.push(`status "${envelope.status}" is not one of complete, blocked, escalated`);
  }
}

if (problems.length > 0) {
  emit({
    systemMessage:
      `Handoff contract not satisfied by ${agent}: ${problems.join('; ')}. ` +
      'Do not advance the phase until the envelope is well formed; the session summary depends on it.',
  });
}
process.exit(EXIT_OK);
