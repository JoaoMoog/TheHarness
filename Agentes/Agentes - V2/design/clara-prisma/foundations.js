const p=figma.root.children[0];
await figma.setCurrentPageAsync(p);
if(p.children.length)throw Error('Foundations already present; inspect ledger before retry');
p.name='Sistema • Prisma';
const pages={system:p.id};
for(const name of ['Desktop • Percursos','Mobile • Percursos','Conceito • Decisões','Revisão • Evidências']){const n=figma.createPage();n.name=name;pages[name]=n.id;}
const fonts=[{family:'Manrope',style:'Regular'},{family:'Manrope',style:'SemiBold'},{family:'Manrope',style:'Bold'},{family:'Manrope',style:'ExtraBold'},{family:'IBM Plex Sans',style:'Regular'},{family:'IBM Plex Sans',style:'Medium'},{family:'IBM Plex Sans',style:'SemiBold'}];
await Promise.all(fonts.map(f=>figma.loadFontAsync(f)));
const primitive=await createVariableCollection('Prisma / Primitivos',['Base']);
const semantics=await createVariableCollection('Prisma / Cores',['Claro']);
const dimensions=await createVariableCollection('Prisma / Dimensões',['Confortável']);
const palette={canvas:'#F5F4F8',surface:'#FFFFFF',ink:'#292637',muted:'#666273',brand:'#5B3AA4',brandStrong:'#44277F',brandSoft:'#ECE5FA',line:'#D4CEDD',controlBorder:'#8B829B',warning:'#A23155',warningSoft:'#FBEAF0',success:'#176A62',successSoft:'#E6F3F0',comparison:'#6B6878',onBrand:'#FFFFFF',softInk:'#F5F0FC'};
const primTokens=await createSemanticTokens(primitive.collection,primitive.modeIds,Object.entries(palette).map(([name,v])=>({name:'color/'+name,type:'COLOR',values:{Base:v},scopes:[],codeSyntax:{WEB:'var(--prisma-primitive-'+name+')'}})));
const semTokens=await createSemanticTokens(semantics.collection,semantics.modeIds,Object.entries(palette).map(([name])=>({name,type:'COLOR',values:{Claro:{type:'VARIABLE_ALIAS',id:primTokens.variables['color/'+name].id}},scopes:['TEXT_FILL','FRAME_FILL','SHAPE_FILL','STROKE_COLOR'],codeSyntax:{WEB:'var(--prisma-'+name+')'}})));
const dimTokens=await createSemanticTokens(dimensions.collection,dimensions.modeIds,[4,8,12,16,24,32,44].map(v=>({name:'space/'+v,type:'FLOAT',values:{Confortável:v},scopes:['GAP'],codeSyntax:{WEB:'var(--prisma-space-'+v+')'}})).concat([6,12].map(v=>({name:'radius/'+v,type:'FLOAT',values:{Confortável:v},scopes:['CORNER_RADIUS'],codeSyntax:{WEB:'var(--prisma-radius-'+v+')'}}))));
const styles={};
for(const [name,family,style,size,line] of [['Display','Manrope','Bold',44,54],['H1','Manrope','Bold',30,40],['H2','Manrope','SemiBold',22,30],['H3','Manrope','Bold',17,24],['Metric','Manrope','Bold',34,44],['Body','IBM Plex Sans','Regular',16,24],['UI','IBM Plex Sans','Medium',14,20],['Strong','IBM Plex Sans','SemiBold',14,20],['Small','IBM Plex Sans','Regular',13,20],['Tiny','IBM Plex Sans','Regular',12,18]]){const s=figma.createTextStyle();s.name='Prisma/'+name;s.fontName={family,style};s.fontSize=size;s.lineHeight={unit:'PIXELS',value:line};styles[name]=s.id;}
return {createdNodeIds:[p.id,...p.findAll(()=>true).map(n=>n.id),...Object.values(pages).filter(id=>id!==p.id)],pages,colors:Object.fromEntries(Object.entries(semTokens.variables).map(([k,v])=>[k,v.id])),dimensions:Object.fromEntries(Object.entries(dimTokens.variables).map(([k,v])=>[k,v.id])),styles,collections:[primitive.collection.id,semantics.collection.id,dimensions.collection.id],variableCount:41,fontFamilies:['Manrope','IBM Plex Sans']};
