# SAP Analytics Cloud: configuração e contrato

## 1. Integração escolhida

A integração usa o **SAP Analytics Cloud Data Export Service**, base upstream `https://<tenant>/api/v1/dataexport`. Um provider representa um modelo ou tabela disponibilizada pelo serviço; não é o ID de uma story.

A CLARA publica um adaptador em `/api/v1/sap/dataexport`. Ele conserva os caminhos de leitura e a estrutura OData, mas acrescenta sessão CLARA, autorização por workspace/modelo, limites e tratamento de erros. É um subconjunto compatível com os endpoints documentados, não uma cópia completa da API SAP.

Confirme a disponibilidade do Data Export Service para o tenant/licença e os requisitos de exportação do modelo. Modelos com exportação restrita podem impedir a leitura. [Referência principal SAP](https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/db62fd76514b48f8b71d695360320f4a.html?q=data+export+service).

## 2. Criar o OAuth client no SAP

Na administração do SAC, abra **App Integration → Configured Clients** e crie um OAuth client técnico para API Access, com acesso ao **Data Export Service** e grant **Client Credentials**. Anote tenant, token URL e client ID; coloque o client secret no Secrets Manager.

Configure tempo de vida definido para o token. Habilite exportação/API access no modelo, conforme a versão do SAC. Esta implementação faz autenticação técnica: ela não propaga a identidade Entra do usuário para aplicar DAC por usuário SAP. Restrinja os modelos por workspace na CLARA e use somente modelos cujo conteúdo completo possa ser compartilhado com os membros desse espaço. [Fluxo documentado por SAP](https://community.sap.com/t5/technology-blog-posts-by-sap/getting-authenticated-with-data-export-and-data-import-api-s/ba-p/14060183).

```dotenv
STUDIO_DATA_PROVIDER=sap
SAP_CONNECTION_MODE=sac
SAP_SAC_TENANT_URL=https://seu-tenant.eu10.hcs.cloud.sap
SAP_SAC_TOKEN_URL=https://seu-servidor-oauth/oauth/token
SAP_SAC_CLIENT_ID=<client ID>
SAP_SAC_SCOPE=
SAP_SAC_NAMESPACE=sac
SAP_SAC_PROVIDER=<provider ID>
SAP_SAC_DEFAULT_QUERY=
SAP_SAC_WORKSPACE_MODELS='{"ID_DO_ESPACO_CLARA":[{"namespace":"sac","provider":"ID_DO_MODELO"}]}'
```

O token endpoint é o fornecido pelo SAP; não derive o endereço por tentativa. A CLARA envia `grant_type=client_credentials` com Basic Authentication do OAuth client e usa Bearer apenas para as consultas SAC. Usa `x-sap-sac-custom-auth: true`, HTTPS, timeout e rejeita redirects. O segredo nunca acompanha uma resposta ao navegador. [Exemplo oficial de conexão SAC/OData](https://community.sap.com/t5/financial-management-blog-posts-by-sap/how-to-setup-model-view-odata/ba-p/13541025).

## 3. Descobrir IDs e autorizar espaços

O administrador SAP pode consultar o catálogo diretamente com sua credencial para obter namespace e provider ID. Depois configure somente os modelos liberados em `SAP_SAC_WORKSPACE_MODELS`. Os endpoints CLARA não servem como catálogo irrestrito de todo o tenant.

O ID de workspace vem de `GET /api/v1/studio/bootstrap`, campos `workspace.id` e `workspaces`. Configure todos os espaços necessários individualmente. Espaço sem entrada no mapa recebe `403`; não existe wildcard nem herança por nome.

## 4. Endpoints de leitura implementados

Todos os caminhos abaixo são relativos a `/api/v1/sap/dataexport`. Exigem cookie de sessão `prometeu-session`; envie `x-clara-workspace` com o ID selecionado. A API valida associação ao espaço antes de consultar a lista de modelos.

| Método | Caminho | Resposta |
|---|---|---|
| GET | `/administration/$metadata` | XML EDMX do catálogo |
| GET | `/administration/Namespaces` | Namespaces permitidos ao workspace |
| GET | `/administration/Namespaces(NamespaceID='{NamespaceID}')` | Namespace autorizado |
| GET | `/administration/Namespaces(NamespaceID='{NamespaceID}')/Providers` | Providers filtrados pelo mapa de autorização |
| GET | `/providers/{NamespaceID}/{ProviderID}` | Service document com entity sets disponíveis |
| GET | `/providers/{NamespaceID}/{ProviderID}/$metadata` | XML EDMX com tipos e propriedades do modelo |
| GET | `/providers/{NamespaceID}/{ProviderID}/FactData` | Fatos do modelo |
| GET | `/providers/{NamespaceID}/{ProviderID}/{EntitySet}` | Coleção simples de dados mestres existente no service document |

Os nomes de coleções devem vir do service document: não suponha que todo modelo tenha a mesma estrutura. [Service document oficial](https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/4e4f683c8b4346e184dee6b7647af1a1.html?locale=en-US).

### Parâmetros aceitos

| Parâmetro | Limite na CLARA | Uso |
|---|---|---|
| `$select` | 2.048 caracteres | Lista de propriedades; preserve dimensões obrigatórias do SAC |
| `$filter` | 2.048 caracteres | Filtro OData avaliado pelo SAP |
| `$top` | Inteiro 1–1.000 | Tamanho solicitado da página, se suportado pelo endpoint |
| `$skip` | Inteiro 0–20.000 | Offset, se suportado pelo endpoint |
| `$skiptoken` / `nextEntity` | 2.048 caracteres | Cursor retornado pelo SAP |
| `$format` | Apenas `json` | Formato de dados |

O suporte de cada parâmetro depende do endpoint SAC; a validação CLARA não inventa recursos no upstream. Parâmetros desconhecidos, repetidos, vazios ou contendo controles são rejeitados. Não são aceitos `$expand`, `$batch`, links arbitrários, headers de track-changes nem `deltaid`. `FactDataDifference` e `Subscriptions` estão fora do escopo.

### Exemplo no navegador autenticado

```javascript
const workspace = 'ID_DO_ESPACO_CLARA';
const query = new URLSearchParams({
  '$select': 'Version,Account,Region,Time,Revenue',
  '$filter': "Version eq 'public.Actual'",
});
const response = await fetch(
  '/api/v1/sap/dataexport/providers/sac/MODEL_ID/FactData?' + query,
  {headers: {'x-clara-workspace': workspace}, credentials: 'same-origin'}
);
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
```

Exemplo **ilustrativo**, com colunas que devem ser substituídas pelas do modelo real:

```json
{
  "@odata.context": "$metadata#FactData",
  "value": [
    {"Version":"public.Actual","Account":"4100","Region":"BR","Time":"202601","Revenue":125000.25}
  ],
  "@odata.nextLink": "/api/v1/sap/dataexport/providers/sac/MODEL_ID/FactData?nextEntity=CURSOR"
}
```

Quando houver `@odata.nextLink`, siga-o enviando o mesmo header de workspace e cookie. A CLARA só aceita next links da mesma origem e da mesma coleção upstream; reescreve o link para a rota local. Nunca envie credencial SAP ao browser. O contexto OData pode conservar referências ao serviço SAP; não use `@odata.context` como endereço para buscar dados. A paginação só termina quando não houver próximo link. [Formato de FactData](https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/f7feb7c0792948e89cf89bcdb60db5d2.html?locale=en-US).

## 5. Importar para um dataset CLARA

Endpoint existente, ampliado para escolher um modelo autorizado:

```http
POST /api/v1/studio/datasets/sap
Content-Type: application/json
x-clara-workspace: ID_DO_ESPACO_CLARA
Origin: https://clara.suaempresa.com
Cookie: prometeu-session=SESSAO
```

```json
{
  "name": "Receita comercial",
  "sac": {"namespace":"sac","provider":"MODEL_ID"}
}
```

Resposta: `{"id":"ID_DA_FONTE","name":"Receita comercial","count":200}`. Exige papel editor ou administrador. Para atualizar, acrescente `sourceId` com uma fonte SAP do mesmo espaço. A fonte guarda o namespace/modelo usado; atualizações posteriores mantêm essa origem, mesmo se o modelo padrão do ambiente mudar. Se `sac` for omitido na criação, usa `SAP_SAC_NAMESPACE` e `SAP_SAC_PROVIDER`.

A importação percorre até 25 páginas e aceita até 20.000 registros, 8 MB e 256 colunas. Nomes de coluna têm até 100 caracteres; textos de célula, até 1.000. São preservados campos esparsos, nulos e identificadores textuais com zeros à esquerda. Objetos aninhados exigem projeção plana na origem. A amostra vira uma fonte persistente e não é atualizada automaticamente por mudança no SAP.

O JSON upstream preserva valores e tipos conforme SAC; ao importar, o parser CLARA infere tipos. Faça conferência de datas, unidades, casas decimais e identificadores antes de usar o dataset em um dashboard. `Time=202601`, por exemplo, não deve ser tratado como uma data ISO sem transformação explícita.

## 6. Contrato financeiro opcional

A importação genérica aceita outras medidas e dimensões sem depender de colunas financeiras. O dashboard financeiro legado, porém, exige mapeamento:

```dotenv
SAP_STUDIO_MAPPING='{"id":"DocumentId","center":"CostCenter","company":"Company","date":"PostingDate","actual":"ActualAmount","budget":"BudgetAmount","currency":"Currency"}'
```

| Campo de destino | Regra |
|---|---|
| `id` | Identificador único por registro |
| `center`, `company` | Texto preenchido, até 100 caracteres |
| `date` | Data ISO válida `AAAA-MM-DD` |
| `actual`, `budget` | Valor numérico finito; módulo até 10¹² |
| `currency` | Coluna com `BRL` |
| `fixedCurrency` | Alternativa à coluna, somente `BRL`; use um ou outro |

FactData do SAC pode representar Actual e Budget em linhas distintas de `Version`, e períodos em outro formato. A CLARA **não** faz pivot contábil ou conversão monetária implícita. Nesse caso, importe como fonte genérica ou prepare uma coleção transformada com regra aprovada. Esse mapeamento não é o contrato universal do SAP.

## 7. Erros e homologação

Erro padrão:

```json
{"error":{"code":"SAP_403","message":"Modelo SAP não autorizado para este espaço."}}
```

| HTTP | Significado |
|---|---|
| 401 | Sessão ausente ou inválida |
| 403 | Sem acesso ao workspace/namespace/provider |
| 404 | Caminho fora do contrato |
| 413 | Resposta ou importação acima do limite |
| 422 | Query inválida ou recurso não suportado |
| 502 | Falha OAuth/SAP ou resposta fora do contrato |
| 503 | Configuração incompleta |
| 504 | Timeout/cancelamento |

Antes da produção, confira com o responsável SAP: dados com nulos, valores negativos, mais de uma página, autorização por modelo, credencial expirada, exportação restrita e concordância dos totais com a origem. Verifique também ausência de dados sensíveis desnecessários nas colunas selecionadas. Os testes locais em `tests/sac.test.ts` validam o adaptador com respostas simuladas; será necessário um teste real após fornecer tenant e credenciais.
