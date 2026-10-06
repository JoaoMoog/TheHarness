#!/usr/bin/env node
// Explicit batch formatting only; never stages or rewrites the user's index.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMain } from './lib/io.mjs';
export function formatFiles(root, files, argv) {
  if (!Array.isArray(files) || !Array.isArray(argv) || !argv.length) throw new Error('Provide --files and --argv JSON arrays using the project formatter.');
  const selected=[...new Set(files)].map(file => {
    const full=path.resolve(root,file), base=fs.realpathSync(root);
    if (!full.startsWith(path.resolve(root)+path.sep) || !fs.realpathSync(full).startsWith(base+path.sep)) throw new Error('Formatting path escapes project: '+file);
    return full;
  });
  if (!selected.length) return {status:'not-run',reason:'No changed files'};
  // Use node + a local formatter entrypoint on Windows; no shell or automatic installation.
  const result=spawnSync(argv[0]==='node' ? process.execPath : argv[0],[...argv.slice(1),...selected],{cwd:root,encoding:'utf8',windowsHide:true,timeout:120000});
  return {status:!result.error && result.status===0 ? 'passed':'failed',exitCode:result.status,error:result.error?.message ?? null};
}
export function observe() { return null; }
if (isMain(import.meta.url)) {
  const flags=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
  if (flags.files && flags.argv) {
    const result=formatFiles(process.cwd(),JSON.parse(flags.files),JSON.parse(flags.argv));
    console.log(JSON.stringify(result)); process.exit(result.status==='failed'?1:0);
  }
}
