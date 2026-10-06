import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { median } from '../src/lib/telemetry.mjs';
export function comparePilot(records) {
  const results=[], problems=[];
  for(const client of ['copilot','kiro'])for(const task of ['text','regression','web']){
    const rows=records.filter(r=>r.client===client && r.task===task),before=rows.filter(r=>r.phase==='before'),after=rows.filter(r=>r.phase==='after');
    const complete=[before,after].every(set=>set.length===3 && new Set(set.map(r=>r.repetition)).size===3 && set.every(r=>[1,2,3].includes(r.repetition)));
    const identityKeys=['model','modelVersion','editorVersion','configuration','initialState'];
    const comparable=complete && identityKeys.every(k=>rows.every(r=>typeof r[k]==='string' && r[k].length>0 && r[k]===rows[0][k]));
    const quality=complete && rows.every(r=>r.outcome==='validated' && r.criteriaPassed===true && r.guardrailsPassed===true && r.traceFile);
    function reduction(key){
      if(!comparable || !rows.every(r=>Number.isFinite(r[key]) && r[key]>=0))return null;
      const b=median(before.map(r=>r[key])),a=median(after.map(r=>r[key]));
      return b>0 ? {beforeMedian:b,afterMedian:a,reductionPercent:100*(b-a)/b}:null;
    }
    const duration=reduction('durationMs'),tokens=reduction('measuredTokens');
    const ceremony=complete && after.every(r=>r.subagents===0 && r.phaseApprovals===0);
    const accepted=quality && ceremony && comparable;
    if(!accepted)problems.push(client+'/'+task+': incomplete, incomparable or missing quality evidence');
    results.push({client,task,complete,comparable,quality,ceremony,duration,tokens,accepted,
      timeGoal:duration ? duration.reductionPercent>=50:null,tokenGoal:tokens ? tokens.reductionPercent>=40:null});
  }
  return {version:1,status:problems.length?'pending':'complete',results,problems,note:'Targets are experimental goals. Null is unavailable, never zero or an inferred bill.'};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const input=JSON.parse(fs.readFileSync(process.argv[2] ?? 'docs/pilot-samples.json','utf8'));
  console.log(JSON.stringify(comparePilot(input),null,2));
}
