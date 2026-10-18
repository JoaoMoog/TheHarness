/* COMMON */
await figma.setCurrentPageAsync(await figma.getNodeByIdAsync('0:1'));
/* TOPNAV_UI */
/* TASTE_UI */
const changed=[];for(const key of ["saved","exportReady","importError","mobileDashboard"])changed.push(await improve(key));
return {createdNodeIds:[...new Set(ids)],mutatedNodeIds:[...touched],removedNodeIds:removed,links,changed};
