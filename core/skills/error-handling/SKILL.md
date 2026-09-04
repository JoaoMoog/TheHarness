---
name: error-handling
description: Design failure paths that propagate with context and never fail silently, with distinct messages for users and for logs. Use when writing or reviewing any code that can fail.
version: 1.0.0
sfa: "scope: failure paths in one module | format: handled or propagated errors with context | audience: engineers and on-call responders"
globs: []
stacks: []
alwaysApply: false
---

# error-handling

## Rules

The general rules live in `code-style.instructions.md` and
`security.instructions.md`, both already loaded. This skill is the procedure for
designing the failure paths of one unit.

What those do not cover:

- Enumerate what can fail before writing any handler. A handler written
  reactively covers the failure you happened to think of.
- For every failure, decide handle or propagate and write the decision down. An
  undecided failure becomes a swallowed one.
- A fallback is correct only if the caller can still tell success from
  degradation. If it cannot, the fallback is a silent failure with extra steps.
- Retries need a limit, a backoff, and an operation that is safe to repeat. Two
  of three is not enough.

Anti-patterns to refuse:

- returning null, an empty array or a default to represent a failure
- an error message that says something went wrong

## Workflow

1. List what can fail in this unit: I/O, parsing, validation, dependencies.
2. For each, decide handle or propagate, and write down which.
3. Where you handle, define the fallback and say why it is correct - not merely
   convenient.
4. Where you propagate, wrap with the operation context and keep the cause.
5. Write the user message and the log fields separately.
6. Add a test for each failure path you claimed to handle.

## Output

```
try {
  return await loadProfile(userId);
} catch (err) {
  logger.error("profile load failed", { userId, source: "profile-service" });
  throw new Error(`loading profile for user ${userId}`, { cause: err });
}
```

## Validation

- [ ] No empty catch blocks and no swallow-and-continue.
- [ ] Every rethrow carries context and the original cause.
- [ ] Catches are specific to the expected failure.
- [ ] User messages are actionable; log messages carry diagnostic fields.
- [ ] No credential, token or personal data is logged.
- [ ] Every handled failure path has a test.
