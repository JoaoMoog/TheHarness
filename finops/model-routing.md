# Model routing

Copilot bills usage: tokens times the rate of the model that processed them,
in AI credits (1 credit = US$ 0.01). Input, cached input, cache writes and
output are priced separately, and every model call inside an agent turn
resends the context. Routing the model to the task is still the largest
single lever, because the rate multiplies everything else; but under
usage-based billing the other levers are no longer free, and the order below
is the order in which they pay for a small change.

## What a call costs

- **Input** is the whole context: system prompt, instructions, tool
  definitions, history, tool results. It is sent on every model call.
- **Cached input** is the prefix that did not change since the previous call,
  at roughly a tenth of the input rate. It is what makes a long agent turn
  affordable, and it needs a byte-stable prefix and calls close enough in
  time for the cache to hold.
- **Cache writes** (Anthropic models) cost about a quarter more than input:
  every new context, so every sub-agent, writes one.
- **Output** costs several times the input rate: what the model writes, and
  its reasoning where the model reasons.

So the cost of a task is, roughly, model calls × context (mostly cached) +
fresh tokens (tool results, hook messages) at the input rate + output. Fewer
calls, a smaller context, less output, a cheaper model - in that order for a
small change, because the first three are what a small change gets wrong.

## Price bands, not names

Names go stale the week a newer model ships, so no agent in this harness pins
one, and the doctor warns about an agent file that pins a single name. Read
the current table on the official page - "Models and pricing for GitHub
Copilot" on docs.github.com - and think in bands of input price per million
tokens:

| band | input, per 1M tokens | what it is for |
|---|---|---|
| low | up to about US$ 1 | a patch; the tasks and deliver phases; classification, extraction, batch work |
| mid | about US$ 2-3 | the default: implement, review, debugging, a feature's code |
| high | US$ 5 and above | specify and plan of a feature or spike; hard reasoning, once, over a small context |

`Auto` is the choice when in doubt: it routes each request to a model by task
and availability. A fork that wants the coordinator-and-worker pattern may pin
a prioritised list (`model: [...]`) in a worker agent; the list, not a single
name, is what survives a model's retirement.

The plan-then-execute split is the practical form of routing: plan with the
high band, execute with the mid or low one. The expensive reasoning happens
once, over a small context, and the cheap execution happens many times.

## Prompt caching

Caching cuts input cost dramatically when the prefix is byte-stable, and gives
back nothing when it is not.

- Put the stable content first: the constitution, the instructions, the skill.
  Put the variable content last.
- No timestamps, no request ids, no random ordering anywhere in the cached
  prefix. A single changing byte invalidates the whole thing.
- Keep the model, the reasoning effort and the tool set stable within a
  session: each of them is part of the prefix.
- A human gate longer than the cache's life re-pays the prefix on the next
  turn; a sub-agent always does, because it is a new context.

This is why `core/copilot-instructions.md` is written to be static, why the
harness never injects a generated header into it, and why the session start
points at files instead of pasting them.

## Context is a concave curve

More context improves output only up to a threshold, then degrades it. Adding
noise to a prompt reliably raises cost and lowers answer quality at the same
time - the worst possible trade. Under usage-based billing the noise is also
resent on every call.

Four levers, in the order worth applying them:

1. **Do not open a context you do not need** - the direct lane for a small
   change, no sub-agent for what the chat can do itself.
2. **Compress what comes back** - `crosstk run` for tests, diffs and
   listings; a symbol instead of a file; a ranged read instead of a whole one.
3. **Compaction** - compress the history rather than resending it verbatim;
   `/compact` when a long session drifts.
4. **Retrieval on demand** - keep the loaded surface small and fetch the large
   reference only when the task asks for it, which is why skills load on
   relevance and `alwaysApply: true` needs a written justification.

## Lean prompts, lean answers

A 700-token instruction and a 50-token instruction produce the same quality on
most tasks. The difference is that the lean one leaves the attention budget
for the actual code. Write the constraint, the output shape, and nothing else.
Every sentence of encouragement is billed on every turn, forever.

The same holds for what the model writes, at several times the price: the
diff, the check output that matters, one status line, the envelope a phase
requires. A phase summary is at most 120 words.

## The cascade

Illustrative, for the smallest change the harness sees. Applied to a baseline
of a three-sub-agent session for a one-line fix on a high-band model:

| Lever | Remaining cost |
|---|---|
| Baseline: a session for every change, high band, a mandatory tool call before any read | 1.00 |
| The direct lane: no session, no sub-agent, one context | 0.35 |
| Model routing by band | 0.20 |
| Stable prefix, narrow tool sets, lean session start | 0.14 |
| Compressed tool output, no re-reads, short answers | 0.10 |

Pull them in that order. Caching a badly routed workload just makes an
expensive mistake cheaper to repeat, and routing a session that should not
exist only makes it a cheaper mistake.

## Operating it

- **Inform.** Hover a response for the credits of that turn; the context
  window control for the session; the Copilot dashboard on the Status Bar for
  the month; `/chronicle:cost-tips` for suggestions; Show Chat Debug View for
  tokens and cache hits per request. `harness cost` reports prompts, tool
  calls, sub-agents and tool output per session and per track, from the
  hooks; `harness budget` reports what the context surface costs per tier.
- **Optimise.** Direct lane first, then routing, then caching, then
  compression.
- **Operate.** Weekly review, and a re-check when model prices and tiers move.

The number that matters is still cost per delivered outcome, not per token. A
tier that costs twice as much and halves the retries is cheaper. `harness
cost` reports the outcomes so that trade can be seen rather than assumed.
