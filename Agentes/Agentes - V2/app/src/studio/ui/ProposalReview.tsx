import {Check} from 'lucide-react';
import {useApp} from './state';
import {Button} from './ui';
import {periodLabel,sourceLabel} from '../domain';
import {proposalChanges} from './evidenceModel';

export function ProposalReview({home=false}:{home?:boolean}){
 const {s,server,proposal,apply,busy}=useApp();
 if(!proposal)return null;
 const sourceName=(id:string)=>id==='finance'?sourceLabel(server.runtime.dataProvider):server.files?.find(f=>f.id===id)?.name||'Planilha importada';
 const scope={...s,...proposal.patch};
 const changes=proposalChanges(s,proposal,sourceName);
 return <section className="proposal-review" aria-label="Conferir proposta">
  <h3>{proposal.title}</h3>
  <details className="proposal-context"><summary>Fonte e critérios</summary><p>{proposal.description}</p><p>{sourceName(scope.sourceId)} · {periodLabel(scope as any)} · {scope.company==='all'?'Todas as empresas':scope.company}</p></details>
  {changes.length?<table className="proposal-diff"><caption className="sr-only">Mudanças propostas para a análise</caption><thead><tr><th scope="col">Alteração</th><th scope="col">Atual</th><th scope="col">Proposto</th></tr></thead><tbody>{changes.map(change=><tr key={change.label}><th scope="row">{change.label}</th><td>{change.before}</td><td>{change.after}</td></tr>)}</tbody></table>:<p className="proposal-unchanged">A composição proposta já corresponde à análise atual.</p>}
  <footer><p>Salve após aplicar.</p><Button primary icon={Check} onClick={apply} disabled={(s.reader&&proposal.kind!=='presentation')||busy>0}>{proposal.kind==='presentation'?'Preparar apresentação':proposal.kind==='merge'?'Unificar dashboards':proposal.kind==='create'?(home?'Criar dashboard':'Gerar dashboard'):'Aplicar ajuste'}</Button></footer>
 </section>;
}
