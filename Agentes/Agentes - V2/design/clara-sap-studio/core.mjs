export const centers = [
  {name:'Tecnologia', actual:3210000, budget:3400000, owner:'Marina Costa',code:'CC-1001'},
  {name:'Operações', actual:2180000, budget:2100000, owner:'Rafael Lima',code:'CC-1002'},
  {name:'Comercial', actual:1550000, budget:1540000, owner:'Beatriz Alves',code:'CC-1003'},
  {name:'Administrativo', actual:1250000, budget:1279000, owner:'Lucas Rocha',code:'CC-1004'},
];
export const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set'];
const weights = [9,9.8,10.2,10.5,11.3,11.7,11.2,12.4,13.9];
export const records = centers.flatMap((center,ci)=>{
  let usedA=0, usedB=0;
  return monthNames.flatMap((month,i)=>{
    const actual=i===8?center.actual-usedA:Math.round(center.actual*weights[i]/100);
    const budget=i===8?center.budget-usedB:Math.round(center.budget/9);
    usedA+=actual;usedB+=budget;
    const a=Math.round(actual*.7),b=Math.round(budget*.7);
    return ['Matriz','Filial'].map((company,k)=>({id:`FIN-${ci+1}${i+1}${k+1}`,center:center.name,month,index:i,company,actual:k?actual-a:a,budget:k?budget-b:b}));
  });
});
export function summarize(source,filters={}){
  const rows=source.filter(r=>(!filters.center||filters.center==='all'||r.center===filters.center)&&(!filters.company||filters.company==='all'||r.company===filters.company)&&(filters.period!=='q3'||r.index>=6));
  const actual=rows.reduce((s,r)=>s+r.actual,0),budget=rows.reduce((s,r)=>s+r.budget,0);
  const groups=centers.map(c=>({...c,actual:rows.filter(r=>r.center===c.name).reduce((s,r)=>s+r.actual,0),budget:rows.filter(r=>r.center===c.name).reduce((s,r)=>s+r.budget,0)})).filter(g=>rows.some(r=>r.center===g.name));
  const months=monthNames.map((month,index)=>({month,index,actual:rows.filter(r=>r.index===index).reduce((s,r)=>s+r.actual,0),budget:rows.filter(r=>r.index===index).reduce((s,r)=>s+r.budget,0)})).filter(m=>rows.some(r=>r.index===m.index));
  return {actual,budget,balance:budget-actual,execution:budget?actual/budget*100:0,groups,months,rows,count:rows.length};
}
export function simulate(summary,percent){
  if(!Number.isFinite(percent)||percent<0||percent>100)throw new Error('Informe uma redução de 0 a 100%.');
  const saving=Math.round((summary.groups.find(g=>g.name==='Tecnologia')?.actual||0)*percent/100);
  return {...summary,actual:summary.actual-saving,balance:summary.balance+saving,saving};
}
export function interpret(text){
  const q=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/simul|redu[cç]|econom/.test(q)){const value=q.match(/(\d+(?:[.,]\d+)?)\s*%/);return {kind:'scenario',percent:value?Number(value[1].replace(',','.')):5};}
  if(/barras|colunas|linhas|rosca|cascata/.test(q))return {kind:'chart',chart:q.includes('barras')?'bar':q.includes('linhas')?'line':q.includes('rosca')?'donut':q.includes('cascata')?'waterfall':'column'};
  if(/destaq|desvio|acima do/.test(q)&&!/dashboard|monte|crie|criar/.test(q))return {kind:'highlight'};
  if(/indicador|saldo disponivel/.test(q)&&!/dashboard/.test(q))return {kind:'metric'};
  if(/proje|fechamento|previs/.test(q))return {kind:'forecast'};
  if(/todos|limp.*filtro/.test(q))return {kind:'filter',center:'all'};
  const center=centers.find(c=>q.includes(c.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
  if(center&&/mostr|apenas|detalh|filtr|analis/.test(q))return {kind:'filter',center:center.name};
  if(/dashboard|painel|monte|crie/.test(q))return {kind:'create'};
  return {kind:'unsupported'};
}
export const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(value);
export const number = value => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(value);
export const compact = value => Math.abs(value)>=1e6?`R$ ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value/1e6)} mi`:money(value);
