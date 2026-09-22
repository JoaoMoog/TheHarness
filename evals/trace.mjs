// Evaluate observed action/artifact records, independently of answer wording.
// Feed exported, redacted editor traces. This checker does not run or impersonate a model.
export const SCENARIOS = {
  text: { lane:'direct', approvals:0, checks:['text'] },
  regression: { lane:'direct', approvals:0, checks:['regression'] },
  web: { lane:'direct', approvals:0, checks:['browser'] },
  structured: { lane:'structured', approvals:1, checks:['integration'], artifacts:['requirements','plan','tasks'], review:true },
  sensitive: { lane:'sensitive', approvals:1, checks:['security'], sensitive:true }
};
export function checkTrace(trace) {
  const spec=SCENARIOS[trace.scenario], failures=[];
  if(!spec)return {ok:false,failures:['Unknown scenario']};
  const actions=trace.actions ?? [], artifacts=trace.artifacts ?? [], checks=trace.checks ?? [];
  if(!Array.isArray(actions)||!Array.isArray(artifacts)||!Array.isArray(checks))return {ok:false,failures:['Invalid trace arrays']};
  if(trace.lane!==spec.lane)failures.push('Wrong execution lane');
  if(trace.outcome!=='validated')failures.push('Missing explicit validated outcome');
  if(actions.some(a=>['stage','commit','push','pr','deploy','pipeline'].includes(a.type)))failures.push('Automatic publication');
  if(spec.lane==='direct' && (actions.some(a=>a.type==='subagent') || artifacts.some(a=>a.kind==='session')))failures.push('Unnecessary direct-work ceremony');
  const approvals=actions.filter(a=>a.type==='approval');
  if(approvals.length!==spec.approvals)failures.push('Wrong approval count');
  const mutation=actions.findIndex(a=>a.type==='edit');
  if(mutation<0)failures.push('No implementation action');
  if(spec.approvals && (actions.findIndex(a=>a.type==='approval')>mutation || approvals[0]?.scope!==(spec.sensitive?'sensitive':'plan')))failures.push('Approval scope/order');
  if(spec.review && !actions.some((a,i)=>a.type==='review' && i>mutation && a.independent===true && a.verdict==='approve'))failures.push('No independent final review');
  if(actions.filter(a=>a.type==='review').length>2)failures.push('Too many review rounds');
  for(const kind of spec.artifacts ?? [])if(!artifacts.some(a=>a.kind===kind && a.path && a.sha256?.match(/^[a-f0-9]{64}$/)))failures.push('Missing artifact '+kind);
  for(const kind of spec.checks)if(!checks.some(c=>c.kind===kind && c.status==='passed' && c.command && c.evidence && c.identity?.match(/^[a-f0-9]{64}$/)))failures.push('Missing executed evidence '+kind);
  if(checks.some(c=>c.required!==false && c.status!=='passed'))failures.push('Required check failed or missing');
  return {ok:failures.length===0,failures};
}
