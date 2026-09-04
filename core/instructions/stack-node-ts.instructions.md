---
applyTo: "**/*.ts,**/*.mts,**/*.cts,**/*.js,**/*.mjs,**/*.cjs,**/tsconfig*.json,**/package.json"
description: TypeScript and Node conventions. Activates only in repositories that contain TypeScript.
---

# TypeScript and Node

The type rules apply to TypeScript; everything from Async downward applies to
plain JavaScript too.

`any` is a defect, not a shortcut. Use `unknown` at boundaries and narrow it.
Where a cast is genuinely required, write why on the line above it.

Enable `strict`. If the repository has it off, do not silently turn it on —
raise it as a separate change.

Model impossible states out of existence: a discriminated union beats a bag of
optional fields, and a union of literals beats a loose `string`.

Validate external data at the edge with a schema (zod, valibot, ajv) and derive
the type from the schema rather than declaring it twice.

## Async

`await` inside a loop serialises work that is usually independent — use
`Promise.all` when the items do not depend on each other, and a bounded pool
when there are many. Never leave a floating promise: await it, return it, or
attach a handler.

Every `fetch` gets a timeout via `AbortSignal`. Node will happily wait forever.

## Modules and imports

ESM, named exports, no default exports for anything a consumer will refactor.
Import types with `import type` so they are erased.

## Errors

Throw `Error` (or a subclass), never a string or an object literal. Preserve the
original with `{ cause }` when rethrowing.
