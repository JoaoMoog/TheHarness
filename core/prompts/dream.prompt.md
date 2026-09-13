---
mode: agent
description: Consolidate the pending material from closed sessions into candidate decisions now, instead of at the end of a session.
version: 1.0.0
---

Consolidate now. Read `.harness/dream-pending.json`; if it does not exist, say
"nothing pending" in one line and stop.

Apply the `dreaming` skill to the material: group the signals by shape, keep
only what two or more sessions support, cite the sessions, name the rejected
reading, and append the candidates to `<specs>/_dreams.md` following
`templates/dreams.md`. Nothing is written to `<specs>/_decisions.md`; promotion
is `harness dream --promote`, a human action.

Then run `node .github/hooks/scripts/dream-collect.mjs --consume`, so the same
material is not named again, and report in one line how many candidates were
written. Zero is a valid answer.
