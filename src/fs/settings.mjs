/**
 * Writing into, and backing out of, a settings file the harness shares with
 * whoever owns the repository.
 *
 * This is a third kind of surface, next to the linked directories in link.mjs
 * and the copied files in copy.mjs: a file the harness contributes part of. It
 * cannot be a copy, because the keys around the harness's own belong to
 * somebody else and have to survive; and it cannot be a link, because the tool
 * that reads it expects one file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { mergeSettings, harnessHookSlice, stripHarnessHooks } from '../lib/claude-gen.mjs';

function readJsonFile(file) {
  if (!fs.existsSync(file)) return { existed: false, data: {} };
  try {
    return { existed: true, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { existed: true, data: null, error: err };
  }
}

/**
 * Adds the harness's hook entries and leaves everything else exactly as it was.
 * A file that is not valid JSON is refused rather than repaired: it is not the
 * harness's file to rewrite, and whoever was editing it is mid-thought.
 */
export function mergeInto(file, hooks) {
  const { existed, data, error } = readJsonFile(file);
  if (data === null) {
    return { status: 'refused', reason: `${path.basename(file)} is not valid JSON (${error.message})` };
  }

  const merged = mergeSettings(data, hooks);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return { status: existed ? 'merged' : 'created', slice: harnessHookSlice(merged) };
}

/**
 * Takes the harness's entries back out. The file survives with the rest of its
 * keys - unless the harness created it and nothing of theirs was ever added, in
 * which case an empty `{}` left behind would be litter.
 */
export function removeFrom(file, createdIt) {
  const { existed, data } = readJsonFile(file);
  if (!existed) return 'absent';
  if (data === null) return 'unreadable-kept';

  const stripped = stripHarnessHooks(data);
  if (createdIt && Object.keys(stripped).length === 0) {
    fs.rmSync(file);
    return 'removed';
  }
  fs.writeFileSync(file, `${JSON.stringify(stripped, null, 2)}\n`, 'utf8');
  return 'cleaned';
}
