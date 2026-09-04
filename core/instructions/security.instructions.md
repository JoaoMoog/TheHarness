---
applyTo: "**"
description: Security rules that apply to every file. Present in only 14.5% of real-world config sets; that gap is the reason this file exists.
---

# Security

## Secrets

Never write a credential into a tracked file. Read it from an environment
variable or a secret manager, and validate at startup that it is present rather
than failing halfway through a request.

If you find a secret already committed, stop. Report it, and say it must be
rotated — removing the line does not make the value safe, because it is still in
history.

## Input at boundaries

Everything crossing a boundary is untrusted: HTTP requests, CLI arguments,
environment variables, file contents, message queues, and responses from other
services. Validate shape and range before use, at the boundary, once.

Prefer schema validation over hand-rolled checks. Reject with a specific error;
do not coerce silently.

## Injection

- SQL: parameterised queries only. String interpolation into SQL is a defect
  even when the input "cannot" contain quotes.
- Shell: pass arguments as an array to the process API. Never build a command
  string from user input.
- HTML: escape on output, in the template layer. Treat any API that takes raw
  HTML as requiring a written justification at the call site.
- Paths: resolve and confirm the result stays inside the intended directory
  before reading or writing.
- Deserialization: never deserialize untrusted input into arbitrary types.

## Authentication and authorization

Authorization is checked on the server, per request, against the acting
identity — not inferred from a client-supplied id, and not enforced only by
hiding the UI. Check ownership of the specific object, not just the role.

Prefer short-lived tokens with a narrow scope. Do not log tokens, session ids,
passwords, or full payment details.

## Dependencies and crypto

Use the platform's crypto library. Do not implement a primitive, do not invent a
scheme, do not use MD5 or SHA-1 for anything security-bearing, and use a
password hash designed for the job (argon2, scrypt, bcrypt) rather than a fast
digest.

Before adding a dependency, check that it is maintained and that its permissions
match its purpose. Pin versions in lock files and commit them.

## Errors and logging

An error returned to a caller says what is wrong for them to act on. It does not
include stack traces, SQL, internal hostnames, or file paths. Log the detail
server-side, with the fields needed to diagnose and without the values that
would leak.

## Escalate

Stop and ask a human before changing authentication, authorization, cryptography
or payment code, and before any change that would widen access.
