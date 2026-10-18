import {useEffect,useState} from 'react';
import {ResponsiveContainer,BarChart,Bar,LineChart,Line,PieChart,Pie,Cell,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from 'recharts';
import type {DashboardDocument,WidgetConfig} from '../contracts';
import {formatValue,type WidgetResult} from '../widgets';
import {request} from './api';
import {useApp} from './state';

export function WidgetChart({widget,document,onData}:{widget:WidgetConfig;document:DashboardDocument;onData?:(result:WidgetResult)=>void}){
 const {server}=useApp(),[result,setResult]=useState<WidgetResult|null>(null),[error,setError]=useState('');
 const key=JSON.stringify({widget,document});
 useEffect(()=>{const ctrl=new AbortController();setResult(null);setError('');request<WidgetResult>('widgets/query',{widget,document},server.workspace.id,ctrl.signal).then(r=>{setResult(r);onData?.(r)}).catch(e=>{if(!ctrl.signal.aborted)setError(e.message)});return()=>ctrl.abort()},[key,server.workspace.id]);
 if(error)return <p className="widget-error" role="alert">{error}</p>;
 if(!result)return <p className="widget-loading" role="status">Consultando gráfico…</p>;
 return <WidgetVisualization widget={widget} result={result}/>;
}
export function WidgetVisualization({widget,result}:{widget:WidgetConfig;result:WidgetResult}){
 if(!result.count)return <p className="widget-loading">Nenhum registro neste recorte.</p>;
 const color=widget.color==='green'?'var(--success)':widget.color==='slate'?'var(--chart-3)':'var(--chart-1)';
 const rows=widget.kind==='waterfall'?result.groups.map(g=>({...g,value:g.value==null||g.comparison==null?null:g.comparison-g.value})):result.groups;
 const fmt=(v:number|null)=>formatValue(v,widget.unit),horizontal=widget.kind==='bar';
 const table=<div className="table-scroll" role="region" aria-label={`Valores de ${widget.title}`} tabIndex={0}><table><thead><tr><th scope="col">{result.dimension}</th><th scope="col">{widget.kind==='waterfall'?'Diferença':result.metric}</th>{result.comparison&&widget.kind!=='waterfall'&&<th scope="col">{result.comparison}</th>}</tr></thead><tbody>{rows.map(r=><tr key={r.name}><td>{r.name}</td><td>{fmt(r.value)}</td>{result.comparison&&widget.kind!=='waterfall'&&<td>{fmt(r.comparison)}</td>}</tr>)}</tbody></table></div>;
 const common=<><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey={horizontal?undefined:'name'} type={horizontal?'number':'category'} tick={{fontSize:12,fill:'var(--muted-foreground)'}} tickLine={false} axisLine={false}/><YAxis dataKey={horizontal?'name':undefined} type={horizontal?'category':'number'} width={horizontal?100:65} tick={{fontSize:12,fill:'var(--muted-foreground)'}} tickLine={false} axisLine={false} tickFormatter={horizontal?undefined:v=>new Intl.NumberFormat('pt-BR',{notation:'compact'}).format(v)}/><Tooltip formatter={(v:any,n:any)=>[fmt(v),n]} contentStyle={{background:'var(--popover)',color:'var(--popover-foreground)',border:'1px solid var(--border)',borderRadius:8}}/>{widget.legend&&<Legend wrapperStyle={{fontSize:12}}/>}</>;
 let content;
 if(widget.kind==='table')content=table;
 else if(widget.kind==='indicator')content=<div className="chart-indicator"><span>{result.metric}</span><strong>{fmt(result.total)}</strong><p>{result.count} registros · {widget.operation==='sum'?'Soma':widget.operation==='average'?'Média':'Contagem'}</p></div>;
 else if(widget.kind==='text')content=<div className="executive-note"><h3>{result.metric}</h3><p>{fmt(result.total)} no recorte selecionado, considerando {result.count} registros.</p>{result.comparison&&<p>{result.comparison}: {fmt(result.comparisonTotal)}.</p>}</div>;
 else if(widget.kind==='donut'&&rows.some(r=>(r.value??0)<0))content=<p className="widget-error">Roscas não representam valores negativos. Escolha barras ou tabela.</p>;
 else if(widget.kind==='donut')content=<ResponsiveContainer width="100%" height={260}><PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}>{rows.map((r,i)=><Cell key={r.name} fill={[color,'var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)'][i%5]}/>)}</Pie><Tooltip formatter={(v:any)=>fmt(v)}/>{widget.legend&&<Legend wrapperStyle={{fontSize:12}}/>}</PieChart></ResponsiveContainer>;
 else if(widget.kind==='line')content=<ResponsiveContainer width="100%" height={260}><LineChart data={rows} margin={{top:12,right:16,left:0,bottom:8}} accessibilityLayer>{common}<Line dataKey="value" name={result.metric} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false}/>{result.comparison&&<Line dataKey="comparison" name={result.comparison} stroke="var(--chart-5)" strokeDasharray="4 4" dot={false} isAnimationActive={false}/>}</LineChart></ResponsiveContainer>;
 else content=<ResponsiveContainer width="100%" height={260}><BarChart data={rows} layout={horizontal?'vertical':'horizontal'} margin={{top:12,right:16,left:0,bottom:8}} accessibilityLayer>{common}<Bar dataKey="value" name={widget.kind==='waterfall'?'Diferença':result.metric} fill={color} radius={3} isAnimationActive={false}/>{result.comparison&&widget.kind!=='waterfall'&&<Bar dataKey="comparison" name={result.comparison} fill="var(--chart-5)" radius={3} isAnimationActive={false}/>}</BarChart></ResponsiveContainer>;
 return <><div className="widget-visual">{content}</div>{widget.kind!=='table'&&<details className="chart-values"><summary>Ver valores{widget.id==='trend'?' mensais':' do gráfico'}</summary>{table}</details>}<div className="widget-provenance"><span>{result.source} · {result.count} registros{result.missing?` · ${result.missing} sem valor`:''}</span>{result.truncated&&<span>Mostrando {result.groups.length} grupos. O total considera todos.</span>}{widget.scope&&<span>{result.scope}</span>}</div></>;
}
