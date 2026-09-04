---
name: acceptance-tests
description: Turn each EARS acceptance criterion into a failing test before writing implementation, so the spec and the suite cannot drift apart. Use in the implement phase, at the start of every task.
version: 1.0.0
sfa: "scope: one task and the criteria it satisfies | format: failing tests named after the criteria | audience: the implementer and the reviewer"
stacks: []
alwaysApply: false
---

# acceptance-tests

## Rules

The test name starts with the requirement id it proves: `FR-003 refuses an export
over the limit`. That is what lets the traceability matrix link the two without
anyone reading the file, and what makes a failing run say which requirement broke.

Every criterion in the spec maps to at least one test, and every test names the
criterion it covers. That mapping is what stops the suite and the spec from
drifting apart the first time either is edited.

Write the test before the implementation, and watch it fail for the reason the
criterion describes. A test that passes against unchanged code is testing
something else.

Unwanted-condition criteria get tests too, and they are usually the ones that
find real defects: empty, missing, unauthorised, too large, already exists,
downstream unavailable.

Test the criterion, not the implementation. A criterion says what the system
does; a test that asserts on a private helper will fail the first refactor
without the behaviour having changed.

Anti-patterns to refuse:

- writing the implementation first and then a test that agrees with it
- one test asserting several criteria
- adjusting a criterion because the implementation turned out differently
- marking a criterion covered when only its happy path is tested

## Workflow

1. List the criteria this task must satisfy.
2. For each, write the test name from the criterion text.
3. Write the test. Run it. Confirm it fails, and read the failure.
4. Implement the minimum that makes it pass.
5. Run the whole suite, not just the new test.
6. Record the criterion-to-test mapping in the task summary.

## Output

```
FR-002  IF the filtered result exceeds 50,000 rows, THEN the system SHALL refuse
       with a message naming the limit.

test("FR-003 refuses an export over the row limit and names the limit", async () => {
  // Arrange
  const repo = await seedRows(50_001);

  // Act
  const response = await request(app).get("/v1/export?filter=all");

  // Assert
  expect(response.status).toBe(413);
  expect(response.body.error.message).toContain("50000");
});

Mapping: FR-001 -> export.spec.ts:12 | FR-002 -> export.spec.ts:28 |
         FR-003 -> permissions.spec.ts:9 | FR-004 -> perf.spec.ts:4
```

## Validation

- [ ] Every criterion for this task has at least one test.
- [ ] Each test was observed failing before the implementation existed.
- [ ] Unwanted-condition criteria are covered, not just the happy paths.
- [ ] Tests assert on behaviour, not on internals.
- [ ] The criterion-to-test mapping is recorded.
- [ ] The full suite passes and the real result is reported.
