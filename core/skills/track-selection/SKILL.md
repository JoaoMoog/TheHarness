---
name: track-selection
description: Decide whether a request is a direct change in the chat or a session, and which phases the session runs, so a typo gets no specification and a feature skips none. Use at the start of every session.
version: 1.1.0
sfa: "scope: one request | format: direct, or a named track with the reason, the phases and the model tier | audience: the person who will approve it"
stacks: []
alwaysApply: false
---

# track-selection

## Rules

First, the question that costs nothing to ask: **is this a session at all?** A
request that fits the direct lane - one sentence to state, at most three
files, no behaviour change or one existing check that proves it, no sensitive
area - is not. Say so in one line and stop; the chat makes the change without
a track, a confirmation, a sub-agent or a pull request. A session pays for a
confirmation, three contexts and a pull request before the edit; a direct
change pays for the edit. The person can still ask for `/deliver` afterwards.

Every session runs a track, and a track is an ordered subset of the six phases.
Phases may be omitted; they are never reordered, and none is invented.

Pick by asking two questions in order:

1. **Does observable behaviour change?** No means `patch` or `refactor`. Yes
   means `fix` or `feature`.
2. **Does the change need a written decision before code?** No means the short
   track; yes means the long one.

Two tracks are chosen before the two questions, as early exits. Production
broken right now is an `incident`: mitigate first, understand second, and it
must end with a runbook and a follow-up `fix` session for the root cause. A
question rather than a change is a `spike`, and a spike never opens a pull
request. If it ends with code, it was not a spike.

`review` is never omitted from a track that delivers. Nothing ships unreviewed,
regardless of how small it looked. On `patch` the review is the orchestrator
reading the diff against `code-review`; `reviewer` and `security` are invoked
only when the diff touches a sensitive area.

The base branch is confirmed in the same stop as the track: `Production` by
default, or the current branch when the person wants to continue on it. The
work branch `<type>/<slug>` is created from that base, and the pull request
targets it. One stop, two answers; a session that guesses the base delivers
to the wrong place.

The same stop names the model tier the track deserves, because the model
selected in the chat runs every phase and sub-agent, and credits are tokens
times the model's rate: the low-cost tier for `patch` and for the tasks and
deliver phases, the mid tier for implement and review, the frontier tier only
for specify and plan of a feature or spike. Tiers, never names: names go
stale; `finops/model-routing.md` says how to read the price table.

**Promotion is the safety net.** Any track can be promoted mid-session when the
work turns out larger than it looked. A patch that touches authorisation becomes
a fix; a fix that needs a design decision becomes a feature. Promotion is
announced, recorded in the session file, and restarts at the first phase the new
track adds. Continuing on a track you have outgrown is the failure this rule
exists to prevent.

Anti-patterns to refuse:

- opening a session, with its confirmation, phases and pull request, for a
  change the direct lane covers. The session is the expensive path, and it
  buys nothing for a one-line edit
- putting a typo through specify, plan and tasks because the process says so.
  A process people route around is worse than a shorter one they follow
- choosing `feature` because the request is vague. Vague means ask, not escalate
- choosing `patch` for anything that touches auth, crypto, payment, money or a
  production schema. Those are never patches, and never direct
- staying on a short track after discovering it was the wrong one

## Workflow

1. Restate the request in one sentence.
2. Decide whether it is a session at all. Direct lane: say so and stop.
3. Answer the two questions above and name the track.
4. State, in one line, what the omitted phases would have added and why the
   request does not need it. If you cannot, pick the longer track.
5. Show the phases the session will run, the token budget for that track, and
   the model tier that fits it.
6. Ask the human to confirm the track and the base branch, `Production` by
   default or the current branch, in one message. This is the cheapest
   correction in the whole session.
7. Record the track, the reason, the base branch and the work branch in
   `session.md` before the first phase runs.

## Output

A direct change:

```
Request: the export button label says "Exprot"

Direct: one file, no behaviour change, the UI lint proves it. No session;
fixing it here.
```

A session:

```
Request: rename the "Exprot" label and open the pull request today

Direct lane: no. The person asked for the pull request the harness opens,
with its body and its record.

Track: patch
  behaviour: unchanged
  decision needed first: no
  omitting specify, plan, tasks - there is no criterion to write and no
  ordering to decide for a one-word label
  review: the orchestrator reads the diff; no sensitive area, so reviewer
  and security are skipped and the session says so

Phases: implement -> review -> deliver
Budget: 115k tokens
Model tier: low-cost is enough for this track

Base branch: Production (default), or continue on the current branch
feature/reports? Work branch: patch/export-label, created from the base.

Promotes to fix if the label turns out to come from a translation file that
other screens share.
```

## Validation

- [ ] A request the direct lane covers was not made a session.
- [ ] The track is named and is one of the six.
- [ ] The two questions were answered explicitly.
- [ ] The omitted phases are justified in one line each, or the longer track was
      chosen instead.
- [ ] The track delivers only if it includes review.
- [ ] The human confirmed the track and the base branch before the first
      phase ran, and saw the model tier the track deserves.
- [ ] The track, the reason, the base branch and the work branch are in
      `session.md`.
