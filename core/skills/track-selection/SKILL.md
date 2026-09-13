---
name: track-selection
description: Choose which phases a session actually runs, so a typo does not get a specification and a feature does not skip one. Use at the start of every session, before any phase begins.
version: 1.0.0
sfa: "scope: one request | format: a named track with the reason and the phases | audience: the person who will approve it"
stacks: []
alwaysApply: false
---

# track-selection

## Rules

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
regardless of how small it looked.

The base branch is confirmed in the same stop as the track: `Production` by
default, or the current branch when the person wants to continue on it. The
work branch `<type>/<slug>` is created from that base, and the pull request
targets it. One stop, two answers; a session that guesses the base delivers
to the wrong place.

**Promotion is the safety net.** Any track can be promoted mid-session when the
work turns out larger than it looked. A patch that touches authorisation becomes
a fix; a fix that needs a design decision becomes a feature. Promotion is
announced, recorded in the session file, and restarts at the first phase the new
track adds. Continuing on a track you have outgrown is the failure this rule
exists to prevent.

Anti-patterns to refuse:

- putting a typo through specify, plan and tasks because the process says so.
  A process people route around is worse than a shorter one they follow
- choosing `feature` because the request is vague. Vague means ask, not escalate
- choosing `patch` for anything that touches auth, crypto, payment, money or a
  production schema. Those are never patches
- staying on a short track after discovering it was the wrong one

## Workflow

1. Restate the request in one sentence.
2. Answer the two questions above and name the track.
3. State, in one line, what the omitted phases would have added and why the
   request does not need it. If you cannot, pick the longer track.
4. Show the phases the session will run, and the token budget for that track.
5. Ask the human to confirm the track and the base branch, `Production` by
   default or the current branch, in one message. This is the cheapest
   correction in the whole session.
6. Record the track, the reason, the base branch and the work branch in
   `session.md` before the first phase runs.

## Output

```
Request: the export button label says "Exprot"

Track: patch
  behaviour: unchanged
  decision needed first: no
  omitting specify, plan, tasks - there is no criterion to write and no
  ordering to decide for a one-word label

Phases: implement -> review -> deliver
Budget: 115k tokens

Base branch: Production (default), or continue on the current branch
feature/reports? Work branch: patch/export-label, created from the base.

Promotes to fix if the label turns out to come from a translation file that
other screens share.
```

## Validation

- [ ] The track is named and is one of the six.
- [ ] The two questions were answered explicitly.
- [ ] The omitted phases are justified in one line each, or the longer track was
      chosen instead.
- [ ] The track delivers only if it includes review.
- [ ] The human confirmed the track and the base branch before the first
      phase ran.
- [ ] The track, the reason, the base branch and the work branch are in
      `session.md`.
