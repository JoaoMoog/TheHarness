---
applyTo: "**/*.tf,**/*.tfvars"
description: Terraform and infrastructure-as-code conventions. Activates only in repositories that contain Terraform.
---

# Terraform

## State

Remote backend with locking, always. Local state means two engineers can destroy
each other infrastructure without either of them seeing a conflict.

Never commit tfstate files or tfvars containing real values - state holds
secrets in plain text.

## Change safety

Plan before apply, and read the plan. Anything showing a destroy or a replace on
a stateful resource stops for a human: databases, volumes, buckets.

Pin provider and module versions. An unpinned provider turns an unrelated apply
into an upgrade.

Use prevent_destroy on resources whose loss would be unrecoverable.

## Structure

Modules take variables and return outputs; they do not read global state.
Variables have types and descriptions, and any that carries a credential is
marked sensitive.

Name resources for what they are, not for what they are called elsewhere. Keep
environments as separate workspaces or directories, not as branching logic
inside one configuration.

## Secrets

Reference a secret manager. Do not pass a credential through a variable default,
a committed tfvars file, or an environment-specific override that lives in the
repository.

## Policy

Run fmt, validate, and a policy scanner in CI. Infrastructure defects are found
by static analysis far more cheaply than by an incident.
