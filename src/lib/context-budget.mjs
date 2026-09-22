import fs from 'node:fs';
import path from 'node:path';
import { harnessPath } from './paths.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { estimateTokens } from './tokens.mjs';
import { generatedFiles } from './kiro-gen.mjs';

const walk = root => !fs.existsSync(root) ? [] : fs.readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(root, e.name)) : e.isFile() ? [path.join(root, e.name)] : []);
const universal = value => !value || String(value).split(/,(?![^{}]*\})/).some(p => ['**', '**/*'].includes(p.trim()));

export function contextBudget(target, root = null) {
  if (!['copilot', 'kiro'].includes(target)) throw new Error(`Unknown target: ${target}`);
  const generated = new Map(generatedFiles([target]).map(f => [f.path, f.content]));
  const read = (relative, source) => root ? (fs.existsSync(path.join(root, relative)) ? fs.readFileSync(path.join(root, relative), 'utf8') : null) :
    generated.get(relative) ?? (source && fs.existsSync(harnessPath(source)) ? fs.readFileSync(harnessPath(source), 'utf8') : null);
  const files = [], conditional = [];
  const add = (name, text, expandedFrom = null) => { if (text !== null) files.push({ path: name, estimatedTokens: estimateTokens(text, name), ...(expandedFrom ? { expandedFrom } : {}) }); };
  add('AGENTS.md', read('AGENTS.md', 'core/AGENTS.md'));
  if (target === 'copilot') add('.github/copilot-instructions.md', read('.github/copilot-instructions.md', 'core/copilot-instructions.md'));
  const folder = target === 'kiro' ? '.kiro/steering' : '.github/instructions';
  const candidates = root ? walk(path.join(root, folder)).filter(f => f.endsWith('.md')).map(f => path.relative(root, f).split(path.sep).join('/')) :
    target === 'kiro' ? [...generated.keys()].filter(f => f.startsWith(folder + '/')) : walk(harnessPath('core/instructions')).map(f => folder + '/' + path.basename(f));
  function expand(text, trail = []) {
    return text.replace(/#\[\[file:([^\]]+)\]\]/g, (_, relative) => {
      if (trail.includes(relative)) throw new Error(`Cyclic context include: ${relative}`);
      const absolute = root ? path.resolve(root, relative) : harnessPath(relative.replace('.kiro/harness/', 'core/'));
      if (!fs.existsSync(absolute)) throw new Error(`Missing context include: ${relative}`);
      return expand(fs.readFileSync(absolute, 'utf8'), [...trail, relative]);
    });
  }
  for (const name of candidates) {
    const text = read(name, 'core/instructions/' + path.basename(name));
    const { data, body } = parseFrontmatter(text);
    const active = target === 'kiro' ? !data.inclusion || data.inclusion === 'always' : universal(data.applyTo);
    if (active) add(name, expand(body));
    else conditional.push({ path: name, estimatedTokens: estimateTokens(body, name), scope: data.applyTo ?? data.fileMatchPattern ?? data.inclusion });
  }
  const skillRoot = root ? path.join(root, target === 'kiro' ? '.kiro/skills' : '.github/skills') : harnessPath('core/skills');
  const catalog = walk(skillRoot).filter(f => path.basename(f) === 'SKILL.md').map(f => {
    const { data } = parseFrontmatter(fs.readFileSync(f, 'utf8'));
    return `${data.name}: ${data.description}`;
  });
  const estimatedTokens = files.reduce((sum, f) => sum + f.estimatedTokens, 0);
  const agentsTokens = files.find(f => f.path === 'AGENTS.md')?.estimatedTokens ?? 0;
  const customAgentBaseEstimatedTokens=target === 'kiro' ? estimatedTokens+agentsTokens : estimatedTokens;
  const agentFolder=target==='kiro'?'.kiro/agents':'.github/agents';
  const agentSources=root ? walk(path.join(root,agentFolder)).filter(p=>p.endsWith(target==='kiro'?'.json':'.agent.md')).map(p=>({name:path.basename(p),text:fs.readFileSync(p,'utf8')})) :
    target==='kiro' ? [...generated].filter(([p])=>p.startsWith(agentFolder+'/')).map(([name,text])=>({name,text})) :
    walk(harnessPath('core/agents')).map(p=>({name:path.basename(p),text:fs.readFileSync(p,'utf8')}));
  const agentContexts=agentSources.map(({name,text})=>{
    const prompt=target==='kiro'?JSON.parse(text).prompt:parseFrontmatter(text).body;
    const promptEstimatedTokens=estimateTokens(prompt,'prompt.md');
    return {name,promptEstimatedTokens,totalEstimatedTokens:customAgentBaseEstimatedTokens+promptEstimatedTokens};
  });
  const maxActiveEstimatedTokens=Math.max(customAgentBaseEstimatedTokens,...agentContexts.map(a=>a.totalEstimatedTokens));
  return { target, source: root ? path.resolve(root) : 'authored/generated harness', measurement: 'estimated', files, estimatedTokens,
    // Custom Kiro resources explicitly include AGENTS.md. Count again conservatively
    // rather than assuming the runtime deduplicates native steering and resources.
    customAgentBaseEstimatedTokens, agentContexts, maxActiveEstimatedTokens,
    conditional, skillCatalogEstimatedTokens: estimateTokens(catalog.join('\n'), 'catalog.md'),
    toolCatalogTokens: null, projectContextTokens: null, providerTokens: null };
}
