import fs from 'node:fs';
import { sapSource } from '../../app/src/server/seed.ts';
const source=sapSource('finance','prototype');
const total=source.rows.reduce((s,r)=>s+r.value,0);
const budget=source.rows.reduce((s,r)=>s+r.budget,0);
const groups=Object.fromEntries([...new Set(source.rows.map(r=>r.group))].map(g=>[g,source.rows.filter(r=>r.group===g).reduce((s,r)=>({actual:s.actual+r.value,budget:s.budget+r.budget}),{actual:0,budget:0})]));
const trend=[...new Set(source.rows.map(r=>r.period))].map(month=>({month,value:source.rows.filter(r=>r.period===month).reduce((s,r)=>s+r.value,0)}));
function luminance(hex){const c=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function ratio(a,b){const x=luminance(a),y=luminance(b);return Math.round((Math.max(x,y)+.05)/(Math.min(x,y)+.05)*100)/100;}
const contrast={inkOnWhite:ratio('#102846','#FFFFFF'),mutedOnWhite:ratio('#53657B','#FFFFFF'),whiteOnAction:ratio('#FFFFFF','#2166D1'),onNavy:ratio('#C4D4ED','#0B2348'),warningOnSoft:ratio('#895100','#FFF4E3'),blueOnSoft:ratio('#2166D1','#EAF1FC')};
const result={source:'app/src/server/seed.ts',records:source.rows.length,total,budget,difference:total-budget,percentDifference:(total-budget)/budget*100,groups,trend,contrast,checks:{totals:total===8190000&&budget===8318880,technology:groups.Tecnologia.actual-groups.Tecnologia.budget===132480,normalTextContrast:Object.values(contrast).every(v=>v>=4.5)}};
fs.writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(Object.values(result.checks).some(v=>!v))process.exitCode=1;
