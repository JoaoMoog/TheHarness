import {readFileSync,writeFileSync} from 'node:fs';
for(const name of ['ui','charts','workspace']){
 const path=`src/studio/ui/${name}.tsx`;
 let text=readFileSync(path,'utf8').replaceAll("'./core.mjs'","'../domain'");
 if(name==='ui')text=text.replace('number(data.actual/data.budget*100||0)','number(data.execution)').replace('number(g.actual/g.budget*100)','number(g.budget?g.actual/g.budget*100:null)');
 if(name==='workspace'){
  text=text.replace("const {s,set}=useApp();return <div className=\"filterbar\">","const {s,set,catalog,data}=useApp();return <div className=\"filterbar\">");
  text=text.replace("label:'Jan – set, 2026'","label:'Todo o período'").replace("label:'3º trimestre, 2026'","label:'3º trimestre'").replace("'Matriz','Filial'","...(catalog?.companies||[])").replace('...centers.map((c:any)=>c.name)','...(catalog?.centers||[])');
  text=text.replace('Atualizado às 09:41',"Base de {new Date(data.lineage.updatedAt).toLocaleDateString('pt-BR')}");
  text=text.replace('save,exportCsv}=useApp()','save,exportCsv,server}=useApp()');
  text=text.replace('<Database size={12}/>SAP S/4HANA',"<Database size={12}/>{server.runtime.dataProvider==='demo'?'Base demonstrativa':'SAP · Financeiro'}").replace('<span>Dados demonstrativos</span>',"<span>{server.runtime.dataProvider==='demo'?'Dados sintéticos':'Dados da fonte configurada'}</span>");
  text=text.replace('Despesas mensais · 2026','Despesas por competência');
  text=text.replace('const {s,set,modal,setChat,send,proposal,apply,busy,data,canUndo,undo}=useApp()','const {s,set,modal,setChat,send,proposal,apply,busy,data,canUndo,undo,server}=useApp()');
  text=text.replace("{i===1&&<>","{false&&<>").replace('<span>SAP S/4HANA <span className="muted">/ Financeiro</span></span>',"<span>{server.runtime.dataProvider==='demo'?'Base demonstrativa':'SAP'} <span className=\"muted\">/ Financeiro</span></span>");
  text=text.replace('<dd>SAP S/4HANA · demo</dd>',"<dd>{server.runtime.dataProvider==='demo'?'Financeiro · demo':'SAP · Financeiro'}</dd>");
  text=text.replace("'Jul – set de 2026':'Jan – set de 2026'","'3º trimestre':'Todo o período disponível'");
  text=text.replace('<span>CONTINUE A ANÁLISE</span>','<span>Continue a análise</span>');
  text=text.replace('disabled={!s.draft.trim()||busy>0}','disabled={s.reader||!s.draft.trim()||busy>0}');
  text=text.replace('IA demonstrativa. Confira os dados e critérios.',"{server.runtime.aiProvider==='demo'?'Assistente demonstrativo. Provedor de IA pendente.':'IA configurada. Confira os dados e critérios.'}");
  text=text.replace('Ajustes salvos neste navegador','Aplique os ajustes e salve a versão').replace('value={s.title} onChange','maxLength={120} value={s.title} onChange').replace('value={s.chartTitle} onChange','maxLength={120} value={s.chartTitle} onChange');
 }
 writeFileSync(path,text);
}
