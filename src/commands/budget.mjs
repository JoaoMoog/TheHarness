import { contextBudget } from '../lib/context-budget.mjs';
import { BUDGETS } from '../lib/contracts.mjs';

export default function budget(args) {
  const targets = args.target ? [args.target] : ['copilot', 'kiro'];
  const clients = targets.map(t => contextBudget(t, args.repo ?? null));
  const result = { version: 2, limit: BUDGETS.effectiveHotTokens, clients,
    passed: clients.every(c => c.maxActiveEstimatedTokens <= BUDGETS.effectiveHotTokens),
    note: 'Estimated instruction tokens, not billed usage. Catalogs and project context are separate; unavailable values are null.' };
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log('Context budget (estimated tokens)');
    for (const c of clients) console.log(`${c.target}: ${c.estimatedTokens}/${result.limit} permanent; ${c.maxActiveEstimatedTokens} conservative maximum with agent prompt; ${c.skillCatalogEstimatedTokens} skill catalog (separate)`);
    console.log(result.note);
  }
  return result.passed ? 0 : 1;
}
