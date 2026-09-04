---
name: refactor-safely
description: Restructure code without changing behaviour, in reviewable steps that keep the suite green throughout. Use when improving structure, removing duplication or preparing for a feature.
version: 1.0.0
sfa: "scope: one module or seam | format: a sequence of behaviour-preserving commits | audience: the reviewer of the refactor"
globs: []
stacks: []
alwaysApply: false
---

# refactor-safely

## Rules

The change-size rules live in `code-style.instructions.md`, already loaded. This
skill is the procedure for a behaviour-preserving restructure.

What the instruction does not cover:

- Tests green before you start. Without a passing suite you cannot tell a
  refactor from a regression, so write the missing tests as a separate change
  first.
- Steps small enough that the suite stays green between each one. If a step
  needs a broken intermediate state, the step is too big.
- One kind of change per commit. A rename, a move and a signature change are
  each trivially reviewable alone and impossible to review together.
- Duplication earns extraction on the third occurrence, not the second. Two
  similar blocks often diverge, and a premature abstraction is harder to undo
  than the duplication it replaced.

Anti-patterns to refuse:

- refactoring and fixing a bug in the same commit
- deleting code because it looks unused, without confirming it

## Workflow

1. Confirm the suite passes. Record the result.
2. State the target structure and why the current one is a problem.
3. List the steps, each individually green.
4. Apply one step. Run the suite. Commit.
5. Repeat until the target is reached.
6. Diff the public surface. Anything that changed was not a pure refactor -
   either revert it or split it out and say so.

## Output

```
Goal: extract the retry policy out of HttpClient so it can be tested alone
Suite before: 214 passing

Steps
1. Extract retry logic into a private method            green, committed
2. Move the method to RetryPolicy, called from client   green, committed
3. Inject RetryPolicy through the constructor           green, committed

Public surface: unchanged
Suite after: 214 passing
```

## Validation

- [ ] The suite passed before the first step and after every step.
- [ ] No behaviour changed; the public surface diff is empty or explained.
- [ ] Each commit is one kind of change.
- [ ] No unrelated formatting is in the diff.
- [ ] Extraction was justified by real repetition, not anticipated repetition.
