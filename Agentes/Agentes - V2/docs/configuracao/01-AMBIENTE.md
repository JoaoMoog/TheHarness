# Ambiente e variáveis

## Instalação

Use Node.js 22 LTS ou uma versão posterior compatível, npm e AWS CLI v2 para procedimentos operacionais. A aplicação usa Next.js 16. O servidor precisa alcançar por HTTPS Microsoft Entra, AWS e, quando configurado, o tenant SAC e seu serviço OAuth.

```powershell
Set-Location D:\Prometeu\app
npm.cmd ci
Copy-Item .env.runtime.example .env.local
```

Edite os valores sem preencher segredos. Em produção, variáveis podem ser fornecidas pelo serviço que executa o processo; o `.env` é a referência única de configuração, não um arquivo obrigatório dentro da imagem. Nunca use `NEXT_PUBLIC_` para credenciais.

### Modos de execução

| Comando | Arquivo de configuração | Uso |
|---|---|---|
| `npm run studio` | `.env.local`, sobreposto pelo ambiente do processo | Desenvolvimento |
| `npm run build` e `npm run studio:start` | `.env.local` / ambiente | Aplicação de produção, inclusive SAP real |
| `npm run pilot:start` após build | `.env.pilot.local`, sobreposto pelo ambiente | Piloto local com serviço financeiro **sintético** |
| `node .next/standalone/server.js` | Ambiente injetado no processo | Imagem/serviço de produção; copie também `public` e `.next/static` para a estrutura standalone |

O piloto exige `STUDIO_DATA_PROVIDER=financial-test` e sobe dois processos. Para SAP real use `studio:start` ou standalone, não `pilot:start`. Defaults de demonstração existem para desenvolvimento, mas produção deve definir explicitamente autenticação, fonte, IA e armazenamento.

## Variáveis da aplicação

| Variável | Exemplo / padrão | Finalidade |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `PUBLIC_APP_URL` | `https://clara.empresa.com` | Origem pública exata, usada no controle de origem e cookies seguros |
| `CLARA_STORAGE_MODE` | `sqlite` | Persistência; `memory` só para demonstração/testes |
| `PROMETEU_DATA_DIR` | `/var/lib/clara` | Diretório gravável e persistente do banco |
| `CLARA_TIME_ZONE` | `America/Sao_Paulo` | Fuso da data nas apresentações |
| `AUTH_MODE` | `msal` | Login Microsoft; `local`/`demo` somente quando intencional |
| `LOCAL_AUTH_ENABLED` | `false` | Desabilita contas locais em produção |
| `NEXT_TELEMETRY_DISABLED` | `1` | Desabilita telemetria do framework |
| `HOSTNAME` | `0.0.0.0` no standalone | Interface de escuta da implantação; o launcher do piloto usa loopback |

## AWS e modelos

| Variável | Valor / finalidade |
|---|---|
| `AWS_REGION` | Região dos clientes Bedrock e AgentCore, por exemplo `us-east-1` |
| `AWS_PROFILE` | Perfil local. Omitir em workload com role IAM anexada |
| `AWS_SECRETS_REGION` | Região do segredo; na ausência usa `AWS_REGION` |
| `CLARA_SECRET_ID` | ARN ou nome do segredo JSON no Secrets Manager |
| `CLARA_SECRETS_REQUIRED` | `true` em produção: não inicia sem referência de segredo |
| `STUDIO_AI_PROVIDER` / `AI_PROVIDER` | `agentcore` na interface atual / interface clássica; `bedrock` para Converse direto; `demo` em testes |
| `BEDROCK_MODEL_ID` | Modelo desejado para Converse e utilitário de configuração: `us.anthropic.claude-haiku-5-5` |
| `BEDROCK_MAX_TOKENS` | `2000`; inteiro de 256 a 16000 |
| `BEDROCK_TIMEOUT_MS` | `60000`; inteiro de 5000 a 120000; AgentCore recebe um prazo interno 5 s menor |
| `BEDROCK_TEMPERATURE` | Opcional, de 0 a 1; deixe vazio para Haiku 5.5 |
| `BEDROCK_ADDITIONAL_FIELDS` | JSON de opções do modelo. Para esta configuração: `{"thinking":{"type":"disabled"}}` |
| `AGENTCORE_HARNESS_ARN` | ARN do harness na mesma região de `AWS_REGION` |
| `AGENTCORE_ENDPOINT` | Nome do endpoint versionado, como `live` |
| `AGENTCORE_INVOKER_ROLE_ARN` | Role de invocação opcional via STS. Não usar com conta raiz, que não pode assumir roles |
| `AGENTCORE_NAME` / `AGENTCORE_EXECUTION_ROLE_ARN` | Valores de provisionamento para gerar a configuração do harness |
| `BEDROCK_IMAGE_MODEL_ID` / `BEDROCK_IMAGE_REGION` | Modelo e região da geração de capas; separados do modelo de texto |

