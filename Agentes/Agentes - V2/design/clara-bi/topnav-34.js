/* COMMON */
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
/* TOPNAV_UI */
const changed=[];for(const key of ["mobileDashboard","mobileDraft","mobileCreate","mobileAI"])changed.push(await transform(key));
return {createdNodeIds:[...new Set(ids)],mutatedNodeIds:[...touched],removedNodeIds:removed,links,changed};
