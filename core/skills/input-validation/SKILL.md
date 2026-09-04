---
name: input-validation
description: Validate untrusted input at system boundaries with a schema and prevent injection into SQL, shells, paths and templates. Use when writing handlers, parsers or anything reading external data.
version: 1.0.0
sfa: "scope: one system boundary | format: schema validation plus injection-safe call sites | audience: engineers writing boundary code"
globs: []
stacks: []
alwaysApply: false
---

# input-validation

## Rules

The injection rules and the boundary principle live in
`security.instructions.md`, which is already loaded. This skill is the procedure
for designing validation at one boundary.

What the instruction does not cover:

- Write the schema before the handler. A handler written first validates the
  fields it happens to use, not the contract.
- Derive the internal type from the schema so there is one definition. Two
  declarations of the same shape drift, invisibly, until runtime.
- Validate range, length and format, not only type. A string is not a
  constraint.
- The rejection message names the field and never echoes the value back into a
  log or a response.

Anti-patterns to refuse:

- validating in the UI only
- a blocklist of dangerous characters instead of an allowlist of valid shapes
- trusting an internal service because it is internal

## Workflow

1. Name the boundary and everything that arrives through it.
2. Define the schema: types, required fields, ranges, lengths, formats, and what
   is explicitly not allowed.
3. Validate at the entry point and derive the internal type from the schema so
   there is one definition.
4. Return a specific error naming the field, without echoing the raw value back
   into logs or messages.
5. Check each downstream call site for the injection shapes above.
6. Test the rejection paths: missing, wrong type, out of range, too long, and
   one hostile payload per injection class.

## Output

```
const CreateUser = z.object({
  email: z.string().email().max(254),
  age: z.number().int().min(13).max(120),
  role: z.enum(["viewer", "editor"]),
});

const parsed = CreateUser.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({ error: "invalid_request", fields: parsed.error.flatten().fieldErrors });
}
```

## Validation

- [ ] Every boundary input is validated before use.
- [ ] Validation is schema-based and the internal type derives from it.
- [ ] Invalid input is rejected, never coerced.
- [ ] Every SQL, shell, path and template call site is injection-safe by shape.
- [ ] Errors name the field without echoing the raw value.
- [ ] Rejection paths and one hostile payload per class are tested.
