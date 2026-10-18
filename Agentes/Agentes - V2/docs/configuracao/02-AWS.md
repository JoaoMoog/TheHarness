# AWS: IAM, Secrets Manager, Bedrock e AgentCore

## 1. Identidade e região

No computador, configure um perfil AWS de usuário/função com credenciais temporárias, usando AWS CLI v2 e SSO/login. Na aplicação hospedada, use a role do serviço (task role ECS, instance profile EC2 etc.). Preencha `AWS_REGION` e, apenas localmente, `AWS_PROFILE` no arquivo de ambiente.

O piloto existente foi autorizado a usar o perfil atual. Isso não é a configuração recomendada para produção. Conta raiz não pode assumir a role informada em `AGENTCORE_INVOKER_ROLE_ARN`; deixe-a vazia nesse piloto. A identidade da aplicação em produção deve ter somente as permissões necessárias.

Valide a identidade sem imprimir credenciais:

```powershell
aws --version
aws sts get-caller-identity --profile clara-piloto --region us-east-1
```

Os argumentos acima são exemplos operacionais. Para outra implantação, use os valores do seu `.env`; não copie IDs da conta do piloto para outra conta.

## 2. Separar responsabilidades IAM

| Identidade | Permissões necessárias |
|---|---|
| Aplicação CLARA | `bedrock-agentcore:InvokeHarness` no harness/endpoint configurados e `secretsmanager:GetSecretValue` no segredo da aplicação |
| Role de execução do harness | `bedrock:InvokeModel` e `bedrock:InvokeModelWithResponseStream` no inference profile e nos foundation models de destino; permissões de runtime/logs requeridas pelo AgentCore |
| Operador de implantação | Criar/atualizar harness e endpoint, configurar IAM/PassRole, consultar catálogo e testar o modelo |
| Administrador do segredo | Criar e rotacionar o segredo; aplicação não precisa de `PutSecretValue` |

Para uma CMK própria, a aplicação também precisa de `kms:Decrypt`, e a key policy deve permitir a role. Restrinja à chave e ao uso pelo Secrets Manager. O SDK usa a cadeia padrão AWS; o código não contém access keys.

Exemplo de statement para o segredo, substituindo o ARN pelo valor de `CLARA_SECRET_ID`:

```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:REGIAO:CONTA:secret:clara/prod/application-SUFIXO"
}
```

Permissões de modelo precisam incluir o ARN do inference profile **e** os ARNs dos modelos nas regiões para as quais ele encaminha chamadas. Consulte `GetInferenceProfile` antes de escrever a política. O perfil `us.` usa roteamento nos EUA; confirme a política de residência de dados da organização antes de adotá-lo. [Documentação de inference profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html).

## 3. Criar o segredo

No console AWS Secrets Manager, crie um segredo do tipo “Other type of secret”, com nome por ambiente, por exemplo `clara/prod/application`. Salve JSON contendo somente as credenciais utilizadas:

```json
{
  "SAP_SAC_CLIENT_SECRET": "VALOR_FORNECIDO_PELO_SAC"
}
```

Outras chaves aceitas, quando necessárias: `SAP_READ_TOKEN` (conector legado). Não inclua chaves vazias, configurações de tenant, IDs de grupo, modelo ou credenciais AWS nesse JSON. O loader rejeita chaves desconhecidas e não aplica uma carga parcial.

No `.env`, deixe somente:

```dotenv
AWS_REGION=us-east-1
AWS_SECRETS_REGION=us-east-1
CLARA_SECRET_ID=arn:aws:secretsmanager:us-east-1:CONTA:secret:clara/prod/application-SUFIXO
CLARA_SECRETS_REQUIRED=true
```

Ao iniciar o servidor Node do Next.js, `src/instrumentation.ts` chama `loadAwsSecrets`. Ele lê `AWSCURRENT`, valida o JSON e injeta as credenciais apenas no ambiente do processo servidor. Não envia valores ao navegador, não grava o segredo em disco e não o inclui nas mensagens de erro. Falha de leitura interrompe a inicialização. [GetSecretValue](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets-javascript.html).

### Rotação

1. Gere a nova credencial no fornecedor.
2. Atualize o segredo no Secrets Manager, promovendo a versão correta a `AWSCURRENT`.
3. Reinicie todas as instâncias CLARA para recarregar o valor.
4. Valide a consulta e só então revogue a credencial anterior.

O loader usa uma leitura por inicialização; esta implementação **não** faz refresh automático do segredo. Tokens OAuth SAC são renovados conforme sua expiração em memória, mas a alteração do client secret exige reinício. O build deve usar ambiente próprio sem segredos; a leitura relevante acontece no servidor de execução. Não incorpore `.env.local` com valores secretos na imagem ou nos artefatos standalone.

### Migrar uma chave já existente

O utilitário `scripts/secrets-migrate.ts` cria um novo segredo, confirma a leitura e só então remove os valores secretos do arquivo local. Ele não sobrescreve segredo existente. Para uma rotação, use Secrets Manager, não o migrador.

Defina no ambiente operacional `CLARA_ENV_FILE`, `AWS_REGION`, `AWS_PROFILE` e `CLARA_SECRET_NAME`. Depois execute `npm run secrets:migrate`. O comando imprime apenas ARN, nomes das chaves e arquivo alterado. A antiga integração TypeSafe foi retirada a pedido do usuário; sua chave não foi enviada para AWS.

