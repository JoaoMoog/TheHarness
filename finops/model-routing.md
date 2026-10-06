# Model routing

Keep the client's selected model unless the user chooses otherwise.
Reduce unnecessary invocations and context before comparing models.

For the pilot, pin model, version, effort, editor configuration and initial
application state. Changing any of them invalidates a before/after comparison.

Direct work stays in the current context. Structured work uses one consolidated
planning pass, implementation and independent review. Sensitive scope retains
its specific confirmation. Do not infer a model's suitability or price from
its name or a stale rate table.

Measure locally validated outcomes and real provider usage when available.
Tool counts, output bytes and instruction estimates are separate observations.
Unavailable provider usage remains null. Cross TK is optional and its benefit
must be measured on the same workload.

See [pilot protocol](../docs/pilot.md) and [context limits](token-budgets.json).
