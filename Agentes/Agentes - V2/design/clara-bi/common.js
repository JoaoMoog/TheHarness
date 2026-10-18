const STATE=/* STATE */;
const ICONS=/* ICONS */;
await Promise.all(['Regular','Medium','SemiBold','Bold'].map(style=>figma.loadFontAsync({family:'Figtree',style})));
const ids=[],mutated=[],links=[];const V={};
await Promise.all(Object.entries(STATE.foundations.variables).map(async([k,id])=>{V[k]=await figma.variables.getVariableByIdAsync(id);}));
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
function mark(n){ids.push(n.id);return n;}
function allIds(n){return [n.id,...('findAll'in n?n.findAll(()=>true).map(x=>x.id):[])];}
function bind(n,p,k){if(V[k])n.setBoundVariable(p,V[k]);}
function paint(k){const key='color/'+k;const p={type:'SOLID',color:rgb(STATE.foundations.values[key]||'#102846')};return V[key]?figma.variables.setBoundVariableForPaint(p,'color',V[key]):p;}
function fill(n,k){n.fills=k?[paint(k)]:[];return n;}
function stroke(n,k='line',weight=1){n.strokes=[paint(k)];n.strokeWeight=weight;return n;}
function radius(n,k='panel'){n.cornerRadius=STATE.foundations.values['radius/'+k];bind(n,'cornerRadius','radius/'+k);return n;}
function pad(n,p){n.paddingLeft=p;n.paddingRight=p;n.paddingTop=p;n.paddingBottom=p;for(const f of['paddingLeft','paddingRight','paddingTop','paddingBottom'])bind(n,f,'space/'+p);}
function al(parent,name,w,dir='VERTICAL',gap=12,padding=0,bg=null){const n=mark(figma.createAutoLayout(dir));n.name=name;fill(n,bg);if(parent)parent.appendChild(n);n.resize(w,10);n.primaryAxisSizingMode=dir==='HORIZONTAL'?'FIXED':'AUTO';n.counterAxisSizingMode=dir==='HORIZONTAL'?'AUTO':'FIXED';n.itemSpacing=gap;bind(n,'itemSpacing','space/'+gap);pad(n,padding);n.counterAxisAlignItems=dir==='HORIZONTAL'?'CENTER':'MIN';n.primaryAxisAlignItems='MIN';return n;}
function row(parent,name,w,gap=12,padding=0,bg=null){return al(parent,name,w,'HORIZONTAL',gap,padding,bg);}
function frame(parent,name,w,h,bg=null){const n=mark(figma.createFrame());n.name=name;n.resize(w,h);fill(n,bg);n.clipsContent=false;if(parent)parent.appendChild(n);return n;}
function rect(parent,name,w,h,k='line'){const n=mark(figma.createRectangle());n.name=name;n.resize(w,h);fill(n,k);if(parent)parent.appendChild(n);return n;}
function pos(n,x,y){n.x=x;n.y=y;return n;}
function fixed(n,h){n.resize(n.width,h);n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';return n;}
function space(parent){const n=frame(parent,'Espaço flexível',1,1);n.layoutSizingHorizontal='FILL';return n;}
function full(n){n.layoutSizingHorizontal='FILL';return n;}
async function txt(parent,value,role='Body',k='text',w=null){const n=mark(figma.createText());n.name=value.split('\n')[0].slice(0,65);n.fontName={family:'Figtree',style:STATE.foundations.types[role][2]};n.characters=value;await n.setTextStyleIdAsync(STATE.foundations.styles[role]);n.fills=[paint(k)];n.textAutoResize=w?'HEIGHT':'WIDTH_AND_HEIGHT';if(w)n.resize(w,n.height);if(parent)parent.appendChild(n);return n;}
function textProp(c,t,name){const key=c.addComponentProperty(name,'TEXT',t.characters);t.componentPropertyReferences={characters:key};return key;}
function component(name,w,h,dir='VERTICAL',gap=12,padding=20,bg='surface'){const n=mark(figma.createComponent());n.name=name;n.layoutMode=dir;n.resize(w,h);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';n.itemSpacing=gap;bind(n,'itemSpacing','space/'+gap);pad(n,padding);fill(n,bg);radius(n);n.counterAxisAlignItems=dir==='HORIZONTAL'?'CENTER':'MIN';return n;}
async function icon(parent,name,size=20,k='muted'){if(STATE.components['Icon/'+name]){const c=await figma.getNodeByIdAsync(STATE.components['Icon/'+name]);const n=c.createInstance();parent.appendChild(n);n.resize(size,size);ids.push(...allIds(n));for(const v of n.findAllWithCriteria({types:['VECTOR']})){if(v.strokes.length)v.strokes=[paint(k)];if(v.fills.length)v.fills=[paint(k)];}return n;}const svg=ICONS[name];if(!svg)throw Error('Ícone inexistente: '+name);const n=mark(figma.createNodeFromSvg(svg));n.name='Icon/'+name;n.resize(size,size);if(parent)parent.appendChild(n);ids.push(...n.findAll(()=>true).map(x=>x.id));for(const v of n.findAllWithCriteria({types:['VECTOR']})){if(v.strokes.length)v.strokes=[paint(k)];if(v.fills.length)v.fills=[paint(k)];}return n;}
async function instance(parent,key,props={},width=null){const c=await figma.getNodeByIdAsync(STATE.components[key]);if(!c||c.type!=='COMPONENT')throw Error('Componente inexistente '+key);const n=c.createInstance();parent.appendChild(n);ids.push(...allIds(n));const overrides={};for(const[k,v]of Object.entries(props)){const p=Object.keys(n.componentProperties).find(x=>x.split('#')[0]===k);if(!p)throw Error('Propriedade inexistente '+key+'/'+k);overrides[p]=v;}if(Object.keys(overrides).length)n.setProperties(overrides);if(width)n.resize(width,n.height);return n;}
function target(n,key,trigger='ON_CLICK'){let root=n;while(root.parent&&root.parent.type!=='PAGE')root=root.parent;links.push({id:n.id,key,trigger,root:root.id});return n;}
async function button(parent,label,kind='Primary',ico=null,key=null,width=null){const props={Label:label,ShowIcon:!!ico};if(ico)props.Icon=STATE.components['Icon/'+ico];const n=await instance(parent,'Button/'+kind+'/Default',props,width);if(ico)for(const v of n.findAllWithCriteria({types:['VECTOR']})){if(v.strokes.length)v.strokes=[paint(kind==='Primary'?'action/on':'action')];if(v.fills.length)v.fills=[paint(kind==='Primary'?'action/on':'action')];}if(key)target(n,key);return n;}
async function ib(parent,ico,key=null){const n=await icon(parent,ico,20,'muted');const box=row(parent,'Ação/'+ico,36,0,8);parent.appendChild(box);box.appendChild(n);box.counterAxisAlignItems='CENTER';box.primaryAxisAlignItems='CENTER';fixed(box,36);if(key)target(box,key);return box;}
async function badge(parent,label,tone='Neutral'){const n=await instance(parent,'Badge/'+tone,{Label:label});return n;}
function line(parent,w){return rect(parent,'Divisor',w,1,'line');}
async function input(parent,value,w=300,ico='ChevronDown',key=null,state='Default'){const n=await instance(parent,'Field/'+state,{Value:value,Icon:STATE.components['Icon/'+ico]},w);if(key)target(n,key);return n;}
async function labelValue(parent,label,value,w){const n=al(parent,label,w,'VERTICAL',6);await txt(n,label,'SmallStrong','muted',w);await txt(n,value,'Body','text',w);return n;}
function svgPlot(parent,svg,w,h,name){const n=mark(figma.createNodeFromSvg(svg));n.name=name;n.resize(w,h);parent.appendChild(n);ids.push(...n.findAll(()=>true).map(x=>x.id));return n;}
async function metric(parent,label,value,detail,w,tone='muted'){return await instance(parent,'Metric',{Label:label,Value:value,Detail:detail},w);}
function evidence(root){const nodes=root.findAll(()=>true);const counts={};for(const n of nodes)counts[n.type]=(counts[n.type]||0)+1;return {id:root.id,name:root.name,width:root.width,height:root.height,descendants:nodes.length,counts};}
