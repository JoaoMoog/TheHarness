/* COMMON */
const page=await figma.getNodeByIdAsync(STATE.foundations.pages.prototype);await figma.setCurrentPageAsync(page);
/* UI */
/* V2_UI */
const d=await dashboardV2(await reuse('dashboard'));
const f=await dashboardV2(await reuse('filtered'),{filtered:true});
return resultV2([d,f]);
