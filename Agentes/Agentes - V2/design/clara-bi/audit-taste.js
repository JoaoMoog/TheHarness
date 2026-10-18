await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
const roots=figma.currentPage.children.filter(n=>n.type==='FRAME');
const nodes=roots.flatMap(r=>[r,...r.findAll(()=>true)]);
const pageIds=new Set(nodes.map(n=>n.id)),issues=[],invalid=[],fonts=new Set();
let interactions=0,imageFills=0;
for(const n of nodes){
  if(n.type==='TEXT')for(const s of n.getStyledTextSegments(['fontName']))fonts.add(s.fontName.family);
  if('fills'in n&&Array.isArray(n.fills))imageFills+=n.fills.filter(p=>p.type==='IMAGE').length;
  if('reactions'in n&&n.reactions.length){interactions++;for(const r of n.reactions)for(const a of r.actions||[])if(a.type==='NODE'&&!pageIds.has(a.destinationId))invalid.push({id:n.id,destination:a.destinationId});}
  if((n.type==='FRAME'||n.type==='INSTANCE')&&n.layoutMode!=='NONE'&&n.visible){
    const cs=n.children.filter(c=>c.visible&&c.layoutPositioning!=='ABSOLUTE');
    for(const c of cs){
      const xo=c.x<-.5||c.x+c.width>n.width+.5,yo=c.y<-.5||c.y+c.height>n.height+.5;
      if(xo&&!['HORIZONTAL','BOTH'].includes(n.overflowDirection)||yo&&!['VERTICAL','BOTH'].includes(n.overflowDirection))issues.push({kind:'overflow',p:n.name,pid:n.id,id:c.id,n:c.name});
    }
    for(let i=1;i<cs.length;i++)if(n.layoutMode==='VERTICAL'?cs[i-1].y+cs[i-1].height>cs[i].y+.5:cs[i-1].x+cs[i-1].width>cs[i].x+.5)issues.push({kind:'collision',p:n.name,pid:n.id,id:cs[i].id,n:cs[i].name});
  }
}
const restricted=new Set(['7:2737','7:3120','27:5586','27:5861','27:6225']);const roleIssues=[];
for(const id of ['39:18819','39:19713','39:20110']){
  const r=await figma.getNodeByIdAsync(id);
  for(const n of [r,...r.findAll(()=>true)])if('reactions'in n)for(const re of n.reactions)for(const a of re.actions||[])if(a.type==='NODE'&&restricted.has(a.destinationId))roleIssues.push(n.id);
}

const pairs=[['4:631','69:20209'],['69:20209','4:631'],['69:20209','9:1775'],['4:2','28:5868'],['28:5868','28:6500'],['4:2','27:4767'],['27:4767','27:5178'],['7:2737','29:6503'],['11:3963','11:4282']];
const flowChecks=[];
for(const [source,destination] of pairs){
 const root=await figma.getNodeByIdAsync(source);
 const connected=[root,...root.findAll(()=>true)].some(n=>'reactions' in n&&n.reactions.some(r=>(r.actions||[]).some(a=>a.type==='NODE'&&a.destinationId===destination)));
 flowChecks.push({source,destination,connected});
}
const headers=nodes.filter(n=>n.name==='Navegação superior');
const headerHeights=[...new Set(headers.map(n=>n.height))];
const mobileIATouch=[];
for(const id of ['70:19669','70:19682','70:19695','70:19708']){
 const n=await figma.getNodeByIdAsync(id);mobileIATouch.push({id,width:n.width,height:n.height});
}

return {validation:{screens:roots.length,nativeNodes:nodes.length,interactiveNodes:interactions,remainingSidebars:nodes.filter(n=>['Navegação principal','Blocos e dados'].includes(n.name)).map(n=>n.id),desktopTopMenus:nodes.filter(n=>n.name==='Navegação superior').length,mobileTopMenus:nodes.filter(n=>n.name==='Navegação superior mobile').length,fonts:[...fonts],imageFills,layoutIssueCount:issues.length,issues:issues.slice(0,15),invalidDestinations:invalid,readerEditOrAdmin:roleIssues,canvasWidth:1056,revision:'Taste · BI empresarial',headerHeights,flowChecks,allFlowsConnected:flowChecks.every(x=>x.connected),mobileIATouch}};


