---
name: commit-and-pr
description: Write conventional commits and pull request descriptions that explain why a change exists and how it was verified. Use before committing or opening a pull request.
version: 1.0.0
sfa: "scope: one commit or branch | format: conventional commit and PR body | audience: reviewers and future readers of the history"
globs: []
stacks: []
alwaysApply: false
---

# commit-and-pr

## Rules

The commit format and the forbidden operations live in
`git-workflow.instructions.md`, already loaded. This skill is the procedure for
writing the message and the pull request body.

What the instruction does not cover:

- The body answers why this change was necessary, and what constraint made the
  obvious approach wrong. The diff already shows what moved.
- A pull request describes the whole branch. Read the diff against the base
  before writing it, not the last commit.
- Verification states what actually ran, including failures and anything not
  run. A claimed pass that did not happen is a false report.
- Say what was deliberately left out. A reviewer cannot distinguish an omission
  from an oversight unless you tell them.

Anti-patterns to refuse:

- a body that lists the files touched
- bundling an unrelated cleanup into a feature branch without mentioning it

## Workflow

1. Read the full diff against the base branch.
2. Group changes into logical commits, one concern each.
3. Write each subject as type: imperative summary.
4. Write each body as the reason the change was necessary, and any constraint
   that explains why the obvious approach was not taken.
5. For the pull request, run the build and tests and record the actual output.
6. List what is out of scope and what follow-up is expected.

## Output

```
fix: release the pool connection when a charge fails

The error branch in charge() returned before the finally block existed, so a
failed payment leaked a connection. Under load the pool exhausted after about
twenty failures and every later request timed out.
```

The pull request body is written in Brazilian Portuguese, for the people who
review it, and summarises; commit messages keep the conventional format.

```
## O que mudou
Libera a conexão no caminho de falha do pagamento.

## Por quê
Um vazamento no ramo de erro esgotava o pool sob carga, causando timeouts sem
relação com a falha original.

## Verificado
- npm test: 214 passando, 0 falhando
- Vazamento reproduzido pelo teste de regressão novo, falhando antes da
  correção e passando depois

## Fora do escopo
A política de retry em volta de charge() não mudou; merece revisão própria.
```

## Validation

- [ ] Subject is imperative, typed and under about seventy characters.
- [ ] Body explains why, not what.
- [ ] One logical change per commit.
- [ ] The PR describes the whole branch.
- [ ] Verification reports commands that actually ran, failures included.
- [ ] Deliberate omissions are stated.
