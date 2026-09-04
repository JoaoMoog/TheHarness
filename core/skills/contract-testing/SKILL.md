---
name: contract-testing
description: Pin the boundary between two services with a checked-in contract and tests both sides run, so an integration breaks in CI instead of in production. Use when a change touches an API either side of a boundary.
version: 1.0.0
sfa: "scope: one boundary between two services | format: a contract file plus a test on each side | audience: both teams, one of whom will change it without asking"
stacks: []
alwaysApply: false
---

# contract-testing

## Rules

The contract is a file, versioned next to the spec at
`specs/<id>-<slug>/contracts/<name>.yaml`. Not a wiki page, not a shared
understanding. If it is not in git, the two sides will drift and neither will
notice until a user does.

**Mocks on both sides prove nothing.** The consumer mocks the provider, the
provider mocks the consumer, both suites are green, and production disagrees.
That is the defect this skill exists to prevent, and it is why a boundary needs
its own test rather than more unit tests.

Both sides test **against the contract**, not against each other. The consumer
proves it can handle what the contract promises; the provider proves it produces
what the contract promises. Neither test needs the other service running.

**Additive changes are safe; everything else is a version.** A new optional
field is safe. Removing a field, renaming one, tightening validation, changing a
default or narrowing a type are all breaking, and they need a version and a
window even when the only consumer is you.

Errors are part of the contract. Status codes and error shapes are what the
consumer branches on, so a contract that only describes the happy response has
specified the easy half.

Anti-patterns to refuse:

- generating the contract from the current implementation, which makes today
  behaviour the specification including its bugs
- a contract with only the 200 response
- changing a shared contract inside a feature branch without a version
- testing the boundary by calling the real service in CI, which turns someone
  else outage into your red build

## Workflow

1. Write or update the contract file: request shape, response shape, every
   status code, and the error body for each.
2. Provider side: a test that asserts the real handler produces exactly the
   contract shapes, including the error paths.
3. Consumer side: a test that runs against a stub built **from the contract
   file**, not hand-written, so the stub cannot drift.
4. Classify the change. Additive is safe; anything else gets a version, a
   deprecation window and a note in the pull request.
5. Tag both tests with the requirement id, so the traceability matrix links the
   boundary to the requirement that asked for it.
6. Run both suites. A contract change that only passes on one side is not done.

## Output

```yaml
# specs/007-export-csv/contracts/export-api.yaml
POST /v1/reports/{id}/export:
  request:
    format: enum[csv]
    filter: object, required
  responses:
    202: { exportId: string, statusUrl: string }
    400: { error: { code: "invalid_filter", message: string, field: string } }
    403: { error: { code: "export_forbidden", message: string } }
    429: { error: { code: "rate_limited", message: string }, headers: [Retry-After] }
```

```
it("FR-005 returns export_forbidden when the caller lacks the permission", ...)
```

## Validation

- [ ] The contract is a file in the spec directory, in git.
- [ ] Every status code the consumer branches on is in the contract.
- [ ] The provider test asserts the real handler against the contract.
- [ ] The consumer stub is built from the contract file, not written by hand.
- [ ] Breaking changes carry a version and a deprecation window.
- [ ] Both tests name the requirement id.
- [ ] Neither test requires the other service to be running.
