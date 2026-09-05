import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TARGETS, DEFAULT_TARGET } from './targets.mjs';

/** Repository root of the harness itself (two levels up from src/lib). */
export const HARNESS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

/**
 * Directory surfaces are linked (junction on Windows, symlink on POSIX) so an
 * edit in the harness is live in every target repository with no sync step.
 * Single files are copied instead: a file symlink on Windows requires
 * elevation and a junction cannot point at a file, so drift is caught by hash.
 *
 * These two are the default target's surfaces. A repository wired for another
 * tool gets its map from targets.mjs; these exports stay so every existing
 * caller keeps working unchanged.
 */
export const DIR_SURFACES = TARGETS[DEFAULT_TARGET].dirSurfaces;
export const FILE_SURFACES = TARGETS[DEFAULT_TARGET].fileSurfaces;

/** Runtime state the hooks write inside a target repository; never committed. */
export const RUNTIME_DIRS = ['.harness'];

export const ALL_TARGETS = [
  ...DIR_SURFACES.map((s) => s.target),
  ...FILE_SURFACES.map((s) => s.target),
];

export const harnessPath = (...parts) => path.join(HARNESS_ROOT, ...parts);
