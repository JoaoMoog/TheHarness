'use strict';
// Arithmetic-only parser: never executes user-supplied JavaScript.
function calculateFormula(expression,values){
 const source=String(expression).toLowerCase().replaceAll(',','.');
 const tokens=source.match(/(?:\d+(?:\.\d+)?|\.[0-9]+)|[a-z_][a-z_0-9]*|[()+*/-]/g)||[];
 if(tokens.join('')!==source.replace(/\s/g,'')||tokens.length>120)throw Error('Use números, variáveis, parênteses e + − * /.');
 let at=0;const peek=()=>tokens[at];
 function atom(){const t=tokens[at++];if(t==='-')return -atom();if(t==='+')return atom();if(t==='('){const n=sum();if(tokens[at++]!==')')throw Error('Feche os parênteses.');return n;}if(t!==undefined&&/^\d|^\./.test(t))return Number(t);if(Object.prototype.hasOwnProperty.call(values,t))return Number(values[t]);throw Error('Variável desconhecida: '+(t||'expressão incompleta'));}
 function product(){let n=atom();while(['*','/'].includes(peek())){const op=tokens[at++],b=atom();if(op==='/'&&b===0)throw Error('Divisão por zero neste recorte.');n=op==='*'?n*b:n/b;}return n;}
 function sum(){let n=product();while(['+','-'].includes(peek())){const op=tokens[at++],b=product();n=op==='+'?n+b:n-b;}return n;}
 const result=sum();if(at!==tokens.length||!Number.isFinite(result))throw Error('Expressão inválida.');return result;
}
const proTypes={column:'Colunas agrupadas',bar:'Barras horizontais',line:'Linhas',area:'Área',donut:'Rosca',table:'Tabela',waterfall:'Cascata',kpi:'Indicador',text:'Texto',image:'Imagem',button:'Botão',filter:'Filtro'};
const proDimensions={month:'Mês',area:'Área',category:'Categoria'};
function proId(prefix='w'){return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function clonePro(value){return JSON.parse(JSON.stringify(value));}
function proDefaults(){return {type:'column',dimension:'month',value:'actual',comparison:'budget',legendField:'none',aggregation:'sum',sort:'label',top:0,span:6,height:330,color:'#123993',comparisonColor:'#4c7dff',background:'#ffffff',textColor:'#172747',borderColor:'#dfe7f4',font:'Segoe UI',fontSize:12,titleSize:15,padding:14,radius:4,border:1,legend:true,labels:true,axes:true,grid:true,unit:'auto',decimals:0,format:'number',subtitle:'',text:'',image:'',imageFit:'contain',target:0,condition:'none',conditionColor:'#d44655',interaction:'details',targetPage:'',filters:{},filterScope:'page',filterDimension:'category',columns:['label','value','comparison','delta']};}
function cleanPro(input){
 if(!input||typeof input!=='object')return undefined;
 const result={version:1,widgets:{},pages:[],activePage:'',selected:'',measures:[],params:{colaboradores:100}};
 const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,70}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
 const text=(x,n=150)=>typeof x==='string'?x.slice(0,n):'';
 const filter=f=>{const out={};if(!f||typeof f!=='object')return out;for(const k of ['area','period'])if(typeof f[k]==='string')out[k]=text(f[k]);if(Array.isArray(f.categories))out.categories=f.categories.filter(x=>typeof x==='string').slice(0,100).map(x=>text(x));return out;};
 for(const [id,raw] of Object.entries(input.widgets||{}).slice(0,100)){if(!validId(id)||!raw||!proTypes[raw.type])continue;const w={...proDefaults(),id,title:text(raw.title)||'Visualização'};
  for(const k of ['color','comparisonColor','background','textColor','borderColor','conditionColor'])if(/^#[a-f0-9]{6}$/i.test(raw[k]))w[k]=raw[k];
  for(const k of ['legend','labels','axes','grid'])if(typeof raw[k]==='boolean')w[k]=raw[k];
  const choices={type:Object.keys(proTypes),dimension:Object.keys(proDimensions),legendField:['none',...Object.keys(proDimensions)],aggregation:['sum','avg','count','min','max'],sort:['label','desc','asc'],unit:['auto','mil','mi'],format:['number','currency','percent'],font:['Segoe UI','Arial','Georgia'],condition:['none','budget','target'],interaction:['none','filter','details','navigate'],filterScope:['page','dashboard'],filterDimension:['category','area','month'],imageFit:['contain','cover']};
  for(const [k,allowed] of Object.entries(choices))if(allowed.includes(raw[k]))w[k]=raw[k];
  for(const [k,min,max] of [['span',3,12],['height',180,800],['fontSize',10,22],['titleSize',12,30],['padding',0,36],['radius',0,24],['border',0,4],['decimals',0,4],['top',0,50],['target',-1e12,1e12]])if(Number.isFinite(Number(raw[k])))w[k]=Math.min(max,Math.max(min,Number(raw[k])));
  for(const k of ['value','comparison'])if(typeof raw[k]==='string'&&/^(actual|budget|count|none|m[a-z0-9]+)$/.test(raw[k]))w[k]=raw[k];
  w.subtitle=text(raw.subtitle,200);w.text=text(raw.text,4000);w.filters=filter(raw.filters);w.targetPage=validId(raw.targetPage)?raw.targetPage:'';
  if(typeof raw.image==='string'&&raw.image.length<1800000&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw.image))w.image=raw.image;
  if(Array.isArray(raw.columns))w.columns=raw.columns.filter(k=>['label','value','comparison','delta'].includes(k));if(!w.columns.length)w.columns=['label','value'];result.widgets[id]=w;
 }
 for(const p of (Array.isArray(input.pages)?input.pages:[]).slice(0,20)){if(!validId(p.id)||result.pages.some(x=>x.id===p.id))continue;result.pages.push({id:p.id,name:text(p.name,60)||'Página',widgets:[...new Set((p.widgets||[]).filter(id=>result.widgets[id]))],filters:filter(p.filters)});}
 if(!result.pages.length)result.pages=[{id:'overview',name:'Visão geral',widgets:Object.keys(result.widgets),filters:{}}];
 result.activePage=result.pages.some(p=>p.id===input.activePage)?input.activePage:result.pages[0].id;
 result.selected=result.widgets[input.selected]?input.selected:result.pages.find(p=>p.id===result.activePage).widgets[0]||'';
 for(const m of (Array.isArray(input.measures)?input.measures:[]).slice(0,30)){if(!/^m[a-z0-9]+$/.test(m.id))continue;result.measures.push({id:m.id,name:text(m.name,70),expression:text(m.expression,300),format:['number','currency','percent'].includes(m.format)?m.format:'number'});}
 for(const [key,value] of Object.entries(input.params||{}).slice(0,20))if(/^[a-z][a-z0-9_]{0,30}$/.test(key)&&!['constructor','prototype','__proto__','realizado','orcado','registros'].includes(key)&&Number.isFinite(Number(value)))result.params[key]=Number(value);
 return result;
}
