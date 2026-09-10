# session

The state machine a multi-agent session runs as. The orchestrator owns it; the
phase agents each own one step of it.

Budget: see `budgets.json`. One pass through the phases, 220k tokens, stop when
the review verdict is approve or approve-with-comments and the tests pass.

## Why this is a state machine and not a loop

A loop retries until a criterion is met. A session advances through phases that
each produce a different artifact, and going back is a decision a human makes,
not something the machine does on its own. Calling it a loop invited the
previous version to declare an escalation condition that could never fire.

## The phases

| phase | agent | consumes | produces |
|---|---|---|---|
| specify | `specifier` | the request, `specs/_context.md` | `spec.md` |
| plan | `planner` | `spec.md`, session summaries | `plan.md` |
| tasks | `tasker` | `plan.md`, session summaries | `tasks.md` |
| implement | `implementer` | one task, its criteria, session summaries | code and tests |
| review | `reviewer`, `security` | the change, spec and plan summaries | a verdict |
| deliver | `azure-devops` | the verdict, the changed files, summaries | a draft pull request |

## What the orchestrator carries

`session.md`, and nothing else. Each phase gets the summaries plus the artifact
of the phase immediately before it. The full text of earlier artifacts stays on
disk.

The implement envelope carries its verification record: what ran, the result,
and the tree state from `node .github/tools/verify/tree-state.mjs`. Review runs
its own checks once, because an independent run is its contract. Scoring,
deliver and any retry reuse the newest record for the same tree state rather
than running the suite again on a tree nobody changed.

This is the whole reason the session stays affordable: the accumulated
transcript is resent on every turn, so a parent that holds every artifact grows
faster than the work does. The parent holds summaries; the children hold detail.

## Gates

Every transition is a human action. The phase agent finishes, the orchestrator
records the summary and reports, and a handoff button advances. `send: false` on
every handoff is deliberate: the button appears, the human reads the artifact,
and then it moves.

The orchestrator refuses to advance when the previous phase is not complete, and
refuses to run a Q3 or Q4 task without the confirmation that quadrant requires.

A `warn` finding never holds a gate. It names a problem that already existed
in a file the change touched, with the suggested improvement; it is recorded
under Warnings in `session.md`, carried into the pull request body, and not
sent back to implement. Touching a file is not a request to fix everything in
it.

## Review rounds

`request-changes` is not a stop condition and not a restart. The orchestrator
sends `implementer` the blocker and major findings and nothing else, then sends
`reviewer` the previous verdict and the diff since that review, so the
re-review confirms each finding closed or open and reads only the new lines.
`maxReviewRounds` in `budgets.json` caps this at two. A finding still open
after the second round is escalated: the problem is upstream of the fix, and a
third round would only resend the same history at a higher price.

## Parallelism

Tasks marked parallel in `tasks.md` may run as concurrent `implementer`
instances, up to `maxParallel` in `budgets.json`. Tasks that share a file never
run in parallel, regardless of the marker: the tasker computes that from file
overlap, and the orchestrator does not second-guess it upward.

## Stop conditions

Stop and report success when the review verdict is approve or
approve-with-comments and the test stage reports a real pass.

Stop and escalate when any of these is true:

- a phase returns `blocked` or `escalated`
- the token budget is exhausted
- the same phase returns `blocked` twice, which means the problem is upstream of
  the phase that keeps failing
- a finding is still open after the second review round
- the specification has an open question that changes the shape of the result
- the next task is Q3 or Q4 and no human has confirmed it
- any hard constraint in `../CONSTITUTION.md` would be broken

## Reporting

After every phase: which phase finished, where its artifact is, what it decided,
what is still open, and which button advances. Never report the session as
complete when a phase was skipped: name the phase and say why.

## Why deliver is a phase and not a step

The work is not finished when the review approves it. It is finished when
somebody else can see it. Leaving that last step to a human means the reasoning
built up over five phases stays in the session and never reaches the pull
request, which is the one place a reviewer will actually look.

It is a separate phase rather than part of review for two reasons. Review is a
judgement and delivery is an action with effects outside the repository, so they
need different oversight. And review can return `request-changes`, in which case
there is nothing to deliver.

`deliver` is the only phase whose agent is also invocable on its own, because
opening a pull request is a thing people want outside a session too. When it
runs inside one, the session file is what supplies the description; when it runs
alone, the user does.

Its budget is the smallest of the six. If it costs more than that, the pull
request body is being written from the diff instead of from the summaries.

## Tracks: not every request runs six phases

The phase list is the longest path, not the only one. A session picks a track
first, and a track omits the phases that would add nothing:

| track | phases | budget |
|---|---|---|
| patch | implement, review, deliver | 115k |
| fix | specify, implement, review, deliver | 145k |
| refactor | plan, tasks, implement, review, deliver | 190k |
| feature | all six | 220k |
| spike | specify, plan | 80k |
| incident | implement, review, deliver | 115k |

Order is preserved; only omission is allowed. `review` is never omitted from a
track that delivers.

The reason to offer short tracks is not speed for its own sake. A process that
puts a one-word label change through a specification, a plan and a task
decomposition is a process people stop using, and an agent workflow nobody uses
protects nothing. The short tracks exist so the long one keeps its authority.

What makes them safe is promotion. Any track can be promoted when the work turns
out larger than it looked, and the promotion is announced and recorded rather
than assumed. `track-selection` owns the rule.
