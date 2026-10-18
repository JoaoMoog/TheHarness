const fs=require('node:fs');const path=require('node:path');const root=__dirname;
const old=JSON.parse(fs.readFileSync(path.join(root,'topnav-batches.json'),'utf8'));
const side=old.slice(0,9).flat(),batches=[];
for(let i=0;i<side.length;i+=3)batches.push(side.slice(i,i+3));batches.push(...old.slice(9));
fs.writeFileSync(path.join(root,'topnav-batches.json'),JSON.stringify(batches));
for(let i=0;i<batches.length;i++){const phase='topnav-'+String(i+3).padStart(2,'0');const source=`/* COMMON */
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
/* TOPNAV_UI */
const changed=[];for(const key of ${JSON.stringify(batches[i])})changed.push(await transform(key));
return {createdNodeIds:[...new Set(ids)],mutatedNodeIds:[...touched],removedNodeIds:removed,links,changed};
`;fs.writeFileSync(path.join(root,phase+'.js'),source);}
console.log(JSON.stringify({batches:batches.length}));
