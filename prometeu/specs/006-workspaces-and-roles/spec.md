# Specification: Workspaces and roles

Status: draft
Owner: João Moog

## Problem

The prototype shows one "Workspace Financeiro" that belongs to whoever opens the
browser, and its governance page prints a descriptive table of roles ("Proposta de
governança … não implementada") that nothing enforces. Once analyses and sources are
stored on a server and several people sign in (005-authentication), content must
belong to a workspace, each member must hold a role the server checks on every
request, and the page that tells people what a role may do must be generated from the
same rule the server enforces, so it cannot drift. This spec replaces the prototype's
hand-typed roles table with one rendered from the enforcement matrix and drops the
"Aprovar orçamento — Papel específico" row, which named no role the application has.

## Goal

Every person acts inside a current workspace where they hold exactly one of the roles
Leitor, Editor or Administrador; the server decides every read and write from that
membership, never from the client; administrators manage members; and `/governanca`
shows the members and a roles table produced from the enforced rules.

## Out of scope

- Invitations to people who have not signed in yet, and any e-mail sending.
- Groups, SSO group mapping and row-level ("por centro de custo") restrictions.
- Deleting or archiving a workspace.
- Per-analysis sharing permissions (017-presentation-and-export) and the lineage
  panel "Rastro da análise atual" (013-filters-and-interactions, 016-home-and-planning).
- The content that lives inside a workspace: sources and analyses arrive in
  007-analyses-and-sources-persistence, which reuses the workspace creation defined here.
- The "Aprovar orçamento" capability of the prototype's table: no such role exists.

## Requirements

| id | pattern | requirement |
|---|---|---|
| FR-00601 | Ubiquitous | Every workspace SHALL have a name of 1 to 80 characters after trimming and at least one member holding the role Administrador. |
| FR-00602 | Ubiquitous | Every membership SHALL bind one person to one workspace with exactly one of the roles Leitor, Editor or Administrador, shown in the interface with those labels. |
| FR-00603 | Event | WHEN a signed-in person creates a workspace with a valid name, the application SHALL create it with that person as its only member with the role Administrador and make it the person's current workspace. |
| FR-00604 | Unwanted | IF the workspace name is empty or longer than 80 characters after trimming, THEN the application SHALL refuse the creation with HTTP 400 naming the `name` field and the message `Informe um nome de 1 a 80 caracteres.`. |
| FR-00605 | Ubiquitous | A member with the role Leitor SHALL be allowed to view the workspace's analyses and sources, present an analysis and export it, and nothing else. |
| FR-00606 | Ubiquitous | A member with the role Editor SHALL be allowed everything a Leitor is, plus creating, editing, renaming, duplicating and deleting analyses, importing files and deleting sources, and managing named versions, templates and scenarios. |
| FR-00607 | Ubiquitous | A member with the role Administrador SHALL be allowed everything an Editor is, plus listing, adding, changing the role of and removing members, and renaming the workspace. |
| FR-00608 | Ubiquitous | The application SHALL decide every permission from the acting person's membership in the workspace that owns the requested object, read on that request, and SHALL ignore any role or workspace claim sent by the client. |
| FR-00609 | Unwanted | IF a person requests an object in a workspace they are not a member of, THEN the application SHALL answer exactly as for an object that does not exist: HTTP 404, code `not_found`, message `Não encontrado.`. |
| FR-00610 | Unwanted | IF a member requests an action their role does not allow, THEN the application SHALL answer HTTP 403 with code `forbidden` and the message `Você não tem permissão para esta ação.` and perform no change. |
| FR-00611 | Event | WHEN an Administrador adds a member by the e-mail of a person who has already signed in, with a role, the application SHALL create the membership and list the person with that role. |
| FR-00612 | Unwanted | IF the e-mail belongs to no person who has signed in, THEN the application SHALL refuse with HTTP 404 naming the `email` field and the message `Nenhuma pessoa com este e-mail entrou no Prometeu.`. |
| FR-00613 | Unwanted | IF the person is already a member of the workspace, THEN the application SHALL refuse with HTTP 409, code `already_member`, message `Esta pessoa já faz parte do workspace.`. |
| FR-00614 | Event | WHEN an Administrador changes a member's role, the application SHALL apply the new role to that member's next request. |
| FR-00615 | Unwanted | IF removing or demoting a member would leave the workspace with zero members holding Administrador, THEN the application SHALL refuse with HTTP 409, code `last_admin`, message `O workspace precisa de pelo menos um administrador.`. |
| FR-00616 | Event | WHEN an Administrador removes a member, the application SHALL delete the membership so that the removed person's next request for that workspace's objects is answered with HTTP 404. |
| FR-00617 | Ubiquitous | The header SHALL show a `Workspace ⌄` button labelled with the current workspace's name that opens a list of every workspace the person belongs to, each with its role label, plus the action `Criar workspace`. |
| FR-00618 | Event | WHEN the person picks a workspace from the list, the application SHALL store it as the person's current workspace on the server and reload the page showing that workspace's content, so that a new session on another device opens the same workspace. |
| FR-00619 | Unwanted | IF the stored current workspace is one the person no longer belongs to, THEN the application SHALL fall back to the workspace the person joined most recently, or to the no-workspace state, without an error. |
| FR-00620 | State | WHILE the signed-in person belongs to no workspace, every shell route SHALL show the message `Você ainda não participa de um workspace.` with the `Criar workspace` action, in place of the page content. |
| FR-00621 | Ubiquitous | The explorer sidebar title SHALL show the current workspace's name. |
| FR-00622 | Ubiquitous | `/governanca` SHALL render a table with the columns `Permissão`, `Leitor`, `Editor` and `Administrador`, one row per enforced capability with the cells `Sim` or `Não`, derived from the same rules the server enforces, including the rows `Ver análises autorizadas`, `Apresentar e exportar`, `Criar e editar dashboards`, `Importar arquivos e gerenciar fontes`, `Gerenciar versões, modelos e cenários` and `Gerenciar membros e workspace`. |
| FR-00623 | Ubiquitous | `/governanca` SHALL list every member of the current workspace with display name, e-mail and role label, ordered by display name. |
| FR-00624 | State | WHILE the acting person is an Administrador, `/governanca` SHALL also show a role selector and a `Remover` action per member and an `Adicionar pessoa` form with e-mail and role; for any other role these controls SHALL be absent from the accessibility tree. |
| FR-00625 | Event | WHEN a person lists their workspaces, the application SHALL return at most 100 per page ordered by name, with a cursor for the next page. |
| NFR-00601 | Ubiquitous | Every combination of the three roles and every enforced capability SHALL have an explicit automated expectation (100 percent of the matrix cells), so that adding a capability without deciding its three cells fails the build. |
| NFR-00602 | Ubiquitous | Resolving the acting person's membership and deciding a permission SHALL add under 10 ms at p95 per request on the local database. |
| NFR-00603 | Ubiquitous | The HTTP 404 answered to a non-member SHALL be byte-identical in body and headers (except date and request id) to the one answered for a random non-existent id. |
| NFR-00604 | Ubiquitous | `/governanca` with 200 members SHALL render within 500 ms at p95 on the local server. |
| NFR-00605 | Ubiquitous | An automated accessibility scan of `/governanca` in the Administrador and Leitor views SHALL report zero violations of impact `serious` or `critical`. |

## Open questions

`[NEEDS CLARIFICATION: is a personal workspace created automatically on first sign-in (named after the person), or does a new person land in the no-workspace state until someone adds them? It decides whether the sign-in flow creates a workspace and whether the empty state is common or rare.]`

`[NEEDS CLARIFICATION: who may create workspaces — any signed-in person, or only designated people? If restricted, a global flag on the person is needed and the `Criar workspace` action becomes conditional.]`

`[NEEDS CLARIFICATION: adding a member who has never signed in — refuse (as specified) or store a pending invitation resolved at first sign-in? An invitation record and its screen change the member model.]`

`[NEEDS CLARIFICATION: is the permission split right? The prototype's descriptive table gave "Compartilhar com grupos permitidos" and "Gerenciar conexões e modelos" to different roles than the matrix above (readers may present and export; editors manage templates). A different split changes the matrix rows and every 403 test.]`

## Traceability

Every requirement above becomes at least one test that names its id. Run:

```
node .github/tools/spec/traceability.mjs --spec=specs/006-workspaces-and-roles
```

It fails while any requirement has no test, any test claims an id this spec does
not define, or any question above is still open.
