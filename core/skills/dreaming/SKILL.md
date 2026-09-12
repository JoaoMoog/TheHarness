---
name: dreaming
description: Turn what closed sessions can be read to say into candidate decisions. Use when a session reaches done with consolidation material pending, or on /dream; never before the request.
version: 1.0.0
sfa: "scope: the sessions closed since the last pass | format: candidate blocks in _dreams.md | audience: the human who promotes or discards them, and every session after that"
stacks: []
alwaysApply: false
---

# dreaming

## Rules

A session ends and everything it learned goes with it. The next one starts from
the same place, makes the same detour, and hits the same wall. Consolidation is
the step that stops that: reread what closed, find what repeats, and write it
down where the next session will see it.

It happens **between** sessions, not during one. The collector runs when a
session stops and gathers the evidence; the next session start names what is
waiting and leaves it alone, and the extraction runs when that session reaches
`done`, or when a person asks with `/dream`. A quick fix never pays for it
before its own request. Nothing here costs a session of its own, and nothing
runs while nothing has closed.

**Candidates, not memory.** Extraction writes to `_dreams.md`. Only a person
moves an entry to `_decisions.md`, through `harness dream --promote=<id>`. A
mistake in the first file is a suggestion nobody takes; the same mistake in the
second is a rule every later session inherits and none of them question.

### What clears the bar

1. **Two sessions.** One occurrence is an event. Two is a pattern. This rule
   does the most work, because almost everything interesting that happened once
   happened for a reason specific to that once.
2. **Cited evidence.** Every candidate names the sessions it rests on. A
   candidate with no session ids is an opinion with formatting.
3. **A rejected reading.** The same evidence usually supports a second
   explanation. Name it and say why it lost, exactly as a decision does.
4. **A contradiction points at what it contradicts.** If a candidate argues
   against an existing decision, link that decision. The disagreement is the
   finding. Do not quietly resolve it in favour of the newer evidence.
5. **Choices, not facts.** `_context.md` already holds what the code is. This
   file is for what the team decided about it.

### What to look for in the material

The collector reports only what is mechanically observable, so the reading is
yours to do:

| signal | the question it raises |
|---|---|
| the same phase escalating across sessions | is the phase before it handing over too little? |
| a phase running more than one pass, repeatedly | is the acceptance bar for it unstated? |
| tracks promoted from the same starting track | is the routing rule for that track wrong? |
| the same requirement ids left GAP at close | is something structurally untestable? |
| one rubric criterion consistently lowest | is the instruction it grades missing? |

A signal that appears in one session is noted and dropped. A signal that appears
in two becomes a candidate.

### Silence is a valid outcome

Most passes produce nothing. Say so in one line and stop. Writing a weak
candidate to look productive costs more than writing nothing: every future pass
reads the file, and every reader has to decide again whether the weak entry
means anything.

## Workflow

1. Read `.harness/dream-pending.json`. It lists the sessions that closed, what
   escalated, what ran twice, what was left uncovered.
2. Group the signals by shape, not by session. A group of one is dropped here.
3. For each group of two or more, write the claim in one sentence.
4. Check it against the existing decisions the material carries. If it
   contradicts one, say which; if it repeats one, drop it.
5. Name the rejected reading of the same evidence.
6. Append the block to `_dreams.md`, allocating the next `D-NNN`.
7. Run `node .github/hooks/scripts/dream-collect.mjs --consume`, so the same
   material is not named again, and say in one line how many candidates were
   written. Do not promote anything, and do not act on a candidate in the same
   session that wrote it.

## Output

One block per candidate, appended to `_dreams.md`:

```markdown
## D-012 · The spike track is chosen for work that already has a known answer

Status: open

Evidence: 038 (spike promoted to feature after one phase), 040 (same, promoted at plan)

Proposes: routing picks spike only when the question named in the request has no answer in _context.md

Rejected: removing the spike track - it was right in 036, where the answer genuinely was not known

Contradicts: none
```

When nothing clears the bar, the output is one sentence and no file change.

## Validation

- [ ] Every candidate cites at least two sessions by id.
- [ ] No candidate restates something `_context.md` already says.
- [ ] No candidate repeats an entry already in `_decisions.md`.
- [ ] A candidate that contradicts a decision names it.
- [ ] Each carries the rejected reading of the same evidence.
- [ ] Nothing was written to `_decisions.md` by this pass.

## Example

Material from three closed sessions: `041` escalated at `review`, `043`
escalated at `review`, `044` closed clean. Both escalations name the same
reviewer agent, and in both the `implement` phase ran twice.

```markdown
## D-007 · Review escalates when implement ships without the test names the plan listed

Status: open

Evidence: 041 (review escalated, implement ran twice), 043 (same pattern, same phase)

Proposes: the tasker names the test file for each task, and implement is not complete until those files exist

Rejected: raising the review threshold - the reviewer was right both times, so the bar is not the problem

Contradicts: none
```

One session with the same shape would have been left alone. Two make it a
pattern, and the candidate says which two.

## Anti-patterns

- **Promoting from the extraction itself.** Writing straight to
  `_decisions.md` removes the only step where a human sees the claim.
- **A candidate per session.** That is a log, not memory. Merge or drop.
- **Restating the code.** "The project uses TypeScript" is a fact, and
  `_context.md` already carries it.
- **Discarding without a reason.** `harness dream --discard` requires `--why`
  precisely so the same candidate is not extracted again next month.
- **Consolidating mid-session.** The material is about sessions that finished.
  A session still running has not produced its evidence yet.
