import type {Proposal} from './contracts';

// Keep the stored contracts for a future release; the current product is analysis-only.
export function isDeferredProposal(proposal:Proposal|null|undefined){
 return !!proposal&&(['scenario','forecast'].includes(proposal.kind)||proposal.patch.screen==='scenarios'||proposal.patch.percent!==undefined||proposal.patch.scenarioCenter!==undefined);
}
