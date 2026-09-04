---
name: typescript-types
description: Model domain state so invalid combinations cannot be represented, using discriminated unions, branded types and schema-derived types. Use when designing TypeScript types or removing any.
version: 1.0.0
sfa: "scope: one module type surface | format: type definitions with the invalid states removed | audience: TypeScript engineers"
globs: ["**/*.ts", "**/*.tsx"]
stacks: [node-ts, react]
alwaysApply: false
---

# typescript-types

## Rules

Make illegal states unrepresentable. A type with four optional fields describes
sixteen states, most of which your code cannot handle. A discriminated union
describes exactly the ones that exist.

Any is a defect. At a boundary use unknown and narrow it. Where a cast is truly
required, write the reason on the line above it.

Derive types from the runtime validator rather than declaring both. Two
declarations of the same shape drift, and the drift is invisible until runtime.

Prefer a union of literals over a bare string for a closed set. The compiler
then finds every switch that forgot a case.

Brand identifiers that must not be interchangeable. A UserId and an OrderId are
both strings and passing one where the other belongs compiles silently.

Anti-patterns to refuse:

- as any to silence an error
- a non-null assertion instead of a narrowing check
- an interface with every field optional
- enums used where a literal union is simpler and erases cleanly

## Workflow

1. List the states the value can actually be in.
2. If a field is only meaningful in some states, the type is a union - split it
   on a discriminant.
3. Define the boundary schema first, then infer the type from it.
4. Replace open primitives with literal unions or branded types where identity
   matters.
5. Check that every switch over the discriminant is exhaustive, with a never
   check in the default branch.

## Output

```
type Request =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "success"; data: Profile }
  | { status: "error"; error: Error };

type UserId = string & { readonly __brand: "UserId" };

function assertNever(value: never): never {
  throw new Error(`unhandled variant: ${JSON.stringify(value)}`);
}
```

## Validation

- [ ] No any outside a justified, commented cast.
- [ ] States that cannot coexist are separate union members.
- [ ] Boundary types are inferred from the validator, declared once.
- [ ] Closed sets are literal unions, not open strings.
- [ ] Switches over discriminants are exhaustive.
