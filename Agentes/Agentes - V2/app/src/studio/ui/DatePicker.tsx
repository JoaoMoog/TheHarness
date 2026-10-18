import {useEffect,useId,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';

const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const display=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value.split('-').reverse().join('/'):value;
const parse=(text:string)=>/^\d{2}\/\d{2}\/\d{4}$/.test(text)?text.split('/').reverse().join('-'):text;
const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export function DatePicker({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
 const id=useId(),panel=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [text,setText]=useState(display(value)),[error,setError]=useState(false),[month,setMonth]=useState(new Date()),[focus,setFocus]=useState('');
 useEffect(()=>{setText(display(value));setError(false)},[value]);
 const first=new Date(month.getFullYear(),month.getMonth(),1),start=new Date(first);start.setDate(1-first.getDay());
 const days=Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
 const choose=(day:string)=>{onChange(day);setText(display(day));setError(false);panel.current?.hidePopover();trigger.current?.focus()};
 const changeMonth=(offset:number)=>{const d=new Date(month.getFullYear(),month.getMonth()+offset,1);setMonth(d);setFocus(iso(d));};
 const move=(days:number)=>{const d=new Date((focus||iso(new Date()))+'T12:00:00');d.setDate(d.getDate()+days);setFocus(iso(d));setMonth(d);requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>(`[data-date="${iso(d)}"]`)?.focus())};
 return <div className="date-field"><label htmlFor={id}>{label}</label><div className="date-input"><input id={id} aria-label={label} placeholder="dd/mm/aaaa" value={text} inputMode="numeric" maxLength={10} aria-invalid={error||undefined} aria-describedby={error?id+'-error':undefined} onChange={e=>{setText(e.target.value);onChange(parse(e.target.value))}} onBlur={()=>setError(!!text&&!valid(parse(text)))}/><button type="button" ref={trigger} popoverTarget={id+'-calendar'} aria-label={`Abrir calendário: ${label}`}><CalendarDays size={16}/></button></div>{error&&<small id={id+'-error'} role="alert">Use uma data válida: dd/mm/aaaa.</small>}
 <div ref={panel} id={id+'-calendar'} popover="auto" className="date-popover" role="dialog" aria-label={`Calendário: ${label}`} onToggle={event=>{if(event.newState!=='open')return;const d=valid(value)?new Date(value+'T12:00:00'):new Date();setMonth(d);setFocus(iso(d));const r=trigger.current!.getBoundingClientRect();panel.current!.style.left=`${Math.max(8,Math.min(r.right-300,innerWidth-308))}px`;panel.current!.style.top=`${Math.max(8,Math.min(r.bottom+8,innerHeight-360))}px`;requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>(`[data-date="${iso(d)}"]`)?.focus())}}>
 <div className="calendar-heading"><button type="button" aria-label="Mês anterior" onClick={()=>changeMonth(-1)}><ChevronLeft size={17}/></button><strong aria-live="polite">{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(month)}</strong><button type="button" aria-label="Próximo mês" onClick={()=>changeMonth(1)}><ChevronRight size={17}/></button></div>
 <div className="calendar-week" aria-hidden="true">{['D','S','T','Q','Q','S','S'].map((d,i)=><span key={i}>{d}</span>)}</div><div className="calendar-days" role="group" aria-label="Dias do mês" onKeyDown={event=>{const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(event.key in offsets){event.preventDefault();move(offsets[event.key])}}}>{days.map(d=>{const day=iso(d);return <button key={day} type="button" data-date={day} tabIndex={day===focus?0:-1} aria-label={new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(d)} aria-pressed={day===value} aria-current={day===iso(new Date())?'date':undefined} className={d.getMonth()!==month.getMonth()?'other-month':''} onFocus={()=>setFocus(day)} onClick={()=>choose(day)}>{d.getDate()}</button>})}</div><div className="calendar-footer"><button type="button" onClick={()=>choose('')}>Limpar</button><button type="button" onClick={()=>choose(iso(new Date()))}>Hoje</button></div>
 </div></div>;
}
