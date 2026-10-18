import {readFileSync,writeFileSync} from 'node:fs';
const p=JSON.parse(readFileSync('package.json','utf8'));
p.scripts.studio='node scripts/studio.mjs';p.scripts['studio:start']='node scripts/studio.mjs --production';p.scripts['contracts:studio']='tsx scripts/export-studio-contract.ts';
writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
for(const name of ['workspace','business','continuity','evolution']){
 const path=`tests/e2e/${name}.spec.ts`;
 writeFileSync(path,readFileSync(path,'utf8').replaceAll("page.goto('/')","page.goto('/classic')").replaceAll("page.goto('/?view=home')","page.goto('/classic?view=home')"));
}
