---
name: secret-handling
description: Decide what counts as a credential, keep it out of source and logs, and respond correctly when one is found in history. Use when touching configuration, auth or anything read from the environment.
version: 1.0.0
sfa: "scope: credentials in one repository | format: a remediation plan with rotation steps | audience: engineers and whoever owns the secret"
globs: ["**/.env*", "**/*config*", "**/*settings*"]
stacks: []
alwaysApply: false
---

# secret-handling

## Rules

A credential is anything that grants access: API keys, tokens, passwords,
connection strings, private keys, webhook signing secrets, and session signing
keys. Encoding is not protection - a base64 string is a plaintext secret.

Secrets are read from the environment or a secret manager at runtime. They are
validated at startup so a missing one fails immediately and loudly.

Committed history is permanent. Deleting the line does not make the value safe,
because the value is still retrievable. The only correct response is rotation.

Never log a secret, never put one in a URL or a query string, and never include
one in an error returned to a caller.

Anti-patterns to refuse:

- a default value in code so that it works without configuration
- a real credential in a test fixture, a seed script or a sample file
- an env file committed because it was convenient
- rotating the file but not the value

## Workflow

1. Identify what the value grants access to and who owns it.
2. Move it to the environment or a secret manager. Add a placeholder to the
   example file so setup stays documented.
3. Add a startup check that the value is present and refuses to boot without it.
4. Search history for the value, not just the current tree.
5. If it was ever committed: stop, report it, and request rotation before
   anything else. Say plainly that the value is compromised.
6. Confirm the guardrail sees it - stage the change and let the pre-commit
   scan run. It warns and records in `.harness/secrets.log` rather than
   refusing, so read the warning: a quiet run is the confirmation, a warning
   means the value is still in the change. A warning about a value that is
   genuinely not a credential is marked, never argued around: `harness secrets
   --allow=<id> --why="<reason>"` with the id the warning printed, or
   `--allow-path=<glob>` for a fixture directory. Marked means quiet, not safe.

## Output

```
Finding: SMTP password committed in src/config/mail.ts:14
First seen: commit 4f2a1c9, present in 41 commits
Grants: outbound mail as the production sender identity
Owner: platform team

Required, in order:
1. Rotate the credential at the provider. The committed value is compromised.
2. Read it from MAIL_PASSWORD, validated at startup.
3. Add MAIL_PASSWORD to .env.example with a placeholder.
4. Removing the line does not remediate. Rotation does.
```

## Validation

- [ ] No credential remains in a tracked file.
- [ ] Every required secret is validated at startup.
- [ ] The example file documents the variable with a placeholder.
- [ ] History was searched, not only the working tree.
- [ ] Anything ever committed is reported as requiring rotation.
- [ ] No secret appears in a log, a URL or an error message.