## 4. Habilitar e testar Haiku 5.5

Modelo alvo: `anthropic.claude-haiku-5-5`; inference profile escolhido: `us.anthropic.claude-haiku-5-5`. Ambos foram encontrados no catálogo AWS da região `us-east-1`. [Model card oficial](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html).

Antes de mudar o agente:

1. No catálogo Bedrock, confirme disponibilidade e permissões para a conta/região.
2. Complete os requisitos de acesso Anthropic e o agreement do modelo, se solicitados pela AWS.
3. Faça uma chamada curta de teste pelo perfil alvo.
4. Só após sucesso, atualize a role de execução e o harness.

Em 18/10/2026, a conta do piloto retornou `AccessDeniedException`, com orientação para contato comercial AWS. `GetFoundationModelAvailability` retornou `agreementAvailability=NOT_AVAILABLE`; não se trata de corrigir o ID no código. O endpoint `live` continua usando Nova 2 Lite. Não há fallback silencioso de Haiku para Nova: o agente ativo não foi trocado.

Configuração preparada:

```dotenv
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-5-5
BEDROCK_MAX_TOKENS=2000
BEDROCK_TIMEOUT_MS=60000
BEDROCK_TEMPERATURE=
BEDROCK_ADDITIONAL_FIELDS='{"thinking":{"type":"disabled"}}'
```

A opção de thinking é explícita porque Haiku 5.5 usa pensamento adaptativo por padrão, que compartilha o orçamento de saída. [Configuração oficial de thinking](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html).

## 5. Criar um harness em uma nova implantação

1. Crie uma role de execução para o serviço `bedrock-agentcore.amazonaws.com`. Restrinja a confiança por `aws:SourceAccount` e pelos ARNs de harness/runtime da conta/região.
2. Anexe a permissão de modelo mencionada acima. Inclua as permissões exigidas pelo runtime gerenciado, ECR público e CloudWatch conforme a documentação AgentCore. Não dê `AdministratorAccess` à aplicação.
3. Preencha `AGENTCORE_NAME`, `AGENTCORE_EXECUTION_ROLE_ARN`, `AWS_REGION`, `BEDROCK_MODEL_ID` e os parâmetros de inferência no `.env`.
4. Gere o arquivo com `node --import tsx scripts/export-agentcore-config.ts`. Crie a pasta `.local` antes, se ainda não existir. O arquivo gerado é configuração não secreta.
5. Crie o harness pelo console ou com AWS CLI atualizada: `aws bedrock-agentcore-control create-harness --cli-input-json file://.local/agentcore-config.json --region <AWS_REGION> --profile <AWS_PROFILE>`. Em uma role de workload, omita `--profile`.
6. Aguarde `GetHarness` indicar `READY` e anote ARN, ID e versão.
7. Crie o endpoint: `aws bedrock-agentcore-control create-harness-endpoint --harness-id <ID> --endpoint-name live --target-version <VERSAO> --region <REGIAO>`; aguarde `READY`.
8. Preencha `AGENTCORE_HARNESS_ARN` e `AGENTCORE_ENDPOINT` no `.env` da aplicação.

O gerador mantém memória desabilitada, ferramentas/skills vazias e uma iteração por chamada. A CLARA manda contexto autorizado do banco e utiliza sessão de runtime nova por requisição. O agente interpreta a intenção; não acessa SAP diretamente nem executa código. O runtime gerado usa rede pública para os serviços gerenciados; a aplicação continua sendo a única responsável pela conexão SAP. [Harness AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-harness.html).

## 6. Trocar o modelo de um harness existente

Depois de a AWS liberar o modelo:

```powershell
# Escolha o arquivo correto antes de executar.
$env:CLARA_ENV_FILE = '.env.pilot.local'
npm.cmd run agentcore:model -- --activate
npm.cmd run agentcore:check
```

O utilitário testa o modelo **antes** de alterar IAM/harness, registra a versão anterior, adiciona uma política específica para o novo modelo, atualiza o harness e espera `READY`. Com `--activate`, aponta o endpoint para a versão retornada. Sem essa flag, prepara uma versão sem mover o endpoint. Confirme o endpoint `READY` antes de testar o chat.

`BEDROCK_MODEL_ID` altera Converse direto e informa o utilitário; ele não muda sozinho a versão remota do AgentCore. As opções do modelo no harness são implantadas pelo utilitário, não aceitas no corpo HTTP do chat.

### Rollback

Use `UpdateHarnessEndpoint` ou `aws bedrock-agentcore-control update-harness-endpoint --harness-id <ID> --endpoint-name <ENDPOINT> --target-version <VERSAO_ANTERIOR>`. O utilitário preserva a política anterior para permitir retorno. Revalide filtros, pedidos incompletos e apresentações depois de qualquer mudança. Use dados sintéticos na homologação.

## 7. Logs e custos

Acompanhe erros, latência, throttling e tokens no CloudWatch e chamadas administrativas no CloudTrail. Defina retenção, alarmes e orçamento AWS adequados à organização. Não habilite registro de prompts/linhas empresariais sem uma política explícita de dados. Créditos CLARA são uma regra de uso por usuário, não uma medida exata da cobrança AWS; capas e outras operações também podem gerar custo.
