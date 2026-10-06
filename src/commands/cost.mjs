import path from 'node:path';
import { loadRecords, groupSessions, byAgent, usageTotals, formatMs } from '../lib/telemetry.mjs';
export default function cost(args) {
  const file = args.file ?? (args.repo ? path.join(args.repo,'.harness/sessions.jsonl') : null);
  const records=loadRecords(file), sessions=groupSessions(records);
  const report={version:2,sessions,agents:byAgent(records),usage:usageTotals(sessions),
    note:'Explicit local outcomes. Missing measurements are null; tool counts are observations, not billed tokens. Agent times can overlap; wall time includes waiting.'};
  if (args.json) { console.log(JSON.stringify(report,null,2)); return 0; }
  console.log('Local validation: '+sessions.filter(s=>s.outcome==='validated').length+' / '+sessions.length+' sessions');
  for (const s of sessions) console.log(s.id+' | '+s.track+' | '+s.outcome+' | elapsed '+formatMs(s.durationMs)+' | tokens '+(s.tokens ?? 'unavailable')+' | hooks '+formatMs(s.hookDurationMs)+' | tools '+formatMs(s.toolDurationMs)+' | approval '+formatMs(s.approvalWaitMs));
  console.log(report.note);
  return 0;
}
