import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { harnessPath } from './paths.mjs';
import { TARGETS } from './targets.mjs';

export const KIRO_EVENT = { SessionStart: 'SessionStart', UserPromptSubmit: 'PromptSubmit', PreToolUse: 'PreToolUse', PostToolUse: 'PostToolUse', Stop: 'AgentStop' };
export const UNMAPPED_EVENTS = TARGETS.kiro.unmappedEvents;
const list = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
const jsonFile = (path, value) => ({ path, content: JSON.stringify(value, null, 2) + '\n' });
const kiroText = text => text.replaceAll('.github/skills/', '.kiro/skills/').replaceAll('.github/', '.kiro/harness/');

export function steeringForInstructions() {
  return list(harnessPath('core/instructions')).filter(e => e.name.endsWith('.instructions.md')).map(e => {
    const { data, body } = parseFrontmatter(fs.readFileSync(harnessPath('core/instructions', e.name), 'utf8'));
    const globs = String(data.applyTo ?? '').split(/,(?![^{}]*\})/).map(s => s.trim()).filter(Boolean);
    const always = !globs.length || globs.some(g => g === '**' || g === '**/*');
    const fields = always ? 'inclusion: always' : `inclusion: fileMatch\nfileMatchPattern: ${JSON.stringify(globs)}`;
    return { path: `.kiro/steering/${e.name.replace('.instructions.md', '.md')}`, content: `---\n${fields}\n---\n${kiroText(body)}` };
  });
}

// Native skills include relative references/scripts; no manual steering duplicates.
export function nativeSkills() {
  const root = harnessPath('core/skills');
  const walk = (dir, prefix = '') => list(dir).flatMap(e => {
    const relative = prefix + e.name;
    return e.isDirectory() ? walk(path.join(dir, e.name), relative + '/') :
      [{ path: `.kiro/skills/${relative}`, content: kiroText(fs.readFileSync(path.join(dir, e.name), 'utf8')) }];
  });
  return walk(root);
}
export const steeringForSkills = () => [];

export function kiroDocuments() {
  const out=[];
  for(const folder of ['templates','loops']) for(const entry of list(harnessPath(folder))) {
    if(!entry.isFile())continue;
    out.push({path:'.kiro/harness/'+folder+'/'+entry.name,content:kiroText(fs.readFileSync(harnessPath(folder,entry.name),'utf8'))});
  }
  for(const entry of list(harnessPath('core/prompts')).filter(e=>e.name.endsWith('.prompt.md'))) {
    const {body}=parseFrontmatter(fs.readFileSync(harnessPath('core/prompts',entry.name),'utf8'));
    const name=entry.name.replace('.prompt.md','.md');
    const content=kiroText(body).replace(/\$\{input:[^}]+\}/g,'(use the current user request)');
    out.push({path:'.kiro/steering/'+name,content:'---\ninclusion: manual\n---\n'+content});
  }
  return out;
}

export function kiroHooks() {
  const parsed = JSON.parse(fs.readFileSync(harnessPath('core/hooks/harness.json'), 'utf8'));
  const hooks = [], dropped = [];
  for (const [event, entries] of Object.entries(parsed.hooks)) {
    const trigger = KIRO_EVENT[event];
    if (!trigger) { dropped.push(event); continue; }
    for (const entry of entries) {
      const command = kiroText(entry.command);
      hooks.push({ name: `harness-${path.basename(command.split(' ').find(p => p.endsWith('.mjs')) ?? event, '.mjs')}-${trigger}`.toLowerCase(), trigger,
        ...(entry.matcher ? { matcher: entry.matcher } : {}), timeout: entry.timeout ?? 5,
        action: { type: 'command', command: command + ' --hook-mode=kiro --hook-event=' + event } });
    }
  }
  return { hooks, dropped };
}
export const kiroHooksFile = () => jsonFile('.kiro/hooks/harness.json', { version: 'v1', hooks: kiroHooks().hooks });

const TOOL_MAP = { read: 'read', search: 'read', edit: 'write', execute: 'shell', agent: 'subagent', codebase: 'read', usages: 'read', problems: 'read', changes: 'read', editFiles: 'write', runCommands: 'shell' };
export function kiroAgents() {
  return list(harnessPath('core/agents')).filter(e => e.name.endsWith('.agent.md')).map(e => {
    const { data, body } = parseFrontmatter(fs.readFileSync(harnessPath('core/agents', e.name), 'utf8'));
    const tools = [...new Set((data.tools ?? []).filter(t => !t.includes('/')).map(t => {
      if (!TOOL_MAP[t]) throw new Error(`No Kiro mapping for tool ${t}`);
      return TOOL_MAP[t];
    }))];
    const configured=JSON.parse(mcpFile('kiro').content).mcpServers;
    const mcpServers={};
    for(const capability of data.tools ?? []) {
      if(!capability.includes('/'))continue;
      const [server,tool]=capability.split('/');
      if(configured[server]) { mcpServers[server]=configured[server]; tools.push('@'+server+(tool==='*'?'':'/'+tool)); }
    }
    const skillsSection = body.split('## Skills')[1]?.split('\n## ')[0] ?? '';
    const skills = [...skillsSection.matchAll(/`([a-z0-9-]+)`/g)].map(m => `skill://.kiro/skills/${m[1]}/SKILL.md`);
    return jsonFile(`.kiro/agents/${data.name}.json`, {
      name: data.name, description: data.description, tools, mcpServers,
      includeMcpJson: false, includePowers: false,
      resources: ['file://AGENTS.md', ...skills],
      toolsSettings: { subagent: { availableAgents: data.agents ?? [], trustedAgents: [] } },
      prompt: kiroText(body),
    });
  });
}

export function mcpFile(target, source = JSON.parse(fs.readFileSync(harnessPath('core/mcp.json'), 'utf8'))) {
  const servers = {};
  for (const [name, server] of Object.entries(source.servers ?? {})) {
    if (server.disabled) continue;
    const { owner, trust, scope, version, $comment, ...runtime } = server;
    if (target === 'kiro') {
      servers[name] = JSON.parse(JSON.stringify(runtime).replace(/\$\{env:([^}]+)\}/g, (_, key) => '${' + key + '}').replaceAll('${workspaceFolder}', '.'));
    } else servers[name] = { type: runtime.url ? 'http' : 'stdio', ...runtime };
  }
  return jsonFile(target === 'kiro' ? '.kiro/settings/mcp.json' : '.vscode/mcp.json', target === 'kiro' ? { mcpServers: servers } : { servers });
}

export function generatedFiles(targets = ['copilot', 'kiro']) {
  const budgets=fs.readFileSync(harnessPath('loops/budgets.json'),'utf8');
  return targets.flatMap(id => id === 'copilot' ? [{path:'.github/runtime/budgets.json',content:budgets},mcpFile(id)] : id === 'kiro' ?
    [{path:'.kiro/harness/runtime/budgets.json',content:budgets},...steeringForInstructions(), ...kiroDocuments(), ...nativeSkills(), ...kiroAgents(), kiroHooksFile(), mcpFile(id)] : []);
}
