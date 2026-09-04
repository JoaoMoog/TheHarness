---
name: api-design
description: Design HTTP and library interfaces with explicit contracts, consistent errors and a versioning story before the first consumer arrives. Use when adding or changing a public interface.
version: 1.0.0
sfa: "scope: one interface surface | format: a contract with resources, errors and versioning | audience: the teams that will consume it"
globs: []
stacks: []
alwaysApply: false
---

# api-design

## Rules

Design the contract before the implementation. An interface that leaks the
current database schema will need a breaking change the moment the schema moves.

Be consistent within the surface: one naming convention, one pagination shape,
one error shape, one date format. Consistency is worth more than any individual
choice being optimal.

Errors are part of the contract. Define a stable machine-readable code, a human
message, and the field it relates to. Callers branch on the code, never on the
message text.

Everything that returns a collection is paginated from day one. Adding
pagination later is a breaking change disguised as a fix.

Additive changes are safe: new optional fields, new endpoints. Removing a field,
renaming one, tightening validation, or changing a default are all breaking, and
need a version and a deprecation window.

Anti-patterns to refuse:

- returning 200 with an error in the body
- a verb in every path when the method already carries it
- exposing internal identifiers, stack traces or SQL in a response
- an unbounded list endpoint

## Workflow

1. Name the consumers and what each actually needs. Design for those, not for
   every hypothetical caller.
2. Define resources and operations, and the method and status code for each.
3. Define the request and response schemas, including which fields are optional
   and what the defaults are.
4. Define the error catalogue: code, status, message, and when it occurs.
5. Decide pagination, filtering and sorting shape once, and apply it everywhere.
6. Write the versioning and deprecation rule before the first release.
7. Validate every input at the boundary against the published schema.

## Output

```
GET /v1/orders?limit=50&cursor=abc

200 {
  "data": [ { "id": "ord_1", "status": "paid", "createdAt": "2026-09-02T10:00:00Z" } ],
  "nextCursor": "def"
}

400 { "error": { "code": "invalid_limit", "message": "limit must be 1-100", "field": "limit" } }
404 { "error": { "code": "order_not_found", "message": "No order with that id" } }

Breaking changes ship under /v2. Fields are deprecated for two releases before
removal, announced in the changelog and flagged in the response headers.
```

## Validation

- [ ] Every operation has a defined request schema, response schema and status.
- [ ] Errors use stable codes callers can branch on.
- [ ] Collections are paginated and bounded.
- [ ] Naming, dates and pagination are consistent across the surface.
- [ ] No internal identifier, trace or query text is exposed.
- [ ] The versioning and deprecation rule is written down.
