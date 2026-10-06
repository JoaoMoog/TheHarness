import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const reportOnly = p => p.startsWith('.harness/') || /^(?:\.kiro\/)?specs\/\d{3}-[^/]+\/session\.md$/.test(p);
export function repositoryRoot(cwd = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

export function verificationIdentity(root, argv = [], environment = '', inputs = []) {
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\0').filter(Boolean).map(p => p.split(path.sep).join('/'));
  const extra = ['node_modules/.package-lock.json', '.env', '.env.local', '.env.test', '.env.test.local', ...inputs];
  const hash = crypto.createHash('sha256');
  let visitedFiles=0;
  function hashPath(full, ancestors=new Set()) {
    if(++visitedFiles>100000) throw new Error('Verification input too large; use a bounded project checkout');
    const stat=fs.lstatSync(full);
    if(stat.isSymbolicLink()) hash.update('link:'+fs.readlinkSync(full));
    const real=fs.realpathSync(full);
    if(fs.statSync(full).isDirectory()) {
      if(ancestors.has(real)) throw new Error('Cyclic verification input: '+full);
      const next=new Set([...ancestors,real]);
      for(const name of fs.readdirSync(full).filter(n=>n!=='.git').sort()) {
        hash.update(name).update('\0'); hashPath(path.join(full,name),next);
      }
    } else if(stat.isFile() || stat.isSymbolicLink()) hash.update(fs.readFileSync(full));
    hash.update('\0');
  }
  for (const name of [...new Set([...names.filter(p => !reportOnly(p)), ...extra])].sort()) {
    const full = path.resolve(root, name);
    if (!full.startsWith(path.resolve(root) + path.sep)) throw new Error(`Verification input escapes repository: ${name}`);
    hash.update(name).update('\0');
    if (!fs.existsSync(full)) { hash.update('absent\0'); continue; }
    hashPath(full);
  }
  const content = hash.digest('hex');
  const env = Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b));
  const runtime = digest(JSON.stringify({ root: fs.realpathSync(root), node: process.version, executable: process.execPath, platform: process.platform, arch: process.arch, env, environment }));
  return { content, environment: runtime, key: digest(JSON.stringify({ content, runtime, argv, inputs })) };
}
