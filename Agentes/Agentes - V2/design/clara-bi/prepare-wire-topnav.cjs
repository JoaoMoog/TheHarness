const fs=require('node:fs'),path=require('node:path'),root=__dirname;
const s=JSON.parse(fs.readFileSync(path.join(root,'state.json'),'utf8'));
const links=Object.entries(s.phases).filter(([k])=>/^topnav-\d+$/.test(k)).flatMap(([,v])=>v.links||[]);
const unique=[...new Map(links.map(l=>[l.id+'|'+l.trigger,l])).values()];
const template=fs.readFileSync(path.join(root,'wire-v2-template.js'),'utf8');let count=0;
for(let i=0;i<unique.length;i+=160){count++;fs.writeFileSync(path.join(root,'run-wire-topnav-'+count+'.js'),template.replace('/* SCREENS */',JSON.stringify(s.screens)).replace('/* LINKS */',JSON.stringify(unique.slice(i,i+160))));}
console.log(JSON.stringify({count,links:unique.length}));
