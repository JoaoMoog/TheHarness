// Synthetic data only, inside the fixed ignored .validation directory. No personal files.
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("../.validation/v061-large/",import.meta.url));
const profile=fileURLToPath(new URL("../.validation/v061-profile/",import.meta.url));
await mkdir(root,{recursive:true});await mkdir(profile,{recursive:true});
async function fresh(name,text){try{await writeFile(name,text,{flag:"wx"});}catch(e){if(e.code!=="EEXIST")throw e;}}
await fresh(path.join(profile,"repositories.txt"),root+"\n");
await fresh(path.join(root,".gitignore"),"*.log\nsecret/\n");
await fresh(path.join(root,"sample.ts"),"export function add(a:number,b:number){\nreturn {sum:a+b,label:'  preserved  '}\n}\n");
await fresh(path.join(root,"sample.tsx"),"export const Sample=()=>{return <div><span>Hello</span></div>}\n");
await fresh(path.join(root,"sample.py"),"def greet( name ):\n    return { 'name':name, 'text':'  preserved  ' }\n");
await fresh(path.join(root,"sample.cs"),"class Sample {\npublic int Add(int a,int b){\nreturn a+b;\n}\n}\n");
for(let pack=0;pack<42;pack++){
 const folder=path.join(root,"node_modules",`package-${pack}`);await mkdir(folder,{recursive:true});
 for(let offset=0;offset<1000;offset+=25)await Promise.all(Array.from({length:25},(_,i)=>fresh(path.join(folder,`dependency-${offset+i}.js`),"export const ignoredDependency = true;\n")));
}
const src=path.join(root,"new-files");await mkdir(src,{recursive:true});
for(let offset=0;offset<2100;offset+=25)await Promise.all(Array.from({length:25},(_,i)=>fresh(path.join(src,`f-${offset+i}.ts`),"export const value = 1;\n")));
await fresh(path.join(root,"ignored.log"),"ignored\n");
console.log(JSON.stringify({root,profile,dependencies:42000,visibleNewFiles:2100}));