AWS access key, secret key e session token não devem ficar em arquivos do projeto. Use AWS SSO/login no computador e role IAM no servidor. A role é a identidade inicial necessária para acessar o Secrets Manager; não tente guardar a única credencial capaz de acessá-lo dentro dele.

## Microsoft Entra e créditos

| Variável | Finalidade |
|---|---|
| `MSAL_TENANT_ID` | Directory/tenant ID da organização |
| `MSAL_API_CLIENT_ID` | Application/client ID do registro da API |
| `MSAL_API_SCOPE` | Nome curto do escopo, normalmente `access_as_user` |
| `MSAL_SPA_CLIENT_ID` | Application/client ID do registro SPA |
| `MSAL_SPA_SCOPE` | Escopo completo: `api://<API_CLIENT_ID>/access_as_user` |
| `CLARA_PLATFORM_ADMIN_GROUP_IDS` | Object IDs dos grupos de segurança permitidos, separados por vírgula; vazio bloqueia os menus administrativos de créditos e uso |
| `CLARA_MONTHLY_CREDITS` | `1250`, equivalente a 250 chamadas de 5 créditos |
| `CLARA_AI_CREDIT_COST` | `5`; falhas elegíveis são estornadas |

O servidor entrega somente IDs e escopos públicos ao navegador. `NEXT_PUBLIC_MSAL_CLIENT_ID`, `NEXT_PUBLIC_MSAL_TENANT_ID` e `NEXT_PUBLIC_MSAL_SCOPE` são aliases legados; prefira `MSAL_*` para configuração em runtime. Valores `NEXT_PUBLIC_*` exigem rebuild quando usados no bundle clássico. Não há `MSAL_CLIENT_SECRET` neste fluxo.

## SAP

| Variável | Finalidade |
|---|---|
| `STUDIO_DATA_PROVIDER` | `sap`, `financial-test` ou `demo` |
| `SAP_CONNECTION_MODE` | `sac` para Analytics Cloud; `odata` para o conector anterior |
| `SAP_SAC_TENANT_URL` | Apenas origem HTTPS, sem caminho, query ou credenciais |
| `SAP_SAC_TOKEN_URL` | URL OAuth fornecida pelo SAC; não é a URL Microsoft |
| `SAP_SAC_CLIENT_ID` | ID do OAuth client técnico de exportação |
| `SAP_SAC_SCOPE` | Opcional; somente se o tenant exigir um scope específico |
| `SAP_SAC_NAMESPACE` / `SAP_SAC_PROVIDER` | Namespace e ID do modelo padrão para importação |
| `SAP_SAC_DEFAULT_QUERY` | Query OData de importação sem `?`, como `$filter=Version eq 'public.Actual'`; use aspas duplas no `.env` se houver aspas simples internas |
| `SAP_SAC_WORKSPACE_MODELS` | JSON dos modelos autorizados por ID de espaço CLARA, sem wildcard |
| `SAP_STUDIO_MAPPING` | JSON de mapeamento financeiro legado, opcional para importações genéricas |
| `SAP_READ_URL` | Coleção HTTPS do conector OData/JSON legado |

`SAP_SAC_CLIENT_SECRET` e `SAP_READ_TOKEN` são chaves do JSON do Secrets Manager. Não preencher no `.env` de implantação. Elas são carregadas em memória no início do servidor.

## Opcionais e utilitários

- `FINANCIAL_TEST_PORT`, `FINANCIAL_TEST_PROFILE`: porta e perfil do serviço sintético. O launcher gera o token efêmero `FINANCIAL_TEST_TOKEN`, compartilhado somente entre os processos locais; ele não é credencial SAP corporativa persistente.
- `CLARA_ENV_FILE`: arquivo usado pelos utilitários de modelo/migração, padrão `.env.local`.
- `CLARA_SECRET_NAME`, `CLARA_SECRET_KMS_KEY_ID`: nome e CMK opcional na migração inicial de credenciais para AWS.
- `PLAYWRIGHT_BASE_URL`: URL de testes quando o runner precisar de um servidor externo. Não é configuração funcional da aplicação.

Os limites de entrada, enums de gráficos e regras de negócio são contratos de código, não segredos nem variáveis de infraestrutura. A personalização visual BTG está no template. Não exponha essas opções como configuração enviada pelo navegador ao modelo.
