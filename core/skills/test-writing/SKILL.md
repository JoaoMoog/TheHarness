---
name: test-writing
description: Write tests that state behaviour and survive refactoring, using arrange-act-assert and behaviour-named cases. Use when adding or changing tests for any language.
version: 1.0.0
sfa: "scope: one behaviour per test | format: arrange-act-assert test cases | audience: engineers maintaining the suite"
globs: ["**/*.test.*", "**/*.spec.*", "**/test_*.py", "**/*_test.go", "**/*Test.java", "**/*Tests.cs"]
stacks: []
alwaysApply: false
---

# test-writing

## Rules

The general rules live in `testing.instructions.md`, which is already loaded.
This skill is the procedure for turning a behaviour into a test.

What the instruction does not cover:

- The test name is the behaviour sentence, written before the test body. If you
  cannot write the name, you do not yet know what you are testing.
- Table-driven cases belong together only when they exercise the same behaviour
  with different data. Different behaviours in one table hide which one broke.
- A test that needs more than three lines of arrangement is telling you the unit
  under test has too many collaborators. Note it; do not fix it here.

Anti-patterns to refuse:

- a test written after the implementation that simply agrees with it
- assertions on the whole object when one field is the subject
- shared mutable fixtures that make tests order-dependent

## Workflow

1. State the behaviour in one sentence. That sentence becomes the test name.
2. Write the failing test first and run it. Confirm it fails for the reason you
   expect, not for a typo.
3. Arrange the minimum state. Act once. Assert on the observable outcome.
4. Add the boundary cases that carry risk: empty, one, many, maximum, and the
   error path.
5. Run the whole suite, not just the new test, and report the real result.

## Output

```
describe("listRecords", () => {
  it("returns an empty array when no records match", async () => {
    // Arrange
    const repo = await seed([]);

    // Act
    const result = await listRecords(repo, { query: "absent" });

    // Assert
    expect(result).toEqual([]);
  });
});
```

## Validation

- [ ] The test failed before the implementation existed.
- [ ] The name states behaviour and reads without the file open.
- [ ] Arrange, act and assert are visually separated.
- [ ] Assertions target observable behaviour only.
- [ ] Error and boundary paths are covered, not just the happy path.
- [ ] The full suite result is reported, including failures.
