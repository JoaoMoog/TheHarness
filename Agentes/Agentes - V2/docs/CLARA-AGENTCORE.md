# CLARA no Amazon Bedrock AgentCore

O piloto usa AgentCore Harness, com o modelo `us.amazon.nova-2-lite-v1:0`, em `us-east-1`. O Harness gerencia o agente sobre AgentCore Runtime. A autenticação Microsoft, o SQLite e as fontes da CLARA continuam no servidor atual.

## Fluxo

1. O servidor autentica a pessoa e resolve seu espaço, fonte e conversa.
2. Envia ao AgentCore apenas o pedido, o catálogo, agregados, filtros e até 40 mensagens autorizadas. Não envia a coleção de registros.
3. O agente esclarece informações faltantes ou retorna uma proposta JSON. O servidor valida o contrato e a compatibilidade com a fonte.
4. A pessoa aplica a proposta e salva pelo fluxo existente. O agente não recebe ferramentas de escrita, SQL, shell ou acesso ao banco.

Cada chamada recebe um UUID novo de sessão. O histórico persistido e isolado na CLARA é a memória oficial; AgentCore Memory fica desativado para evitar duas fontes de histórico e retenção adicional. Não há fallback silencioso para demonstração ou Bedrock direto.

## Recursos do piloto

Veja os identificadores completos em [pilot-resources.json](../infra/agentcore/pilot-resources.json).

- Harness: `clara_pilot-gGzyXd2TUA`; endpoint `live`, versão 1.
- Modelo: Nova 2 Lite, perfil de inferência US nas regiões `us-east-1`, `us-east-2` e `us-west-2`.
- Role de execução: `/clara/clara-agentcore-execution`, restrita ao modelo e aos logs do runtime, com proteção contra confused deputy.
- Autenticação de entrada: IAM/SigV4. Endpoint AWS acessível pela rede pública com TLS e autenticação; não expõe um servidor sem autenticação.
- Limites: 1 iteração, 2.000 tokens de saída, 45 s de execução; cliente com limite de 60 s, sem repetição automática de invocações.
- Sessões: expiram após 60 s ociosas, máximo de 300 s. Aplicação limita pedidos e impede chamadas concorrentes na mesma conversa.
- CloudWatch Logs: entrega `APPLICATION_LOGS` em formato `plain`, KMS com rotação automática e retenção de 30 dias. A entrega seleciona somente identificadores, horário, serviço, operação e severidade, excluindo payloads, corpo e atributos. O formato JSON foi descartado porque manteve payloads aninhados no teste sintético apesar de `recordFields`. Captura detalhada OpenTelemetry desativada; a aplicação registra duração e tokens sem conteúdo da conversa.
- Dashboard CloudWatch: `CLARA-AgentCore`; alarmes para erros, throttling e volume de chamadas. Alarmes visíveis no console, sem notificações externas configuradas.
- CloudTrail: `clara-agentcore-audit`, eventos de gerenciamento da região e eventos de dados do runtime da CLARA. Bucket privado com TLS obrigatório, criptografia SSE-S3, validação de integridade e retenção de 90 dias.

Os recursos têm cobrança normal da AWS: inferência, execução, logs, chave KMS, alarmes e auditoria. Os limites de execução não são um teto mensal de gastos.

## Autenticação local e produção

O usuário autorizou explicitamente manter o perfil `clara-piloto` da conta raiz **neste piloto**. A AWS não permite `AssumeRole` a partir da conta raiz; por isso `AGENTCORE_INVOKER_ROLE_ARN` fica vazio neste ambiente. Nenhuma chave de acesso foi criada ou gravada no projeto.

Foi preparada a role `/clara/clara-agentcore-invoker`, com acesso somente ao agente e bloqueio explícito da execução direta de comandos. Para usá-la, configure um perfil não root autorizado a assumir essa role e defina `AGENTCORE_INVOKER_ROLE_ARN`. Em hospedagem AWS, prefira uma role anexada à aplicação com a mesma política, sem `AWS_PROFILE`. A identidade Microsoft de cada pessoa continua sendo autorizada pela CLARA; SigV4 não propaga automaticamente essa identidade para ferramentas externas.

Este piloto usa rede pública autenticada. Uma implantação de produção que precise de serviços privados deve configurar VPC e os endpoints necessários, além da identidade de serviço e do canal de alertas. Não foram criados recursos de VPC sem necessidade do piloto.

## Configuração e operação

Os valores de exemplo estão em [app/.env.agentcore.example](../app/.env.agentcore.example). A ativação local usa `STUDIO_AI_PROVIDER=agentcore` e `AI_PROVIDER=agentcore` em `.env.pilot.local`, preservando as configurações de dados e SSO.

Na pasta `app`:

```powershell
npm.cmd run agentcore:check
npm.cmd run test:agentcore:live
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run pilot:start
```

`agentcore:check` verifica conta, estado do agente, endpoint e uma resposta real com dados sintéticos. Os testes de conversa usam armazenamento em memória e uma fonte sintética isolada; não alteram dashboards persistidos. Esses comandos de verificação fazem chamadas reais e têm custo de inferência.

Os scripts em `infra/agentcore` são executados pelo `run_script` do MCP oficial AWS, que fornece `call_boto3`: `provision.py`, aguardar `READY`, `finalize.py`, uma invocação para gerar métricas e `monitoring.py`. São restritos à conta/região deste piloto. O bootstrap não atualiza automaticamente uma versão existente. Após reexecutar o bootstrap, execute também `finalize.py` para reaplicar o escopo exato da role. Mudanças de configuração do Harness devem criar uma versão e mover `live` após validação; os prompts e contratos também são versionados no código da aplicação.

Para reverter a integração, defina ambos os provedores como `bedrock`, mantenha `BEDROCK_MODEL_ID` e reinicie. Isso não apaga recursos AWS nem dados. Recursos ociosos de monitoração/auditoria/KMS continuam existindo e devem ser removidos explicitamente se o piloto for encerrado.

## Validação

Validação realizada: build de produção, TypeScript, suíte automatizada, teste do fluxo de conversa no navegador e chamadas reais ao AgentCore com dados sintéticos. A conversa real cobriu objetivo incompleto, ano ambíguo, resposta curta, refinamento e isolamento de uma nova conversa. O serviço foi reiniciado em `http://127.0.0.1:3000`; `/api/health` respondeu com sucesso. CloudTrail confirmou a entrega dos primeiros arquivos de auditoria ao S3.

## Referências

- [AgentCore Harness](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness.html)
- [Segurança e IAM](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-security.html)
- [Observabilidade, auditoria e custos](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-operations.html)
- [InvokeHarness](https://docs.aws.amazon.com/bedrock-agentcore/latest/APIReference/API_InvokeHarness.html)
