---
applyTo: "**"
description: How tests are written and when they are required, including the failing-test-first rule for bug fixes.
---

# Testing

## The order

A bug fix starts with a test that reproduces the bug and fails for the right
reason. A feature starts with a test that states the behaviour you want. Only
then does implementation code get written.

If a test passes the first time you run it against unchanged code, it is not
testing what you think it is. Make it fail deliberately before you trust it.

A change with no observable behaviour — text, a version, formatting, dead
code — has no test to write. Say so and move on; do not invent one.

## Structure

Arrange, act, assert — with a blank line between the three. One behaviour per
test. If you need "and" to describe what a test checks, split it.

Name the behaviour, not the method:

- `returns an empty array when no records match` — good
- `test search` — useless six months from now

## What to assert

Assert on observable behaviour: the return value, the emitted event, the stored
row, the rendered text. Do not assert on private fields, call counts of internal
functions, or the shape of intermediate state — those turn every refactor into a
test rewrite.

## Test doubles

Mock what you do not own and cannot run: third-party APIs, clocks, randomness,
the network. Do not mock the thing under test, and do not mock your own database
layer if a real one can run in the suite — a mock that drifts from reality
passes while production breaks.

## Coverage

Coverage is a floor, not a goal. Aim for 80% as a signal that the important
paths are exercised, and spend the effort on the branches that carry risk: error
handling, boundaries, permissions, and the empty and maximum cases.

## When a test fails

Read the failure before changing anything. Fix the implementation, not the
assertion — unless the assertion encodes a contract that is genuinely wrong, in
which case say so explicitly rather than quietly editing it.

Never delete, skip, or loosen a failing test to make a suite green. A skipped
test is a defect with a note attached.
