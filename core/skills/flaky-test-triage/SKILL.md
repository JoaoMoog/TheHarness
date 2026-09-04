---
name: flaky-test-triage
description: Tell a flaky test apart from an intermittent regression, and quarantine with an owner and a deadline instead of deleting the signal. Use when a test fails and passes without the code changing.
version: 1.0.0
sfa: "scope: one unreliable test | format: a verdict, a cause class, and a dated quarantine or fix | audience: the team that has stopped trusting the suite"
stacks: []
alwaysApply: false
---

# flaky-test-triage

## Rules

**Prove it is flaky before calling it flaky.** Run it in isolation, then in the
full suite, then a dozen times. A test that fails only in the suite is not
flaky — it is coupled to another test, and that is a real defect in the suite.

The dangerous mistake is the opposite one: an intermittent **regression** looks
exactly like flakiness from the outside. A race in the code under test fails one
run in twenty and gets labelled flaky, and the suite is then trained to ignore
the one signal that was telling the truth. When in doubt, treat it as a
regression: the cost of investigating a flake is an hour, the cost of ignoring a
race is an incident.

Flakiness has a small number of causes, and naming which one is most of the fix:
shared state between tests, order dependence, real time or timezone, unawaited
async, network or filesystem, randomness without a seed, and resource contention
under parallel runs.

**Quarantine is a loan, not a fix.** A skipped test needs an owner and a date in
the same commit that skips it. `skip` with no date is how a suite quietly loses
a third of its coverage over two years, and nobody can point at the day it
happened.

Never delete a failing test to make the suite green. Never add a retry to hide
it, either: a retry on a test that guards a race means production now races and
nothing will tell you.

Anti-patterns to refuse:

- `sleep` to fix a timing problem. It moves the failure to a slower machine
- an unconditional retry wrapper on the suite
- quarantining without recording the cause class you suspect
- fixing the test so it passes without knowing why it failed

## Workflow

1. Reproduce: the test alone, the test in its file, the whole suite, and the
   suite a dozen times. Record which of those fail and how often.
2. If it only fails inside the suite, look for shared state or order dependence
   first — that is a suite defect, not a flaky test.
3. Name the suspected cause class. If none of them fits, treat it as an
   intermittent regression and hand it to `debugging`.
4. Fix the cause where it is cheap: seed the randomness, inject the clock, await
   the promise, isolate the fixture.
5. If it cannot be fixed now, quarantine with an owner and a date, in the same
   commit, with the cause class written down.
6. Verify by running it a dozen times after the fix, not once.

## Output

```
test: checkout.spec.ts "applies the discount before tax"

  alone            20 of 20 pass
  in its file      20 of 20 pass
  in the suite     17 of 20 pass
  verdict          suite-coupled, not flaky

cause class: shared state - the currency fixture is mutated by pricing.spec.ts
             and never reset

fix: move the fixture into a beforeEach. No quarantine needed.
after: 20 of 20 in the full suite
```

Quarantine, when it is genuinely needed:

```
test.skip("FR-014 retries on provider timeout")
// flaky: suspected unawaited async in the retry helper
// owner: @jp   review by: 2026-10-15
// tracked: specs/044-retry-helper
```

## Validation

- [ ] It was run alone, in its file and in the full suite, several times each.
- [ ] The verdict distinguishes flaky, suite-coupled, and intermittent regression.
- [ ] A cause class is named, or it was handed to `debugging`.
- [ ] No sleep and no retry wrapper were added.
- [ ] Any quarantine carries an owner, a date and the suspected cause, in the
      same commit.
- [ ] The fix was verified over a dozen runs, not one.
