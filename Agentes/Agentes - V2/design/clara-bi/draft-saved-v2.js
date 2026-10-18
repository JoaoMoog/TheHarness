/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const d=await dashboardV2(await reuse('preview'),{draft:true,applied:true});const s=await dashboardV2(await reuse('saved'),{applied:true});const sub=s.root.findOne(n=>n.type==='TEXT'&&n.characters==='Workspace Financeiro · Jan – jun 2026 · SAP Financeiro');sub.characters='Dashboard salvo · Revisão 4 · Alterações disponíveis para a equipe';mutated.push(sub.id);return resultV2([d,s]);
