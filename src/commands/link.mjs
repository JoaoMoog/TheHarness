import { loadConfigOrExit, selectedRepos } from '../lib/config.mjs';
import { loadLock, saveLock, recordRepo } from '../lib/lock.mjs';
import { installRepo } from './install.mjs';
import { log } from '../lib/log.mjs';

/**
 * Installs the harness into the selected repositories. The lock is saved after
 * every repository, not at the end: an exception on the seventh repository must
 * not leave the first six installed with no record of how to remove them.
 */
export default function link(args) {
  const cfg = loadConfigOrExit();
  const only = args._[0] ?? null;
  if (!only && !args.all) throw new Error('Specify a repository name or pass --all.');

  const repos = selectedRepos(cfg, { only });
  if (repos.length === 0) {
    throw new Error(only ? `Unknown or skipped repository: ${only}` : 'No repositories selected.');
  }

  const override = args.mode ?? null;
  if (override && override !== 'link' && override !== 'vendor') {
    throw new Error(`Unknown mode: ${override}. Use link or vendor.`);
  }

  log.step(`Installing harness into ${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'}`);
  let lock = loadLock();
  let installed = 0;
  const failures = [];

  for (const repo of repos) {
    const effective = override ? { ...repo, settings: { ...repo.settings, mode: override } } : repo;
    try {
      const entry = installRepo(effective, lock.repos[repo.name] ?? {}, { force: Boolean(args.force) });
      if (entry) {
        lock = recordRepo(lock, repo.name, entry);
        saveLock(lock);
        installed += 1;
      } else {
        failures.push(repo.name);
      }
    } catch (err) {
      // Record nothing for this repository, keep what the others achieved, and
      // report at the end rather than losing the whole run to one bad repo.
      failures.push(`${repo.name}: ${err.message}`);
      log.fail(`${repo.name}: ${err.message}`);
      saveLock(lock);
    }
  }

  log.plain('');
  log.ok(`${installed} of ${repos.length} repositories installed.`);
  if (failures.length > 0) {
    log.warn(`${failures.length} failed: ${failures.join(', ')}`);
  }
  log.info('Run "harness doctor" to verify.');
  return failures.length === 0 ? 0 : 1;
}
