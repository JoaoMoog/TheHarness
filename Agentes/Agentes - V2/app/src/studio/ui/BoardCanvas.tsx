import {Copy,Plus,Settings2,Trash2,ArrowUp} from 'lucide-react';
import {useApp,workingDocument} from './state';
import {widgetsFor} from '../widgets';
import {widgetSchema,type WidgetConfig} from '../contracts';
import {WidgetChart} from './WidgetChart';
import {Button,IconButton} from './ui';

export function BoardCanvas(){
 const {s,set,editor,setEditor,selectedWidget,setSelectedWidget,catalog}=useApp(),document=workingDocument(s) as any,widgets=widgetsFor(document);
 const select=(id:string)=>{setSelectedWidget(id);if(!editor)setEditor(true)};
 const update=(next:WidgetConfig[])=>set({widgets:next});
 return <><div className="canvas-toolbar">{editor?<><p>Clique em um gráfico para editar seus dados e aparência.</p><Button icon={Plus} onClick={()=>{const field=catalog?.fields?.find((c:any)=>c.type==='number'||c.type==='decimal'),dimension=catalog?.fields?.find((c:any)=>c.type==='text'||c.type==='string');const widget=widgetSchema.parse({id:crypto.randomUUID(),title:'Novo gráfico',kind:'column',sourceId:s.sourceId,dimension:dimension?.key||catalog?.fields?.[0]?.key||'center',metric:field?.key||catalog?.fields?.[0]?.key||'actual',operation:field?'sum':'count',dateColumn:catalog?.fields?.find((c:any)=>c.type==='date')?.key||null,unit:catalog?.generic?'number':'BRL'});update([...widgets,widget]);select(widget.id)}} disabled={widgets.length>=24}>Adicionar gráfico</Button></>:null}</div>
 <div className={`board-canvas ${editor?'is-editing':''}`}>{widgets.map((widget,index)=><section key={widget.id} className={`panel canvas-widget ${selectedWidget===widget.id&&editor?'is-selected':''}`} data-widget={widget.id} onClickCapture={e=>{if(editor){const target=e.target as HTMLElement;if(target.closest('.widget-edit-actions'))return;e.preventDefault();e.stopPropagation();select(widget.id)}}}>
  <div className="panel-heading"><div><h2>{widget.title}</h2></div><IconButton icon={Settings2} label={`Editar gráfico: ${widget.title}`} disabled={s.reader} onClick={()=>select(widget.id)}/></div>
  <WidgetChart widget={widget} document={document}/>
  {editor&&<div className="widget-edit-actions"><Button quiet onClick={()=>select(widget.id)}>Editar este gráfico</Button><IconButton icon={ArrowUp} label={`Mover ${widget.title} para cima`} disabled={index===0} onClick={()=>{const next=[...widgets];[next[index-1],next[index]]=[next[index],next[index-1]];update(next)}}/><IconButton icon={Copy} label={`Duplicar ${widget.title}`} disabled={widgets.length>=24} onClick={()=>update([...widgets,{...widget,id:crypto.randomUUID(),title:widget.title.slice(0,110)+' · cópia'}])}/><IconButton icon={Trash2} label={`Remover ${widget.title}`} disabled={widgets.length===1} onClick={()=>{update(widgets.filter(w=>w.id!==widget.id));setSelectedWidget(null)}}/></div>}
 </section>)}</div></>;
}
