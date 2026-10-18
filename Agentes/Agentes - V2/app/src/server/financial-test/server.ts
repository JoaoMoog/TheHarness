import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';

export const financialCompanies=['Matriz','Filial Sul','Unidade São Paulo'];
export const financialCenters=['Tecnologia','Operações','Comercial','Administrativo','Pesquisa','Expansão'];
export function financialFacts(){
 return Array.from({length:24},(_,m)=>financialCompanies.flatMap((company,co)=>financialCenters.map((center,c)=>{
  const year=2025+Math.floor(m/12),month=m%12+1;
  const budget=100000+c*10000+co*20000+month*1000+(year-2025)*5000;
  const actual=budget+(c%2?-5000:10000)+month*11;
  return {DocumentId:`FIN-${year}-${month}-${co}-${c}`,Company:company,CostCenter:center,PostingDate:`${year}-${String(month).padStart(2,'0')}-01`,ActualAmount:(m===0&&co===0&&c===1?0:actual)/100,BudgetAmount:(m===0&&co===0&&c===0?0:budget)/100,Currency:'BRL'};
 }))).flat();
}
export type FinancialProfile='normal'|'unavailable'|'slow'|'unauthorized'|'invalid';
export function createFinancialServer({token,profile='normal',delayMs=31000}:{token:string;profile?:FinancialProfile;delayMs?:number}){
 if(!token)throw new Error('Defina FINANCIAL_TEST_TOKEN no servidor.');
 const rows=financialFacts();
 return createServer((req,res)=>{
  const reply=(status:number,value:unknown)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}};
  const url=new URL(req.url||'/','http://localhost');
  if(req.method!=='GET')return reply(405,{error:'Somente leitura'});
  if(url.pathname==='/health')return reply(200,{status:'ok',service:'financial-test',synthetic:true});
  if(url.pathname!=='/odata/FinancialFacts')return reply(404,{error:'Coleção não encontrada'});
  const expected=Buffer.from(`Bearer ${token}`),provided=Buffer.from(req.headers.authorization||'');
  if(profile==='unauthorized'||expected.length!==provided.length||!timingSafeEqual(expected,provided))return reply(401,{error:'Credencial inválida'});
  if(profile==='unavailable')return reply(503,{error:'Indisponibilidade simulada'});
  if([...url.searchParams.keys()].some(k=>k!=='$skiptoken'))return reply(400,{error:'Parâmetro não suportado'});
  const raw=url.searchParams.get('$skiptoken')||'0',offset=Number(raw);
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(offset)||offset>rows.length)return reply(400,{error:'Página inválida'});
  const send=()=>reply(200,{value:profile==='invalid'?[{...rows[0],Currency:'USD'}]:rows.slice(offset,offset+50),...(profile!=='invalid'&&offset+50<rows.length?{'@odata.nextLink':`/odata/FinancialFacts?$skiptoken=${offset+50}`}:{})});
  if(profile==='slow'){const timer=setTimeout(send,delayMs);res.once('close',()=>clearTimeout(timer));}else send();
 });
}
