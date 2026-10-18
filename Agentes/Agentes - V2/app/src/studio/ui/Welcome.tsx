import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,X} from 'lucide-react';
import {useApp,type Screen} from './state';
import {Button,IconButton} from './ui';
import {request} from './api';

const steps:{screen:Screen;target:string;title:string;text:string}[]=[
 {screen:'overview',target:'#home-message',title:'Conte o que quer descobrir',text:'Peça uma análise em linguagem natural. Se faltar informação, a CLARA pergunta antes de montar o dashboard.'},
 {screen:'overview',target:'.home-recent',title:'Retome suas análises',text:'Os dashboards salvos ficam aqui e na biblioteca. Abra uma análise para continuar a conversa sobre aquele recorte.'},
 {screen:'library',target:'.library-toolbar',title:'Encontre seu dashboard',text:'Busque pelo nome, alterne entre lista e galeria e abra a análise que deseja apresentar ou editar.'},
 {screen:'dashboard',target:'.analysis-scope',title:'Escolha o recorte',text:'Ajuste o período, a empresa e o centro. O calendário usa datas em português e os resultados acompanham os filtros escolhidos.'},
 {screen:'dashboard',target:'.board-canvas',title:'Cada gráfico é editável',text:'Ative Editar e clique no gráfico. No painel lateral você escolhe colunas, medidas, soma ou média, tipo, título e aparência.'},
 {screen:'dashboard',target:'.dashboard-primary-actions',title:'Confira e salve',text:'Use Salvar para registrar uma versão. O estado ao lado do título indica o que ainda não foi salvo.'},
 {screen:'dashboard',target:'[aria-label="Mais opções do dashboard"]',title:'Apresente e unifique',text:'Em Mais opções, crie uma apresentação HTML ou reúna dashboards. Também pode pedir à CLARA: “Prepare uma apresentação deste dashboard”.'},
 {screen:'dashboard',target:'.metric-strip',title:'Verifique os números',text:'Confira os cálculos dos indicadores. Cada gráfico identifica sua fonte e permite abrir os valores usados na visualização.'},
 {screen:'connections',target:'.data-options',title:'Traga dados de qualquer área',text:'Importe Excel, CSV ou JSON com suas próprias colunas, ou uma coleção SAP configurada. Revise os tipos detectados antes de analisar.'},
 {screen:'connections',target:'.data-source-list',title:'Escolha a fonte da conversa',text:'Clique em Criar análise na fonte desejada. A CLARA recebe o catálogo de colunas para preparar os gráficos.'},
 {screen:'admin',target:'.governance-context',title:'Organize seus espaços',text:'Separe as análises por equipe e alterne de espaço sem sair da administração. Fontes e permissões pertencem ao espaço selecionado.'},
 {screen:'admin',target:'.governance-entry',title:'Convide sua equipe',text:'Crie um espaço ou entre por convite. Administradores gerenciam acessos; leitores consultam e exportam. Você pode rever este guia no perfil.'},
];
export function Welcome({close}:{close:()=>void}){
 const {s,go,reload,setChat,setEditor}=useApp(),[step,setStep]=useState(0),[pending,setPending]=useState(false),[error,setError]=useState(''),[rect,setRect]=useState<DOMRect|null>(null),[size,setSize]=useState({width:innerWidth,height:innerHeight});
 const original=useRef(s.screen),dialog=useRef<HTMLDialogElement>(null),bubble=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),content=steps[step];
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[]);
 useEffect(()=>{setChat(false);setEditor(false);go(content.screen);heading.current?.focus()},[step]);
 useLayoutEffect(()=>{let previous='',scrolled=false;const update=()=>{setSize(old=>old.width===innerWidth&&old.height===innerHeight?old:{width:innerWidth,height:innerHeight});const target=document.querySelector<HTMLElement>(content.target);if(!target){setRect(null);return;}if(!scrolled){target.scrollIntoView({block:'center',behavior:'instant'});scrolled=true;}const r=target.getBoundingClientRect(),key=[r.x,r.y,r.width,r.height].join(':');if(key!==previous){previous=key;setRect(r)}};update();const timer=setInterval(update,150);window.addEventListener('resize',update);return()=>{clearInterval(timer);window.removeEventListener('resize',update)}},[step,content.target]);
 async function finish(){setPending(true);setError('');try{await request('onboarding',{});await reload();go(original.current);close()}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir. Tente novamente.')}finally{setPending(false)}}
 const width=Math.min(370,size.width-24),height=bubble.current?.offsetHeight||260,left=rect?Math.max(12,Math.min(rect.left,size.width-width-12)):(size.width-width)/2;
 const top=rect?rect.bottom+height+24<size.height?rect.bottom+12:rect.top-height-12>12?rect.top-height-12:Math.max(12,(size.height-height)/2):Math.max(12,(size.height-height)/2);
 return createPortal(<dialog ref={dialog} className="guided-tour" aria-labelledby="tour-title" onCancel={e=>{e.preventDefault();void finish()}}>{rect&&<div className="tour-spotlight" aria-hidden="true" style={{left:Math.max(4,rect.left-4),top:Math.max(4,rect.top-4),width:Math.min(rect.width+8,size.width-8),height:Math.min(rect.height+8,size.height-8)}}/>}<div ref={bubble} className="tour-bubble" style={{left,top,width}}><header><span>Conheça a CLARA · {step+1} de {steps.length}</span><IconButton icon={X} label="Fechar guia" disabled={pending} onClick={()=>void finish()}/></header><h2 id="tour-title" ref={heading} tabIndex={-1}>{content.title}</h2><p>{content.text}</p>{error&&<p role="alert">{error}</p>}<footer><Button quiet disabled={pending} onClick={()=>void finish()}>Pular apresentação</Button><div>{step>0&&<IconButton icon={ArrowLeft} label="Passo anterior" disabled={pending} onClick={()=>setStep(step-1)}/>}<Button primary icon={ArrowRight} disabled={pending} onClick={()=>step<steps.length-1?setStep(step+1):void finish()}>{step===steps.length-1?'Concluir':'Continuar'}</Button></div></footer></div></dialog>,document.body);
}
