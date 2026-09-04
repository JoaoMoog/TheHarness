---
name: terraform-module
description: Write reusable Terraform modules with typed variables and no hidden global state, and review plans for destructive changes before applying. Use when authoring modules or reviewing a plan.
version: 1.0.0
sfa: "scope: one module or one plan | format: module files plus a plan review verdict | audience: platform engineers"
globs: ["**/*.tf", "**/*.tfvars"]
stacks: [terraform]
alwaysApply: false
---

# terraform-module

## Rules

The state, versioning and plan-reading rules live in
`stack-terraform.instructions.md`, which loads on any .tf file. This skill is the
procedure for authoring a module and reviewing a plan.

What the instruction does not cover:

- A module takes variables and returns outputs. It does not read global state,
  configure its own provider, or choose the caller's backend.
- Iterate with for_each keyed by a stable identifier. Positional iteration
  reindexes on removal and recreates everything after the removed item.
- Every variable is typed and described; credentials are marked sensitive so
  they stop appearing in plan output.
- Classify every destroy and every replace line in the plan before applying.
  Forced replacement of a stateful resource is the most common way
  infrastructure is lost.

Anti-patterns to refuse:

- a provider block inside a reusable module
- a default value supplied for a required credential

## Workflow

1. Define the interface: variables in, outputs out, nothing implicit.
2. Type and describe every variable, and mark the sensitive ones.
3. Use for_each keyed by a stable identifier rather than count.
4. Pin versions and set the required Terraform version.
5. Run format, validate and the policy scanner.
6. Run plan and read it line by line. Classify every destroy and every replace.
7. Apply only after each destructive line is either explained or removed.

## Output

```
variable "name" {
  type        = string
  description = "Resource name prefix, lowercase and hyphenated"
}

variable "api_token" {
  type        = string
  description = "Token used by the service to call the upstream API"
  sensitive   = true
}

variable "regions" {
  type        = set(string)
  description = "Regions to deploy into, keyed by name so removal is stable"
}

output "endpoints" {
  description = "Service endpoint per region"
  value       = { for key, svc in example_service.this : key => svc.endpoint }
}
```

Plan review verdict:

```
2 to add, 1 to change, 0 to destroy
No replacement on any stateful resource. Safe to apply.
```

## Validation

- [ ] The module declares no provider and reads no global state.
- [ ] Every variable is typed and described; credentials are marked sensitive.
- [ ] Provider, module and Terraform versions are pinned.
- [ ] Iteration is keyed by a stable identifier, not by position.
- [ ] The plan was read and every destroy or replace was classified.
- [ ] Irreplaceable resources carry prevent_destroy.
