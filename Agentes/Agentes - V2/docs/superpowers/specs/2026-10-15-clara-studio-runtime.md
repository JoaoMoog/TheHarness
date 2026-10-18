# CLARA Studio funcional sem configuração externa

Autorização: em 15/10/2026, executar tudo que não exige configuração; SAP, SSO, IA externa e persistência definitiva ficam pendentes. Docker e Kubernetes fazem parte da entrega. A direção visual aprovada é o protótipo SAP Studio (Taste/Impeccable).

## Resultado

Integrar a superfície em `design/clara-sap-studio` ao Next.js existente. Manter a aplicação anterior acessível em `/classic` e seus dados intactos. A nova página inicial usa serviços reais para cálculos, documentos, planejamento, cenários, medidas, comentários, acesso e auditoria. Sem credenciais, usar dados sintéticos e planejamento de IA determinístico explícito. Nenhuma conexão externa automática.

## Limites assumidos

- Escopo funcional: as telas do protótipo, com exemplo financeiro de despesas/orçamento. Não é paridade integral com SAP Analytics Cloud.
- Persistência definitiva adiada. Execução de avaliação usa SQLite em memória, uma instância/réplica. Reinício perde contas, sessões e documentos dessa execução. Não migrar nem apagar o banco atual.
- Identidade existente (local/MSAL), workspaces e RBAC reaproveitados; demonstração de entrada deve criar identidade isolada por sessão.
- Dados SAP somente leitura; cenários e planejamento pertencem à CLARA. Nenhum writeback.
- Docker local e manifests Kubernetes preparados, sem publicar imagem nem aplicar recursos em cluster desconhecido.

## Contratos

API versionada `/api/v1/studio`, JSON estrito/Zod, erros `{error:{code,message,requestId}}`. Sessão HttpOnly existente e Origin para mutações. Contexto de workspace pelo header `x-clara-workspace`, validado no servidor. Documentos com `schemaVersion:1`, revisão para concorrência e snapshots por dashboard. Comandos restritos por intenção, sem aceitar estado arbitrário do cliente. Idempotência em operações de criação.

Separar `DataProvider`, `AnalysisPlanner`, `StudioRepository` e identidade normalizada. Fornecer implementações de demonstração; adaptadores reais só são selecionados explicitamente. Contratos de dados incluem unidades, origem, revisão, período, dimensões e limites. Nunca executar código/SQL produzido pela IA. API e interface devem identificar dependências pendentes sem afirmar conexão real.

## Comportamentos

Dashboard: filtros recalculados no servidor; oito representações, salvar, abrir, duplicar, excluir, favoritos, histórico/restauração e comentários por dashboard. Editor modifica proposta local antes do salvamento. CSV e apresentação usam o mesmo recorte consultado.

Assistente: pedido, esclarecimento ou proposta estruturada, aplicação explícita e desfazer local. Criação, filtro, gráfico, realce, indicador e cenário. Não salvar automaticamente proposta nem fabricar números. Falha de provedor não volta silenciosamente ao demo.

Planejamento: versões nomeadas, alteração dos quatro centros, salvar/abrir/excluir; realizado preservado. Cenários: percentuais 0–100%, nome, versão-base e resultados calculados pelo servidor; lista e reabertura. Projeção por média claramente ilustrativa. Modelos: medidas predefinidas validadas e calculadas pelo servidor.

Governança: contas, espaços, convites por código, papéis, revogação e auditoria existentes ligados à nova interface. Leitor não modifica recursos; editor não administra. Fonte pausada afeta consulta/assistente. Sessão expirada e conflito de revisão são recuperáveis sem sobrescrever trabalho.

## Entrega e aceite

OpenAPI gerado dos schemas, documentação de adaptadores/configuração pendente, roteiro de integração. Docker multi-stage com usuário sem privilégios e healthcheck; Compose local sem volume persistente; Kubernetes namespace/deployment/service/configmap, probes, recursos e contexto de segurança, uma réplica/Recreate. Sem PVC, Ingress ou segredos reais.

Testar isolamento, permissões, payload inválido, conflito, duplicação de requisição, cálculos e falhas. Build/TypeScript/suíte existente e nova; navegador desktop/mobile. Validar Docker/kubectl quando disponíveis, registrar precisamente qualquer bloqueio do runtime.
