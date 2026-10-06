import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { installRepo } from '../../src/commands/install.mjs';
import { uninstallRepo } from '../../src/commands/unlink.mjs';
import { hashFile } from '../../src/lib/lock.mjs';
import { managedPath } from '../../src/fs/managed.mjs';
import { contextBudget } from '../../src/lib/context-budget.mjs';
import { generatedFiles, mcpFile, kiroHooks, KIRO_EVENT } from '../../src/lib/kiro-gen.mjs';
import { verificationIdentity } from '../../core/tools/verify/identity.mjs';
import { runVerification } from '../../core/tools/verify/run.mjs';
import { recordOutcome } from '../../core/tools/verify/outcome.mjs';
import { groupSessions } from '../../src/lib/telemetry.mjs';
import { decide } from '../../core/hooks/scripts/local-only.mjs';
import { formatFiles } from '../../core/hooks/scripts/format.mjs';
import { checkTrace } from '../../evals/trace.mjs';
import { comparePilot } from '../../evals/pilot.mjs';
import { currentPhase } from '../../core/hooks/scripts/lib/session.mjs';
const write=(root,name,value)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value);};
function sandbox(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'harness-acceptance-'));
  execFileSync('git',['init','-q'],{cwd:root});
  t.after(()=>{if (!root.startsWith(path.join(os.tmpdir(),'harness-acceptance-'))) throw Error('Unexpected test path');fs.rmSync(root,{recursive:true,force:true});});
  write(root,'.gitignore','.harness/\nnode_modules/\n');
  return root;
}
for (const mode of ['vendor','link']) for (const targets of [['copilot'],['kiro'],['copilot','kiro']]) {
  test('install, update and remove '+mode+' '+targets.join('+'),t=>{
    const root=sandbox(t), repo={name:'fixture',dir:root,stacks:['node'],settings:{mode,targets,gitHooks:false}};
    let entry=installRepo(repo);
    assert.equal(entry.conflicts.length,0);
    const toolBase=targets.includes('copilot')?'.github':'.kiro/harness';
    const executed=spawnSync(process.execPath,[path.join(root,toolBase,'tools/verify/run.mjs'),'--argv='+JSON.stringify(['node','-e','process.exit(0)'])],{cwd:root,encoding:'utf8'});
    assert.equal(executed.status,0,executed.stderr);
    const evidence=JSON.parse(executed.stdout);
    assert.equal(evidence.status,'passed');
    const outcome=spawnSync(process.execPath,[path.join(root,toolBase,'tools/verify/outcome.mjs'),'--session=install-test','--status=validated','--records='+JSON.stringify([evidence.record])],{cwd:root,encoding:'utf8'});
    assert.equal(outcome.status,0,outcome.stderr);
    assert.equal(JSON.parse(outcome.stdout).status,'validated');
    for (const target of targets) {
      const b=contextBudget(target,root);
      assert.ok(b.customAgentBaseEstimatedTokens<=2000);
      assert.ok(b.files.some(f=>f.path==='AGENTS.md'));
    }
    const mcp=targets.includes('kiro')?'.kiro/settings/mcp.json':'.vscode/mcp.json';
    write(root,mcp,'{"old":true}');entry.generated[mcp]=hashFile(path.join(root,mcp));
    entry=installRepo(repo,entry);assert.equal(entry.conflicts.length,0);
    assert.ok(!fs.readFileSync(path.join(root,mcp),'utf8').includes('"old"'));
    write(root,mcp,'{"user":"custom"}');
    const next=installRepo(repo,entry);
    assert.ok(next.conflicts.some(c=>c.path===mcp));
    uninstallRepo('fixture',next);
    assert.equal(fs.readFileSync(path.join(root,mcp),'utf8'),'{"user":"custom"}');
    assert.ok(!fs.existsSync(path.join(root,'AGENTS.md')));
  });
}
test('mode transitions and retired files preserve user content',t=>{
  const root=sandbox(t),repo={name:'transition',dir:root,stacks:['node'],settings:{mode:'vendor',targets:['copilot','kiro'],gitHooks:false}};
  let entry=installRepo(repo);
  const legacy='.kiro/steering/skill-old.md',custom='.kiro/steering/user.md';
  write(root,legacy,'old generated');entry.generated[legacy]=hashFile(path.join(root,legacy));
  write(root,custom,'personal steering');
  repo.settings.mode='link';entry=installRepo(repo,entry);assert.equal(entry.conflicts.length,0);
  assert.ok(!fs.existsSync(path.join(root,legacy)));
  repo.settings.mode='vendor';entry=installRepo(repo,entry);assert.equal(entry.conflicts.length,0);
  uninstallRepo('transition',entry);
  assert.equal(fs.readFileSync(path.join(root,custom),'utf8'),'personal steering');
});
test('foreign surfaces and path escapes are refused',t=>{
  const root=sandbox(t);write(root,'AGENTS.md','user rules');
  const entry=installRepo({name:'foreign',dir:root,settings:{mode:'vendor',targets:['copilot']}});
  assert.ok(entry.conflicts.some(c=>c.path==='AGENTS.md'));
  assert.equal(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8'),'user rules');
  assert.throws(()=>managedPath(root,'../outside'));
});
test('adapters emit native skills, agents, MCP variables and hook timeouts',()=>{
  const files=new Map(generatedFiles().map(f=>[f.path,f.content]));
  assert.ok(files.has('.kiro/skills/playwright-testing/SKILL.md'));
  assert.ok(files.has('.kiro/steering/feature.md'));
  assert.ok(files.has('.kiro/harness/templates/plan.md'));
  assert.ok(!files.get('.kiro/harness/loops/verify.md').includes('.github/'));
  assert.ok(!files.has('.kiro/steering/skill-playwright-testing.md'));
  const agent=JSON.parse(files.get('.kiro/agents/orchestrator.json'));
  assert.ok(agent.tools.includes('subagent'));
  assert.deepEqual(agent.toolsSettings.subagent.availableAgents,['planner','implementer','reviewer','security']);
  const source={servers:{example:{command:'node',args:['x'],env:{KEY:'$'+'{env:KEY}'},owner:'me'},disabled:{disabled:true}}};
  assert.equal(JSON.parse(mcpFile('kiro',source).content).mcpServers.example.env.KEY,'$'+'{KEY}');
  assert.equal(JSON.parse(mcpFile('copilot',source).content).servers.example.env.KEY,'$'+'{env:KEY}');
  assert.equal(Object.keys(JSON.parse(mcpFile('kiro',source).content).mcpServers).length,1);
  const original=JSON.parse(fs.readFileSync('core/hooks/harness.json','utf8'));
  const generated=kiroHooks();
  for(const hook of generated.hooks) {
    const match=Object.entries(original.hooks).filter(([event])=>KIRO_EVENT[event]===hook.trigger).flatMap(([,entries])=>entries).find(h=>hook.action.command.includes(path.basename(h.command.split(' ').find(a=>a.endsWith('.mjs')))));
    assert.equal(hook.timeout,match.timeout);
    assert.ok(!hook.action.command.includes('dream-collect'));
  }
  assert.ok(generated.dropped.includes('SubagentStop'));
});
test('context counts AGENTS and repeated expanded includes separately',t=>{
  const root=sandbox(t);write(root,'AGENTS.md','root instruction '.repeat(100));write(root,'shared.md','shared instruction '.repeat(100));
  for(const name of ['one','two']) write(root,'.kiro/steering/'+name+'.md','---\ninclusion: always\n---\n#[[file:shared.md]]');
  const result=contextBudget('kiro',root);
  assert.equal(result.files.length,3);
  assert.equal(result.files[1].estimatedTokens,result.files[2].estimatedTokens);
  assert.equal(result.customAgentBaseEstimatedTokens,result.estimatedTokens+result.files[0].estimatedTokens);
});
test('verification reuse checks content, command, environment and configuration',t=>{
  const root=sandbox(t);write(root,'code.txt','one');
  const argv=['node','-e','process.exit(0)'],initial=runVerification({root,argv});
  assert.equal(initial.status,'passed');assert.equal(initial.cacheable,true);
  assert.equal(runVerification({root,argv,reuse:true}).reused,true);
  write(root,'specs/001-test/session.md','phase: review');
  assert.equal(runVerification({root,argv,reuse:true}).reused,true);
  write(root,'code.txt','two');assert.equal(runVerification({root,argv,reuse:true}).reused,false);
  assert.notEqual(verificationIdentity(root,argv).key,verificationIdentity(root,[...argv,'changed']).key);
  assert.notEqual(verificationIdentity(root,argv).key,verificationIdentity(root,argv,'other browser version').key);
  const before=verificationIdentity(root,argv).key;write(root,'.env.test','MODE=test');
  assert.notEqual(verificationIdentity(root,argv).key,before);
  assert.throws(()=>recordOutcome({root,session:'old',status:'validated',records:[initial.record]}),/stale/);
});
test('failure and missing prerequisites cannot become a validated outcome',t=>{
  const root=sandbox(t),bad=runVerification({root,argv:['node','-e','process.exit(2)']});
  assert.equal(bad.status,'failed');
  assert.throws(()=>recordOutcome({root,session:'failed',status:'validated',records:[bad.record]}));
  assert.equal(runVerification({root,argv:['a-harness-missing-executable']}).status,'blocked');
  const good=runVerification({root,argv:['node','-e','process.exit(0)']});
  assert.throws(()=>recordOutcome({root,session:'feature',status:'validated',track:'feature',records:[good.record]}),/review/);
  assert.equal(recordOutcome({root,session:'direct',status:'validated',records:[good.record]}).status,'validated');
});
test('telemetry requires explicit outcome and preserves missing measurements',()=>{
  const rows=[{session:'s',at:'2026-09-20T10:00:00Z',event:'session-start'},{session:'s',at:'2026-09-20T10:00:01Z',agent:'reviewer',durationMs:900}];
  assert.equal(groupSessions(rows)[0].outcome,'unknown');
  assert.equal(groupSessions([rows[0]])[0].track,'unknown');
  rows.push({session:'s',at:'2026-09-20T10:00:02Z',event:'outcome',status:'validated',track:'direct'});
  const s=groupSessions(rows)[0];assert.equal(s.outcome,'validated');assert.equal(s.durationMs,2000);
  assert.equal(s.tokens,null);assert.equal(s.toolDurationMs,null);assert.equal(s.approvalWaitMs,null);
});
test('publication blocked for agents, read allowed, legacy sessions resume review',()=>{
  for(const command of ['git add .','git commit -m x','git -C "path with spaces" push origin main','gh pr create','az pipelines run --name CI','npm publish'])
    assert.equal(decide({tool_name:'terminal',tool_input:{command}})?.decision,'deny',command);
  assert.equal(decide({tool_name:'terminal',tool_input:{command:'git diff --stat'}}),null);
  assert.equal(currentPhase('phase: deliver\nhistory: preserved'),'review');
});
test('formatter changes working files and preserves staged index',t=>{
  const root=sandbox(t);write(root,'a.txt','staged');execFileSync('git',['add','a.txt'],{cwd:root});write(root,'a.txt','unstaged');write(root,'b.txt','untouched');
  assert.equal(formatFiles(root,['a.txt'],['node','-e',"require('fs').writeFileSync(process.argv[1],'formatted')"]).status,'passed');
  assert.equal(fs.readFileSync(path.join(root,'a.txt'),'utf8'),'formatted');
  assert.equal(execFileSync('git',['show',':a.txt'],{cwd:root,encoding:'utf8'}),'staged');
  assert.equal(fs.readFileSync(path.join(root,'b.txt'),'utf8'),'untouched');
});

test('Kiro returns nonzero to block and normalizes its own event names',t=>{
  const root=sandbox(t),script=path.resolve('core/hooks/scripts/tool-hooks.mjs');
  const blocked=spawnSync(process.execPath,[script,'--hook-mode=kiro','--hook-event=PreToolUse'],{
    cwd:root,encoding:'utf8',input:JSON.stringify({tool_name:'shell',tool_input:{command:'git push'}})});
  assert.equal(blocked.status,2);assert.match(blocked.stderr,/manual/);
  const stop=spawnSync(process.execPath,[path.resolve('core/hooks/scripts/audit-log.mjs'),'--hook-mode=kiro','--hook-event=Stop'],{
    cwd:root,encoding:'utf8',input:JSON.stringify({hook_event_name:'AgentStop',session_id:'s'})});
  assert.equal(stop.status,0);
});
test('behavior traces reject ceremony, stale/failing checks and premature approval',()=>{
  const direct={scenario:'text',lane:'direct',outcome:'validated',actions:[{type:'edit'}],artifacts:[],
    checks:[{kind:'text',status:'passed',command:'node check',evidence:'check.json',identity:'a'.repeat(64)}]};
  assert.equal(checkTrace(direct).ok,true);
  assert.equal(checkTrace({...direct,actions:[{type:'edit'},{type:'subagent'}]}).ok,false);
  assert.equal(checkTrace({...direct,actions:[{type:'edit'},{type:'push'}]}).ok,false);
  assert.equal(checkTrace({...direct,checks:[{...direct.checks[0],status:'failed'}]}).ok,false);
  const feature={scenario:'structured',lane:'structured',outcome:'validated',
    actions:[{type:'approval',scope:'plan'},{type:'edit'},{type:'review',independent:true,verdict:'approve'}],
    artifacts:['requirements','plan','tasks'].map(kind=>({kind,path:kind+'.md',sha256:'a'.repeat(64)})),
    checks:[{...direct.checks[0],kind:'integration'}]};
  assert.equal(checkTrace(feature).ok,true);
  assert.equal(checkTrace({...feature,artifacts:[]}).ok,false);
  assert.equal(checkTrace({...feature,actions:[{type:'edit'},...feature.actions]}).ok,false);
  const sensitive={...direct,scenario:'sensitive',lane:'sensitive',
    actions:[{type:'approval',scope:'sensitive'},{type:'edit'}],checks:[{...direct.checks[0],kind:'security'}]};
  assert.equal(checkTrace(sensitive).ok,true);
  assert.equal(checkTrace({...sensitive,actions:[{type:'edit'}]}).ok,false);
});
test('pilot refuses incomplete or mismatched samples and does not invent token savings',()=>{
  assert.equal(comparePilot([]).status,'pending');
  const rows=[];
  for(const client of ['copilot','kiro'])for(const task of ['text','regression','web'])for(const phase of ['before','after'])for(const repetition of [1,2,3])
    rows.push({client,task,phase,repetition,model:'same',modelVersion:'v',editorVersion:'1',configuration:'hash',initialState:'abc',
      outcome:'validated',criteriaPassed:true,guardrailsPassed:true,traceFile:'record.json',durationMs:phase==='before'?100:40,measuredTokens:null,subagents:0,phaseApprovals:0});
  const result=comparePilot(rows);
  assert.equal(result.status,'complete');assert.equal(result.results[0].duration.reductionPercent,60);assert.equal(result.results[0].tokens,null);
  rows[0].model='different';assert.equal(comparePilot(rows).status,'pending');
});
test('explicit directory inputs invalidate evidence when nested content changes',t=>{
  const root=sandbox(t);write(root,'ignored/settings.json','one');
  const first=verificationIdentity(root,[],'',['ignored']).key;
  write(root,'ignored/settings.json','two');
  assert.notEqual(verificationIdentity(root,[],'',['ignored']).key,first);
});

test('managed Git hooks preserve local edits and vendor hooks use project scripts',t=>{
  const root=sandbox(t),repo={name:'hooks',dir:root,settings:{mode:'vendor',targets:['kiro'],gitHooks:true}};
  let entry=installRepo(repo);assert.equal(entry.conflicts.length,0);assert.ok(entry.gitHookHash);
  const hook=path.join(root,'.git/hooks/pre-commit');
  const body=fs.readFileSync(hook,'utf8');
  assert.match(body,/\.kiro\/harness\/hooks\/scripts/);assert.doesNotMatch(body,/git add/);
  fs.appendFileSync(hook,'\n# personal check\n');
  entry=installRepo(repo,entry);assert.ok(entry.conflicts.some(c=>c.path==='pre-commit'));
  uninstallRepo('hooks',entry);assert.match(fs.readFileSync(hook,'utf8'),/personal check/);
});
