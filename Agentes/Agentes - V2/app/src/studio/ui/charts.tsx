import React from 'react';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,LineChart,Line,PieChart,Pie,Cell} from 'recharts';
import {axisAmount} from './evidenceModel';
import {money,number} from '../domain';
import {DataTable} from './ui';
const blue='var(--chart-1)',budget='var(--chart-4)';
const tooltip={contentStyle:{fontFamily:'Geist Variable',fontSize:12,border:'1px solid var(--border)',background:'var(--popover)',color:'var(--popover-foreground)',borderRadius:6},formatter:(value:any,name:any)=>[money(value),name==='actual'?'Realizado':name==='budget'?'Orçamento':name]};
export function CompareChart({data,kind='column',onSelect,highlight=false}:any){
 const click=(d:any)=>{const name=d?.activeLabel||d?.name;if(name&&data.some((x:any)=>x.name===name))onSelect?.(name)};
 if(kind==='table')return <DataTable groups={data} onSelect={onSelect}/>;
 if(kind==='indicator')return <div className="chart-indicator"><span>Total realizado</span><strong>{money(data.reduce((s:number,g:any)=>s+g.actual,0))}</strong><p>{data.length} centros de custo no recorte</p></div>;
 if(kind==='text')return <div className="executive-note"><h3>Leitura executiva</h3><p>O realizado soma {money(data.reduce((s:number,g:any)=>s+g.actual,0))}. {data.filter((g:any)=>g.actual>g.budget).length} centros de custo estão acima do orçamento.</p><p>Confira os valores e os responsáveis na tabela detalhada.</p></div>;
 if(kind==='donut')return <div className="donut-wrap"><ResponsiveContainer width="100%" height={224}><PieChart><Pie data={data} dataKey="actual" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} isAnimationActive={false} onClick={click}>{data.map((d:any,i:number)=><Cell key={d.name} fill={['var(--chart-1)','var(--chart-3)','var(--chart-2)','var(--chart-4)'][i%4]}/>)}</Pie><Tooltip {...tooltip}/></PieChart></ResponsiveContainer><div className="donut-key">{data.map((d:any)=><span key={d.name}>{d.name} · {money(d.actual)}</span>)}</div></div>;
 if(kind==='line')return <TrendChart data={data.map((g:any)=>({...g,month:g.name}))}/>;
 const horizontal=kind==='bar';
 const waterfall=kind==='waterfall';
 const values=waterfall?data.map((g:any)=>({...g,delta:g.budget-g.actual})):data;
 return <ResponsiveContainer width="100%" height={230}><BarChart data={values} layout={horizontal?'vertical':'horizontal'} margin={{top:14,right:8,left:horizontal?20:0,bottom:0}} onClick={click} barGap={4} barCategoryGap="30%" accessibilityLayer>
 <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/>
 <XAxis type={horizontal?'number':'category'} dataKey={horizontal?undefined:'name'} tick={{fontSize:12,fill:'var(--muted-foreground)'}} axisLine={false} tickLine={false} tickFormatter={horizontal?(v=>axisAmount(v)):undefined} interval={0}/>
 <YAxis type={horizontal?'category':'number'} dataKey={horizontal?'name':undefined} width={horizontal?100:64} tick={{fontSize:12,fill:'var(--muted-foreground)'}} axisLine={false} tickLine={false} tickFormatter={!horizontal?(v=>axisAmount(v)):undefined}/>
 <Tooltip {...tooltip} cursor={{fill:'var(--muted)'}}/>
 {!waterfall&&<Bar dataKey="budget" fill={budget} radius={[3,3,0,0]} isAnimationActive={false}/>}
 <Bar dataKey={waterfall?'delta':'actual'} name={waterfall?'Saldo':undefined} fill={blue} radius={[3,3,0,0]} isAnimationActive={false}>{values.map((g:any)=><Cell key={g.name} fill={waterfall?(g.delta<0?'var(--destructive)':'var(--success)'):highlight&&g.actual>g.budget?'var(--destructive)':blue}/>)}</Bar>
 </BarChart></ResponsiveContainer>
}
export function TrendChart({data,forecast=false}:any){return <ResponsiveContainer width="100%" height={230}><LineChart data={data} margin={{top:16,right:12,left:0,bottom:0}} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:12,fill:'var(--muted-foreground)'}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:12,fill:'var(--muted-foreground)'}} tickFormatter={v=>axisAmount(v)} width={64} axisLine={false} tickLine={false}/><Tooltip {...tooltip}/><Line dataKey="budget" stroke="var(--chart-5)" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false}/><Line dataKey="actual" stroke={blue} strokeWidth={2.5} dot={{r:3,strokeWidth:2,fill:'var(--card)'}} isAnimationActive={false}/>{forecast&&<Line dataKey="forecast" name="Projeção" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}} isAnimationActive={false}/>}</LineChart></ResponsiveContainer>}
