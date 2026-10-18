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
return {validation:{screens:roots.length,nativeNodes:nodes.length,interactiveNodes:interactions,remainingSidebars:nodes.filter(n=>['Navegação principal','Blocos e dados'].includes(n.name)).map(n=>n.id),desktopTopMenus:nodes.filter(n=>n.name==='Navegação superior').length,mobileTopMenus:nodes.filter(n=>n.name==='Navegação superior mobile').length,fonts:[...fonts],imageFills,layoutIssueCount:issues.length,issues:issues.slice(0,15),invalidDestinations:invalid,readerEditOrAdmin:roleIssues,canvasWidth:1056,revision:'Navegação superior'}};
