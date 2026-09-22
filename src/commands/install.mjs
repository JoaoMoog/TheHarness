import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DIRS, harnessPath } from '../lib/paths.mjs';
import { mergedSurfaces, prunableDirs } from '../lib/targets.mjs';
import { generatedFiles } from '../lib/kiro-gen.mjs';
import { createLink, removeLink } from '../fs/link.mjs';
import { managedPath, writeManaged, removeManaged, pruneEmpty, ownsLink } from '../fs/managed.mjs';
import { writeExclude, clearExclude, isGitRepo } from '../fs/gitexclude.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { installGitHook } from './githook.mjs';
import { log } from '../lib/log.mjs';

const slash = p => p.split(path.sep).join('/');
function treeFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? treeFiles(path.join(dir, e.name), prefix + e.name + '/') :
    e.isFile() ? [{ source: path.join(dir, e.name), relative: prefix + e.name }] : []);
}

export function installRepo(repo, previous = {}) {
  if (!fs.existsSync(repo.dir)) throw new Error(`Directory missing: ${repo.dir}`);
  const mode = repo.settings.mode;
  if (!['link', 'vendor'].includes(mode)) throw new Error(`Unknown installation mode ${mode}`);
  const targets = repo.settings.targets ?? ['copilot'];
  const surfaces = mergedSurfaces(targets);
  const generated = generatedFiles(targets);
  const wanted = new Map();
  for (const surface of surfaces.fileSurfaces) wanted.set(surface.target, { kind: 'files', content: fs.readFileSync(harnessPath(surface.source)) });
  if (mode === 'vendor') {
    const stacks = new Set((repo.stacks ?? []).flatMap(s => s === 'node' ? ['node', 'node-ts'] : [s]));
    for (const surface of surfaces.dirSurfaces) for (const file of treeFiles(harnessPath(surface.source))) {
      const stack = /^stack-(.+)\.instructions\.md$/.exec(file.relative)?.[1];
      if (stack && !stacks.has(stack)) continue;
      if (surface.source === 'core/skills') {
        const skill = file.relative.split('/')[0];
        const metadata = parseFrontmatter(fs.readFileSync(harnessPath('core/skills', skill, 'SKILL.md'), 'utf8')).data;
        if (metadata.stacks?.length && !metadata.stacks.some(s => stacks.has(s))) continue;
      }
      wanted.set(surface.target + '/' + file.relative, { kind: 'vendored', content: fs.readFileSync(file.source) });
    }
  }
  for (const file of generated) wanted.set(file.path, { kind: 'generated', content: file.content });
  const desiredLinks = new Map(mode === 'link' ? surfaces.dirSurfaces.map(s => [s.target, harnessPath(s.source)]) : []);
  const entry = { dir: slash(path.resolve(repo.dir)), targets, mode, links: {}, files: {}, vendored: {}, generated: {}, conflicts: [],
    createdDirs: [...new Set([...(previous.createdDirs ?? []), ...prunableDirs(targets).filter(d => !fs.existsSync(path.join(repo.dir, d)))])] };
  const conflict = (name, reason) => { entry.conflicts.push({ path: name, reason }); log.warn(`${repo.name}/${name}: ${reason}; preserved`); };
  const old = { ...previous.files, ...previous.vendored, ...previous.generated };

  // Remove retired/converted content only when its hash or link identity still matches.
  for (const [relative, source] of Object.entries(previous.links ?? {})) {
    if (desiredLinks.has(relative) && path.resolve(desiredLinks.get(relative)) === path.resolve(source)) continue;
    const full = managedPath(repo.dir, relative);
    if (ownsLink(full, source)) removeLink(full);
    else if (fs.existsSync(full)) { entry.links[relative] = source; conflict(relative, 'managed link was replaced'); }
  }
  for (const [relative, hash] of Object.entries(old)) {
    if (wanted.has(relative)) continue;
    if (!removeManaged(repo.dir, relative, hash)) { entry.files[relative] = hash; conflict(relative, 'retired file was modified'); }
  }
  for (const surface of surfaces.dirSurfaces) if (mode === 'link') pruneEmpty(repo.dir, surface.target);
  for (const [relative, source] of desiredLinks) {
    const result = createLink(source, managedPath(repo.dir, relative));
    if (result.status === 'refused') conflict(relative, result.reason);
    else entry.links[relative] = slash(source);
  }
  for (const [relative, file] of wanted) {
    const result = writeManaged(repo.dir, relative, file.content, old[relative] ?? null);
    if (result.conflict) {
      if (old[relative]) entry[file.kind][relative] = old[relative];
      conflict(relative, result.conflict);
    } else entry[file.kind][relative] = result.hash;
  }
  if (isGitRepo(repo.dir)) {
    if (mode === 'link') writeExclude(repo.dir, [...Object.keys(entry.links), ...Object.keys(entry.files), ...Object.keys(entry.generated), ...RUNTIME_DIRS]);
    else clearExclude(repo.dir);
    if (repo.settings.gitHooks) {
      const hook=installGitHook(repo.dir,previous.gitHookHash);
      entry.gitHookHash=hook.hash ?? previous.gitHookHash ?? null;
      if(hook.status!=='installed') conflict('pre-commit','hook '+hook.status);
    } else if(previous.gitHookHash) entry.gitHookHash=previous.gitHookHash;
  }
  entry.installedAt = new Date().toISOString();
  log.info(`${repo.name}: ${mode} ${targets.join('+')}, ${entry.conflicts.length} conflict(s)`);
  return entry;
}
