#!/usr/bin/env node
/**
 * Guardrail: keeps credential-bearing files out of the agent context.
 *
 * policy-gate stops a secret from being committed. That is too late for the
 * other failure: an agent reads .env to "understand the config", the values
 * land in the transcript, and from there into a summary, a PR body, or a log.
 * Content exclusion has to happen at the read, so this runs before read tools.
 *
 * It denies rather than asks. There is no legitimate reason for an agent to
 * hold a live credential; a human who needs the value opens the file.
 *
 * Runs inside tool-hooks.mjs on every tool call, and on its own for Kiro and
 * the self-test.
 */
import fs from 'node:fs';
import {
  readHookInput, isHookMode, toolFilePath, collectStrings, verdict, emitVerdict, isMain, EXIT_OK,
} from './lib/io.mjs';
import { forbiddenPath } from './lib/patterns.mjs';

const HEAD_BYTES = 512;

/** Reads only the head of the file, so a large binary cannot stall the hook. */
function head(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      const buf = Buffer.alloc(HEAD_BYTES);
      const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
      return buf.subarray(0, n).toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

/** A deny when any path in the payload is a credential file; null otherwise. */
export function decide(input) {
  // The path field is not guaranteed, so fall back to any string that looks like one.
  const candidates = [toolFilePath(input), ...collectStrings(input.tool_input)].filter(
    (s) => typeof s === 'string' && /[\/.]/.test(s) && s.length < 512
  );
  const hit = candidates.map((p) => ({ p, rule: forbiddenPath(p, head) })).find((c) => c.rule);
  return hit
    ? verdict.deny(
        `Not reading ${hit.p}: it is a ${hit.rule.why}, and its values would land in the ` +
          'transcript and everything derived from it. If a value is needed, a person opens ' +
          'the file. If the shape is needed, read the .example file or the schema instead.'
      )
    : null;
}

if (isMain(import.meta.url)) {
  const input = await readHookInput();
  if (!isHookMode(input)) process.exit(EXIT_OK);
  process.exit(emitVerdict('PreToolUse', decide(input)));
}
