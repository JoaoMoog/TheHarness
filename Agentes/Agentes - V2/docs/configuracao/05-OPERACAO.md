# Validação e operação

## Antes de liberar

1. Configure `.env` usando o inventário, com referências de segredo e IDs reais.
2. Valide identidade IAM e permissões do Secrets Manager.
3. Confirme login Microsoft e o grupo de administradores da plataforma.
4. Configure modelos SAP por workspace; consulte catálogo, metadata e uma página de fatos.
5. Teste o modelo Bedrock e o endpoint AgentCore antes de ativar mudanças.
6. Execute a verificação da aplicação:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e -- input-validation.spec.ts header-panels.spec.ts product-expansion.spec.ts executive-btg.spec.ts
```

Os testes de navegador usam dados/contas sintéticos isolados. Não exigem SAP corporativo nem geram convites para usuários reais. A checagem `npm run agentcore:check` usa AWS de verdade e deve ser executada separadamente com o perfil autorizado.

## Atualizar a aplicação

Pare o processo local antes de recompilar o diretório usado pelo piloto. Gere o build e reinicie com a configuração correta. Em produção, faça implantação por versão, com health check e rollback. Não copie um `.next` parcialmente gerado para a instância ativa.

Use `GET /api/health` para disponibilidade HTTP. Um `200` não prova login Microsoft, acesso ao modelo ou leitura SAP; valide cada integração com uma chamada funcional. Faça backup consistente do SQLite com a aplicação parada ou com o mecanismo de backup suportado pelo banco. Não copie um arquivo em uso ignorando os arquivos WAL.

## Apresentações executivas

O fluxo de chat propõe uma apresentação; o usuário escolhe os dashboards e confere antes de baixar o HTML. Também é possível abrir a ação de apresentação no dashboard. O servidor consulta as fontes autorizadas e renderiza o template BTG.

O arquivo inclui logo incorporada, estilos, SVGs e navegação local. Não depende de CDN. Contém:

- Capa azul-marinho e identificação das análises.
- Resumos com até quatro indicadores por slide.
- Visualizações com notas descritivas calculadas, sem previsão inventada.
- Fontes, filtros, revisão e sinalização de dados sintéticos.
- Apêndice paginado com os valores dos gráficos.
- Navegação por botões/setas, tela cheia e impressão 16:9.

A logo oficial disponível no projeto é reutilizada; o template segue uma direção visual BTG, mas não substitui aprovação formal de marca da organização. O HTML é um snapshot: gerar novamente após atualização de dados. Ao compartilhar o arquivo, o acesso já não é controlado pelos grupos/workspaces da aplicação; trate o documento conforme a classificação dos dados.

## Observabilidade

Observe duração e falhas de invocação, tokens, erros de autenticação, consulta SAP e alterações administrativas. Logs não devem registrar tokens, client secrets nem conteúdo completo de planilhas. Restrinja exportação de logs e retenção segundo a organização.

A aplicação devolve mensagens sanitizadas das integrações. Para diagnóstico de IAM/modelo, use o request ID e os registros AWS com uma identidade operacional. Não copie o conteúdo de `.env.local`, arquivos de credenciais AWS ou respostas de GetSecretValue para tickets.

## Diagnóstico rápido

| Sintoma | Ação |
|---|---|
| Servidor falha ao iniciar após ativar Secrets Manager | Conferir região, ARN, `GetSecretValue`, KMS e JSON com apenas chaves permitidas |
| Nova credencial SAP não funciona | Atualizar AWSCURRENT e reiniciar todas as instâncias |
| Haiku aparece no catálogo, mas invocação falha | Conferir entitlement/agreement e liberação da conta; não mover endpoint antes do teste |
| `.env` mudou, AgentCore continua no modelo anterior | Atualizar harness e endpoint; variável local não implanta a versão remota |
| SAP retorna 403 na CLARA | Conferir associação ao workspace e `SAP_SAC_WORKSPACE_MODELS` |
| SAP retorna 502 | Validar OAuth client, exportação habilitada, provider ID, entidade e query |
| Dados SAC não cabem no modelo financeiro | Usar importação genérica ou transformar/validar a origem; não inventar mapeamento |
| Menu de créditos não aparece | Validar grupo no access token da API e fazer novo login |
| Créditos ou sessões inconsistentes entre instâncias | SQLite não é compartilhado; usar uma instância ou migrar persistência antes de escalar |

## Arquivos operacionais

| Arquivo | Finalidade |
|---|---|
| `app/.env.prod` | Inventário de implantação sem segredos |
| `app/scripts/configure-agentcore-model.ts` | Testar acesso, preparar versão e ativar modelo explicitamente |
| `app/scripts/export-agentcore-config.ts` | Gerar configuração inicial do harness a partir do env |
| `app/scripts/secrets-migrate.ts` | Migração inicial, sem imprimir valores |
| `app/scripts/export-sap-contract.ts` | Regenerar OpenAPI SAP |
| `app/scripts/preview-executive.ts` | Gerar apresentação de exemplo com dados sintéticos |
| `infra/agentcore/pilot-resources.json` | Registro da infraestrutura existente; não contém credenciais |

Os scripts históricos em `infra/agentcore/*.py` registram o provisionamento específico do piloto. Para outra implantação, use o env e o gerador deste guia; não replique os identificadores históricos de conta, role e recurso.
