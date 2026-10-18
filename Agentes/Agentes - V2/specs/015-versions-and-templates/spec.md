# Specification: Versions and templates

Status: draft
Owner: João Moog

## Problem

The prototype lets an editor name and keep a snapshot of an analysis ("Versões desta
análise") and reuse a document's structure on another source ("Meus modelos"), but
both live in the browser's localStorage: the dialog says `Salvos neste navegador.`,
the twenty-first entry silently drops the oldest one (`slice(-20)`), nothing can be
removed, nothing is visible to a colleague, and clearing site data erases every
version ever saved. Editors who rely on versions as their safety net before a big
restructuring lose them the day they change machines; a template built for the
finance team cannot be handed to the team.

The rewrite stores versions per analysis and templates per workspace on the server,
adds removal, lets every member see the workspace's templates (the prototype's
heading `Meus modelos` becomes `Modelos do workspace`; confirmation is an open
question below), replaces the toast `Salvo neste navegador.` with `Versão salva.` /
`Modelo salvo.`, and turns the silent cap into a refusal that names the limit.
Roles apply: a Leitor can look at the lists but cannot save, restore, use or remove.

## Goal

Editors keep named, server-stored versions of an analysis that any member can list
and an editor can restore or remove, and turn an analysis into a workspace template
that any editor can use to create a new analysis on a source of their choice.

## Out of scope

- Comparing two versions or showing a diff; versions are restored whole.
- Automatic versions on every save; only explicit `Salvar versão atual` creates one.
- Versioning of templates, sharing templates across workspaces, exporting or
  importing templates as files.
- Snapshotting data rows: a version holds the document and the analysis's title and
  dashboard-level filters, never the rows of the source.
