# Model routing

Routing the model to the task is the single largest cost lever in an agentic
workflow, and it is the one most often left unpulled. Running the frontier model
by default costs roughly five times the mid-tier for well under a tenth more
quality on routine work.

## The five levels

| Level | Task | Model tier |
|---|---|---|
| 1 | Completions, formatting, mechanical fixes | Small or bundled |
| 2 | Routine edits, local refactors | Bundled |
| 3 | The default: features, reviews, debugging, tests | Mid-tier |
| 4 | Hard reasoning: architecture, distributed debugging | Frontier, scoped to planning |
| 5 | Long-context forensics across a large corpus | Long-context model |

Level 3 covers roughly four fifths of agentic work. Make it the default and let
levels 4 and 5 be a deliberate choice with a reason attached.

The plan-then-execute split is the practical form of this: plan with the
frontier model, execute the plan with the mid-tier one. The expensive reasoning
happens once, over a small context, and the cheap execution happens many times.

## Prompt caching

Caching cuts input cost dramatically when the prefix is byte-stable, and gives
back nothing when it is not.

- Put the stable content first: the constitution, the instructions, the skill.
  Put the variable content last.
- No timestamps, no request ids, no random ordering anywhere in the cached
  prefix. A single changing byte invalidates the whole thing.
- Caching pays for itself above roughly three reads per write, so it helps most
  in exactly the long sessions where cost hurts.

This is why `core/copilot-instructions.md` is written to be static, and why the
harness never injects a generated header into it.

## Context is a concave curve

More context improves output only up to a threshold, then degrades it. Adding
noise to a prompt reliably raises cost and lowers answer quality at the same
time — the worst possible trade.

Three levers, in the order worth applying them:

1. **Compaction** — compress the history rather than resending it verbatim.
2. **Tool-result clearing** — drop verbose tool output once the fact you needed
   has been extracted.
3. **Retrieval on demand** — keep the loaded surface small and fetch the large
   reference only when the task asks for it.

That last one is why skills are loaded on relevance rather than always, and why
`alwaysApply: true` requires a written justification in this harness.

## Lean prompts

A 700-token instruction and a 50-token instruction produce the same quality on
most tasks. The difference is that the lean one leaves the attention budget for
the actual code.

Write the constraint, the output shape, and nothing else. Every sentence of
encouragement is billed on every turn, forever.

## The cascade

The levers compound, and order matters. Applied to a baseline of running the
frontier model by default:

| Lever | Remaining cost |
|---|---|
| Baseline | 1.00 |
| Model routing, mid-tier default | 0.50 |
| Prompt caching, stable prefix | 0.28 |
| Compaction and tool-result clearing | 0.22 |
| Lean prompts, progressive disclosure | 0.18 |

Pull them in that order. Caching a badly routed workload just makes an expensive
mistake cheaper to repeat.

## Operating it

- **Inform.** Know cost per feature and per user before optimising anything.
- **Optimise.** Routing first, then caching, then compaction.
- **Operate.** Weekly review, anomaly alerting, and a quarterly re-check when
  model prices and tiers move.

Run `harness budget` to see what this repository context surface actually costs
per tier before assuming where the spend is.

## What each tier costs, relative to the cheapest

The spread between tiers is wide enough that the routing decision dominates
every other saving. Reaching for the frontier tier on routine work costs
twenty times the utility tier and buys almost nothing back.

| Task | Tier | Relative cost |
|---|---|---|
| Inline completion | utility | 1x |
| A question in chat | utility | 1x |
| A single-file edit | mid | 4x |
| A multi-file refactor | frontier | 20x |
| Architectural design, hard debugging | frontier | 20x |

This is why the phase agents declare a model. `specifier` and `planner` reason
over a small context and earn the frontier tier; `implementer` and `tasker`
execute a decision that was already made, and do not.

The number that matters is still cost per delivered outcome, not per token. A
tier that costs twice as much and halves the retries is cheaper. `harness cost`
reports the outcomes so that trade can be seen rather than assumed.
