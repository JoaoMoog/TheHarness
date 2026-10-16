import type {DataSnapshot,Filters,FinancialRow,QueryResult} from './contracts';
export const centers=[{name:'Tecnologia',actual:3210000,budget:3400000,owner:'Marina Costa',code:'CC-1001'},{name:'Operações',actual:2180000,budget:2100000,owner:'Rafael Lima',code:'CC-1002'},{name:'Comercial',actual:1550000,budget:1540000,owner:'Beatriz Alves',code:'CC-1003'},{name:'Administrativo',actual:1250000,budget:1279000,owner:'Lucas Rocha',code:'CC-1004'}];
export const monthNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const weights=[9,9.8,10.2,10.5,11.3,11.7,11.2,12.4,13.9];
export const demoRows:FinancialRow[]=centers.flatMap((c,ci)=>{let usedA=0,usedB=0;return weights.flatMap((weight,i)=>{const actual=i===8?c.actual-usedA:Math.round(c.actual*weight/100),budget=i===8?c.budget-usedB:Math.round(c.budget/9);usedA+=actual;usedB+=budget;const a=Math.round(actual*.7),b=Math.round(budget*.7);return ['Matriz','Filial'].map((company,k)=>({id:`FIN-${ci+1}${i+1}${k+1}`,center:c.name,month:monthNames[i],index:i,date:`2026-${String(i+1).padStart(2,'0')}-01`,company,actual:k?actual-a:a,budget:k?budget-b:b}))})});
export function summarize(snapshot:DataSnapshot,filters:Filters,search='',offset=0,limit=100):QueryResult {
 const rows=snapshot.rows.filter(r=>(filters.center==='all'||r.center===filters.center)&&(filters.company==='all'||r.company===filters.company)&&(filters.period!=='q3'||r.index>=6&&r.index<=8));
 const sum=(items:FinancialRow[],key:'actual'|'budget')=>Math.round(items.reduce((s,r)=>s+Math.round(r[key]*100),0))/100;
 const actual=sum(rows,'actual'),budget=sum(rows,'budget');
 const groups=[...new Set(rows.map(r=>r.center))].map(name=>({name,code:centers.find(c=>c.name===name)?.code||name,owner:centers.find(c=>c.name===name)?.owner||'Não informado',actual:sum(rows.filter(r=>r.center===name),'actual'),budget:sum(rows.filter(r=>r.center===name),'budget')}));
 const months=[...new Set(rows.map(r=>r.date.slice(0,7)))].sort().map(date=>{const selected=rows.filter(r=>r.date.startsWith(date));return {month:`${monthNames[Number(date.slice(5))-1]}/${date.slice(2,4)}`,index:Number(date.slice(5))-1,actual:sum(selected,'actual'),budget:sum(selected,'budget')}});
 const q=search.toLocaleLowerCase('pt-BR');const matched=rows.filter(r=>!q||`${r.id} ${r.center} ${r.company} ${r.date}`.toLocaleLowerCase('pt-BR').includes(q));
 return {actual,budget,balance:Math.round((budget-actual)*100)/100,execution:budget?actual/budget*100:null,groups,months,rows:matched.slice(offset,offset+limit),count:rows.length,matchedCount:matched.length,offset,limit,lineage:{sourceId:'finance',revision:snapshot.revision,provider:snapshot.provider,updatedAt:snapshot.updatedAt,unit:'BRL',filters}};
}
export function simulate(data:Pick<QueryResult,'actual'|'balance'|'groups'>,percent:number){const saving=Math.round((data.groups.find(g=>g.name==='Tecnologia')?.actual||0)*percent)/100;return {saving,actual:data.actual-saving,balance:data.balance+saving}}
export const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(value);
export const number=(value:number|null)=>value==null?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
export const compact=(value:number)=>Math.abs(value)>=1e6?`R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value/1e6)} mi`:money(value);