- Restoring a version of a deleted analysis, or restoring across analyses.
- Hard deletion and retention of removed versions and templates (open question).

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-01501 | Ubiquitous | The studio's context bar SHALL offer the entry `Versões e modelos`, which opens a dialog titled `Versões e modelos` containing the actions `Salvar versão atual` and `Salvar como modelo`, the list `Versões desta análise` and the list `Modelos do workspace`. |
| FR-01502 | Event | WHEN `Salvar versão atual` or `Salvar como modelo` is activated, the system SHALL open a form titled `Salvar versão` or `Salvar modelo` with a required field `Nome` pre-filled with `{título da análise} · {data de hoje em pt-BR}` and a `Salvar` action. |
| FR-01503 | Event | WHEN `Salvar` is confirmed for a version, the system SHALL store, for the open analysis, a version holding the trimmed name, the saving member, the creation time and a snapshot of the document as currently shown in the studio (including edits not yet autosaved) together with the analysis title and its dashboard-level period, area and categories, then show `Versão salva.`. |
| FR-01504 | Ubiquitous | `Versões desta análise` SHALL list the analysis's versions newest first, each showing its name, its creation date and time formatted in pt-BR, the count `{N} páginas`, and the actions `Restaurar` and `Remover`, or `Nenhuma versão salva.` when there is none. |
| FR-01505 | Event | WHEN `Restaurar` is activated on a version, the system SHALL ask `Restaurar versão?` with the text `{nome} · {N} páginas. A configuração atual poderá ser recuperada com Desfazer.` and the actions `Cancelar` and `Restaurar versão`. |
| FR-01506 | Event | WHEN `Restaurar versão` is confirmed, the system SHALL replace the open analysis's document, title, period, area and categories with the snapshot's content, clear the widget selection and any cross-filter, close the dialog and show `Versão restaurada.`. |
| FR-01507 | Event | WHEN a version has been restored, a single undo SHALL bring back the document, title and dashboard-level filters exactly as they were before the restore. |
| FR-01508 | Ubiquitous | A restore SHALL be persisted through the same validated document write as any other edit, so that the stored analysis's revision increases by exactly one and a stale-revision conflict is reported the same way as for an edit. |
| FR-01509 | Unwanted | IF a version's snapshot no longer passes the document validation defined in 002-domain-schema, THEN the system SHALL refuse the restore with a message naming the failing field and leave the open analysis unchanged. |
| FR-01510 | Event | WHEN `Remover` is confirmed for a version, the system SHALL remove that version so that it disappears from `Versões desta análise` and can no longer be restored. |
| FR-01511 | Event | WHEN `Salvar` is confirmed for a template, the system SHALL store, in the current workspace, a template holding the trimmed name, the saving member, the creation time and a copy of the document (pages, widgets, measures and parameters) without rows, title or dashboard-level filters, then show `Modelo salvo.`. |
| FR-01512 | Ubiquitous | `Modelos do workspace` SHALL list the workspace's templates newest first, each showing its name, the count `{N} páginas` and the actions `Usar modelo` and `Remover`, or `Nenhum modelo salvo.` when there is none. |
| FR-01513 | Event | WHEN `Usar modelo` is activated, the system SHALL open the form `Criar análise a partir de modelo` with a required `Nome` pre-filled with the template's name, a `Fonte` selector listing `SAP · demonstração` and every source of the current workspace, the note `A estrutura e as medidas serão copiadas. Os filtros serão redefinidos para a fonte escolhida.` and the action `Criar análise`. |
| FR-01514 | Event | WHEN `Criar análise` is confirmed, the system SHALL create, in the current workspace, a new analysis bound to the chosen source whose document is a copy of the template with every page filter and widget filter emptied, whose area is `Todas as áreas`, whose period is the most recent month present in the chosen source's rows, and whose revision is 1. |
| FR-01515 | Event | WHEN the analysis of FR-01514 has been created, the system SHALL open it in the studio with its first page active and show `Análise criada a partir do modelo.`. |
| FR-01516 | Ubiquitous | The library page SHALL offer the entry `Novo a partir de modelo`, which lists the workspace's templates and leads to the same `Criar análise a partir de modelo` form as FR-01513. |
| FR-01517 | Unwanted | IF the `Nome` of a version or template is empty after trimming, THEN the system SHALL refuse to save and name the field `Nome`. |
| FR-01518 | Unwanted | IF the `Nome` of a version or template exceeds 80 characters, THEN the system SHALL refuse to save with a message naming the limit of 80 characters. |
| FR-01519 | Unwanted | IF the analysis already holds 20 versions, THEN the system SHALL refuse to save another one with the message `Limite de 20 versões por análise. Remova uma versão para salvar outra.` and keep every existing version. |
| FR-01520 | Unwanted | IF the workspace already holds 20 templates, THEN the system SHALL refuse to save another one with the message `Limite de 20 modelos por workspace. Remova um modelo para salvar outro.` and keep every existing template. |
| FR-01521 | State | WHILE the acting member is a Leitor, the actions `Salvar versão atual`, `Salvar como modelo`, `Restaurar`, `Usar modelo`, `Remover` and `Novo a partir de modelo` SHALL be absent from the interface while the two lists remain readable. |
| FR-01522 | Unwanted | IF a Leitor requests to save, restore, use or remove a version or template through any interface, THEN the system SHALL refuse with a forbidden response carrying a pt-BR message and change nothing. |
| FR-01523 | Unwanted | IF the analysis, version or template addressed belongs to a workspace the acting user is not a member of, or has been deleted, THEN the system SHALL respond as not found without revealing whether it exists. |
| FR-01524 | Unwanted | IF the version or template chosen no longer exists because another member removed it, THEN the system SHALL show `Este item não existe mais.` and refresh the lists. |
| FR-01525 | Unwanted | IF the source chosen in `Criar análise a partir de modelo` has no rows, THEN the system SHALL refuse with `Importe uma fonte com dados válidos primeiro.` and create nothing. |
| NFR-01501 | Ubiquitous | Saving a version of a document at the limits (100 widgets, 20 pages) SHALL complete within 500 ms at p95 on a local database. |
| NFR-01502 | Ubiquitous | Listing versions or templates SHALL return metadata only, at most 1 KB per entry, within 200 ms at p95 for 20 entries; snapshots are fetched only when restoring or using. |
| NFR-01503 | Ubiquitous | A confirmed restore of a document at the limits SHALL be visible on the canvas within 1 s. |
| NFR-01504 | Ubiquitous | An automated accessibility scan of the `Versões e modelos`, `Salvar versão`, `Restaurar versão?` and `Criar análise a partir de modelo` dialogs SHALL report zero violations of impact `serious` or `critical`, with every action reachable by keyboard. |

## Open questions

`[NEEDS CLARIFICATION: version and template name limit — 80 comes from the prototype's input attribute only; a different limit changes FR-01518 and the stored column width.]`

`[NEEDS CLARIFICATION: caps of 20 versions per analysis and 20 templates per workspace came from browser storage limits; keeping them as refusals (FR-01519, FR-01520), raising them or dropping them changes the two refusals and the list design.]`

`[NEEDS CLARIFICATION: should a restore first save an automatic version of the current state (e.g. `Antes de restaurar`)? It changes FR-01506, consumes a slot of the cap and makes undo redundant.]`

`[NEEDS CLARIFICATION: template source binding — the prototype stores no source in a template and always asks at creation; if a template must remember a default source, FR-01511 and FR-01513 change.]`

`[NEEDS CLARIFICATION: retention — are removed versions and templates hard-deleted or soft-deleted with a retention period? It decides whether FR-01510 is reversible by an administrator.]`

`[NEEDS CLARIFICATION: templates visible to every member (`Modelos do workspace`, assumed) or only to their author (the prototype's `Meus modelos`)? It changes FR-01512 and who may remove a template.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/015-versions-and-templates
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
