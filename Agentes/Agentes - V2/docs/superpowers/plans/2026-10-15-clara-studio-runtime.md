# CLARA Studio Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute inline with a fresh final review.

**Goal:** Entregar o Studio operante sem integrações externas, com contratos, Docker e Kubernetes.
**Architecture:** Reusar auth/workspaces e o banco existente em modo explícito de memória. Novos serviços versionados operam documentos tipados; interface aprovada consome esses serviços. Provedores reais ficam desligados por padrão.
**Tech Stack:** Next.js/React, Zod, SQLite in-memory/Node24, Recharts, Docker, Kubernetes.
**Spec:** `docs/superpowers/specs/2026-10-15-clara-studio-runtime.md`

## Global Constraints
- Não apagar/migrar dados atuais nem configurar credenciais.
- Uma réplica e armazenamento volátil no modo de avaliação.
- Preservar o protótipo estático e a aplicação clássica.
- Mutações autorizadas no servidor; cálculos independentes de IA.

## Review Focus
- Leitor/editor tentando alterar campos por API direta.
- Edições simultâneas e repetição após falha de rede.
- Comentários/histórico/conversas vazando entre dashboards/espaços.
- SAP/IA indisponível não exibindo sucesso fictício.
- Reinício/redeploy e múltiplas réplicas em modo temporário.

## Task 1: Domínio e serviços
Files: `app/src/studio/contracts.ts`, `domain.ts`, `providers.ts`; `app/src/server/studio/*`; `app/tests/studio.test.ts`; `app/src/server/store.ts`.
Consumes: Actor, resolveWorkspace, transaction, read/insert/update.
Produces: schemas versionados, query/command/assistant, repositório e providers; armazenamento em memória opt-in.
- [x] Escrever e executar testes de contratos, cálculos, revisão, autorização, isolamento e idempotência antes da implementação.
- [x] Implementar os serviços e executar `node --import tsx --test tests/studio.test.ts`.

## Task 2: API e documentação executável
Files: `app/src/app/api/v1/studio/[...path]/route.ts`, `app/src/studio/openapi.ts`, `app/tests/studio-api.test.ts`, `app/contracts/*`.
Consumes: Task1 services.
Produces: API e OpenAPI sincronizados, runtime configuration público sem segredos.
- [x] Testar 401/403/409/422, Origin, sessão demo isolada e referências OpenAPI.
- [x] Implementar dispatcher e exportador; executar testes de API.

## Task 3: Nova interface ligada aos serviços
Files: `app/src/studio/ui/*`, `app/src/app/page.tsx`, `app/src/app/classic/page.tsx`, `app/tests/e2e/studio.spec.ts`.
Consumes: API v1 e endpoints auth/workspaces.
Produces: todas as áreas do protótipo com dados e ações do servidor; estados de erro/pendência e aviso temporário.
- [x] Criar teste de navegador para salvar/reabrir, filtros, propostas, planejamento, cenários, medidas e papéis.
- [x] Integrar sem alterar a direção visual; executar testes e TypeScript.

## Task 4: Containers e entrega
Files: Dockerfile, compose.yaml, .dockerignore, deploy/kubernetes/*, app/scripts/studio.mjs, app/next.config.ts, docs/CLARA-STUDIO.md.
Consumes: build standalone; endpoints health.
Produces: execução local sem configuração e manifests de avaliação; pendências empresariais explícitas.
- [x] Testar contratos de configuração e manifests.
- [x] Build/testes completos, Docker quando engine disponível, Kubernetes render/dry-run sem aplicar em cluster.
- [x] Revisão independente final, corrigir problemas importantes e registrar evidências.
