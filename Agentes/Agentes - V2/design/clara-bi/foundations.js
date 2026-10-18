/* COLLECTION_HELPER */
await Promise.all(['Regular','Medium','SemiBold','Bold'].map(style=>figma.loadFontAsync({family:'Figtree',style})));
const ids=[];
const proto=figma.root.children[0];proto.name='01 · Protótipo';ids.push(proto.id);
const page=figma.createPage();page.name='02 · Componentes';ids.push(page.id);
const guide=figma.createPage();guide.name='03 · Direção visual';ids.push(guide.id);
const {collection:primitives,modeIds:primModes}=await createVariableCollection('CLARA BI · Primitivos',['Valor']);
const {collection:semantic,modeIds:colorModes}=await createVariableCollection('CLARA BI · Cores',['Claro']);
const {collection:layout,modeIds:layoutModes}=await createVariableCollection('CLARA BI · Layout',['Valor']);
const colors={white:'#FFFFFF',canvas:'#F3F6FA',soft:'#F8FAFC',navy:'#0B2348',ink:'#102846',muted:'#53657B',line:'#DCE4EE',lineStrong:'#A7BFDF',blue:'#2166D1',blueStrong:'#1853AE',blueSoft:'#EAF1FC',teal:'#087F8C',green:'#176847',greenSoft:'#E6F2EC',amber:'#895100',amberSoft:'#FFF4DE',red:'#B42328',redSoft:'#FFF1F1',budget:'#6B7E96'};
const rgb=h=>({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const variables={};const values={};
for(const[k,h]of Object.entries(colors)){const v=figma.variables.createVariable('palette/'+k,primitives,'COLOR');v.scopes=[];v.setValueForMode(primModes.Valor,rgb(h));v.setVariableCodeSyntax('WEB','var(--clara-bi-palette-'+k+')');variables[v.name]=v.id;values[v.name]=h;}
const roleMap={surface:'white',canvas:'canvas',subtle:'soft',brand:'navy',text:'ink',muted:'muted',line:'line','line/strong':'lineStrong',action:'blue','action/hover':'blueStrong','action/soft':'blueSoft','action/on':'white','chart/actual':'blue','chart/budget':'budget','chart/secondary':'teal',success:'green','success/soft':'greenSoft',warning:'amber','warning/soft':'amberSoft',danger:'red','danger/soft':'redSoft'};
const cssMap={surface:'surface',canvas:'canvas',brand:'navy',text:'ink',muted:'text-secondary',line:'line','line/strong':'accent',action:'primary','action/hover':'primary-strong','action/soft':'primary-soft','chart/secondary':'comparison',success:'success',warning:'warning',danger:'danger'};
for(const[k,p]of Object.entries(roleMap)){const v=figma.variables.createVariable('color/'+k,semantic,'COLOR');v.scopes=['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR'];v.setValueForMode(colorModes.Claro,{type:'VARIABLE_ALIAS',id:variables['palette/'+p]});v.setVariableCodeSyntax('WEB','var(--'+(cssMap[k]||'clara-bi-'+k.replaceAll('/','-'))+')');variables[v.name]=v.id;values[v.name]=colors[p];}
const sizes={'space/4':4,'space/8':8,'space/12':12,'space/16':16,'space/20':20,'space/24':24,'space/32':32,'space/40':40,'space/48':48,'radius/control':6,'radius/panel':8,'radius/dialog':12,'size/control':40,'size/touch':44};
for(const[k,x]of Object.entries(sizes)){const v=figma.variables.createVariable(k,layout,'FLOAT');v.scopes=k.startsWith('radius')?['CORNER_RADIUS']:k.startsWith('size')?['WIDTH_HEIGHT']:['GAP'];v.setValueForMode(layoutModes.Valor,x);v.setVariableCodeSyntax('WEB','var(--clara-bi-'+k.replaceAll('/','-')+')');variables[k]=v.id;values[k]=x;}
const types={Page:[28,36,'SemiBold'],Title:[20,28,'SemiBold'],Section:[16,24,'SemiBold'],Body:[14,20,'Regular'],BodyStrong:[14,20,'SemiBold'],Label:[13,20,'Medium'],Small:[12,18,'Regular'],SmallStrong:[12,18,'SemiBold'],Metric:[32,40,'SemiBold'],HeroMetric:[40,48,'SemiBold'],Wordmark:[24,28,'Bold']};const styles={};
for(const[k,[size,line,weight]]of Object.entries(types)){const s=figma.createTextStyle();s.name='CLARA BI/'+k;s.fontName={family:'Figtree',style:weight};s.fontSize=size;s.lineHeight={unit:'PIXELS',value:line};s.letterSpacing={unit:'PERCENT',value:k==='Page'||k==='Metric'?-2:0};styles[k]=s.id;}
const effect=figma.createEffectStyle();effect.name='CLARA BI/Overlay';effect.effects=[{type:'DROP_SHADOW',color:{r:.04,g:.14,b:.28,a:.14},offset:{x:0,y:12},radius:40,spread:0,visible:true,blendMode:'NORMAL'}];
return {createdNodeIds:ids,pages:{prototype:proto.id,components:page.id,guide:guide.id},variables,values,types,styles,effect:effect.id,collections:{primitives:primitives.id,color:semantic.id,layout:layout.id},tokenCount:Object.keys(variables).length,textStyleCount:Object.keys(styles).length};
