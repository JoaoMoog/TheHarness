import {useEffect,useState} from 'react';
import {useApp} from './state';
import {Button,Select} from './ui';
import {filtersSchema,type Filters} from '../contracts';
import {periodLabel} from '../domain';
import {DatePicker} from './DatePicker';
export function currentFilters(s:{sourceId?:string;center:string;company:string;period:string;dateFrom?:string|null;dateTo?:string|null}):Filters{return filtersSchema.parse({...s.sourceId?{sourceId:s.sourceId}:{},center:s.center,company:s.company,period:s.period,dateFrom:s.dateFrom||null,dateTo:s.dateTo||null});}
export function FinancialFilters(){
 const {s,set,catalog}=useApp();const [from,setFrom]=useState(s.dateFrom||''),[to,setTo]=useState(s.dateTo||'');
 useEffect(()=>{setFrom(s.dateFrom||'');setTo(s.dateTo||'')},[s.dateFrom,s.dateTo]);
 const years=[...new Set<string>((catalog?.periods||[]).map((p:string)=>p.slice(0,4)))];
 const presets=years.flatMap(year=>[{value:year,label:year},...[1,2,3,4].map(q=>({value:`${year}-Q${q}`,label:`${q}º trimestre de ${year}`}))]);
 function preset(value:string){if(!value)return;const [year,q]=value.split('-Q');const first=q?(Number(q)-1)*3+1:1,last=q?Number(q)*3:12;const end=new Date(Date.UTC(Number(year),last,0)).toISOString().slice(0,10);set({period:'range',dateFrom:`${year}-${String(first).padStart(2,'0')}-01`,dateTo:end});}
 const valid=filtersSchema.safeParse({period:'range',dateFrom:from,dateTo:to}).success;
 const controls=<div className="filterbar pilot-filters">
  <Select label="Período" value={s.period} onChange={(period:string)=>{if(period==='range'){setFrom(catalog?.periods[0]+'-01');setTo(catalog?.periods.at(-1)+'-28');return;}set({period,dateFrom:null,dateTo:null})}} options={[{value:'all',label:'Todo o período'},{value:'range',label:'Intervalo de datas'},{value:'q3',label:'3º trimestre · todos os anos (legado)'}]}/>
  <Select label="Atalho de período" value="" onChange={preset} options={[{value:'',label:'Escolher ano ou trimestre'},...presets]}/>
  <DatePicker label="Data inicial" value={from} onChange={setFrom}/>
  <DatePicker label="Data final" value={to} onChange={setTo}/>
  <Button disabled={!valid} onClick={()=>set({period:'range',dateFrom:from,dateTo:to})}>Aplicar datas</Button>
  <Select label="Empresa" value={s.company} onChange={(company:string)=>set({company})} options={[{value:'all',label:'Todas as empresas'},...(catalog?.companies||[])]}/>
  <Select label="Centro de custo" value={s.center} onChange={(center:string)=>set({center})} options={[{value:'all',label:'Todos os centros'},...(catalog?.centers||[])]}/>
  <Button quiet onClick={()=>{setFrom('');setTo('');set({center:'all',period:'all',company:'all',dateFrom:null,dateTo:null})}}>Limpar</Button>
 </div>;
 if(catalog?.generic)return <div className="filterbar pilot-filters"><DatePicker label="Data inicial" value={from} onChange={setFrom}/><DatePicker label="Data final" value={to} onChange={setTo}/><Button disabled={!valid||!catalog.fields.some((f:any)=>f.type==='date')} onClick={()=>set({period:'range',dateFrom:from,dateTo:to})}>Aplicar datas</Button><Button quiet onClick={()=>{setFrom('');setTo('');set({period:'all',dateFrom:null,dateTo:null})}}>Limpar</Button><p className="small-note">O período usa a coluna de data escolhida em cada gráfico.</p></div>;
 return s.screen==='dashboard'?controls:<details className="financial-filter-disclosure"><summary><strong>Filtros</strong><span>{periodLabel(currentFilters(s))} · {s.company==='all'?'Todas as empresas':s.company} · {s.center==='all'?'Todos os centros':s.center}</span></summary>{controls}</details>;
}
