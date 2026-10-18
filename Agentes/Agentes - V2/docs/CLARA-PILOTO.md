# CLARA — piloto local persistente

O piloto conecta a aplicação a um serviço HTTP separado de dados financeiros e ao AWS Bedrock. A fonte é **sintética**; não é SAP real nem implementação completa de OData. A aplicação mantém suas contas e análises em SQLite, mesmo após reiniciar.

## Preparar e iniciar

Requer Node.js 24. Na pasta `D:\Prometeu\app`:

```powershell
npm.cmd ci --cache .local/npm-cache --no-audit --no-fund
npm.cmd run pilot
```

Configure o login conforme [Microsoft SSO](CLARA-SSO-MICROSOFT.md). Abra http://127.0.0.1:3000 e use **Entrar com Microsoft**. O primeiro acesso apresenta a CLARA; os seguintes abrem **Início**, com chat e dashboards recentes. O serviço financeiro escuta em `127.0.0.1:4010`; ambos ficam restritos à máquina. Ctrl+C encerra a aplicação e o serviço. Portas ocupadas produzem erro, sem encerrar processos alheios.

O banco fica em `app/.data/pilot/prometeu.sqlite`, separado dos dados anteriores. Não apague essa pasta se quiser preservar contas, dashboards, histórico, planejamento e cenários. Rascunhos ainda não salvos não sobrevivem ao fechamento da página.

Para executar o build de produção:

```powershell
npm.cmd run build
npm.cmd run pilot:start
```

O iniciador usa o servidor standalone e prepara seus assets locais. Docker não é necessário. Uma única instância é suportada.

## Configurar AWS

Copie `.env.pilot.example` para `.env.pilot.local` caso queira personalizar. O arquivo é exclusivo do piloto; o antigo `.env.local` continua servindo ao Studio/classic. Variáveis do terminal prevalecem. Nunca coloque credenciais em `NEXT_PUBLIC_*`.

Padrões:

```dotenv
AWS_PROFILE=clara-piloto
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.amazon.nova-2-lite-v1:0
STUDIO_AI_PROVIDER=bedrock
```

Para login comum pelo console AWS, atualize a CLI para 2.32.0 ou superior e execute `aws login --profile clara-piloto`. Escolha `us-east-1` quando solicitado e conclua o login no navegador. O SDK instalado suporta esse perfil com credenciais temporárias. A identidade IAM precisa da permissão de login local `SignInLocalDevelopmentAccess`, além das permissões do Bedrock. [Login pela AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html).

Para IAM Identity Center, execute `aws configure sso --profile clara-piloto`, forneça a URL/região SSO da organização e então `aws sso login --profile clara-piloto`. Para credenciais temporárias emitidas pela sua conta, configure-as localmente na CLI, incluindo o token de sessão; não as envie pelo chat nem grave no código.

Confirme a identidade e o modelo:

```powershell
aws sts get-caller-identity --profile clara-piloto
npm.cmd run bedrock:check
```

O segundo comando faz **uma invocação paga**, valida JSON e o filtro solicitado, e registra o resultado no diagnóstico local. Precisa de permissão `bedrock:InvokeModel` para o perfil de inferência e modelos subjacentes nas regiões utilizadas pelo perfil. A disponibilidade depende da conta e de suas políticas. Não é necessário liberar permissões administrativas ao aplicativo.

O SDK lê a cadeia padrão de credenciais. Após autenticar ou alterar o arquivo de configuração, reinicie o piloto. Ausência de credenciais, acesso negado, cota, timeout e resposta incompatível aparecem como erros explícitos; não existe fallback silencioso para demonstração.

Referências: [Converse com Nova 2](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-converse-api.html), [acesso a modelos Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).

## Dados e fluxo de conferência

A fonte contém 432 registros mensais: janeiro de 2025 a dezembro de 2026, três empresas e seis centros. A granularidade é empresa × centro × mês, em BRL, com valores realizados e orçamentos aditivos. Totais de referência: **realizado R$ 675.328,77**, **orçamento R$ 664.270,00**. Inclui orçamento zero, realizado zero e desvios.

1. Peça “Mostre apenas Filial Sul em setembro de 2025”. Confira a proposta antes de aplicar.
2. Peça “Troque o gráfico por barras horizontais”. Os filtros devem continuar iguais.
3. Salve o dashboard e exporte CSV; origem, revisão e período acompanham os valores.
4. Abra Planejamento, revise Pesquisa e salve uma versão.
5. Peça “Simule redução de 5% em Pesquisa”. Confira centro, empresa, datas e economia antes de salvar.
6. Encerre e inicie novamente; entre na mesma conta e reabra os registros.

Os indicadores são calculados pelo servidor em centavos. A IA interpreta pedidos e propõe alterações, sem executar SQL nem gravar automaticamente. Percentuais com orçamento zero são indefinidos. Projeção por média continua ilustrativa, sem previsão estatística.

Análises novas usam documentos v2. Documentos v1 continuam legíveis; `q3` antigo significa terceiro trimestre de todos os anos, indicado explicitamente. Orçamentos antigos de quatro posições são lidos como entradas identificadas pelos centros originais, preservando valores. Históricos não são apagados.

Planejamentos e cenários carregam o recorte e a revisão da fonte. Se a fonte mudar depois da prévia, o salvamento é recusado com conflito; atualize e confira novamente. Dashboards consultam dados atuais e avisam se a revisão mudou desde o salvamento.

## Testes e diagnóstico

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:pilot:e2e
```

O teste de navegador cria sua própria aplicação, fonte HTTP e SQLite isolados em `app/.local/pilot-browser-*`. Usa o SDK Bedrock com um servidor HTTP/2 controlado e credenciais fictícias, sem chamar a AWS. Exercita cadastro, filtros, proposta/aplicação, planejamento, cenário, CSV e reinício dos processos.

Para testar a AWS real, explicitamente:

```powershell
npm.cmd run test:bedrock:live
$env:CLARA_LIVE_BEDROCK = '1'
npm.cmd run test:pilot:e2e
Remove-Item Env:CLARA_LIVE_BEDROCK
```

Esses testes consomem tokens. A suíte de qualidade faz cinco pedidos independentes: criação, empresa/período, gráfico, cenário e esclarecimento. O teste de navegador realiza três pedidos com contexto compartilhado. Requer Chromium/Chrome/Edge detectável pelo Playwright e build atualizado. Resultados e capturas ficam em `app/test-results`; logs locais do servidor ficam junto da base isolada.

A tela **Dados**, em seus detalhes de serviços, distingue não configurado, configurado, verificado e falhou, com data da última verificação. Atualizar estado e os health checks não fazem chamadas pagas ao modelo. Configuração presente não garante credenciais/permissão válidas: somente uma chamada bem-sucedida comprova a integração.

## Planilhas e capas

Em **Dados**, importe CSV ou XLSX (até 8 MB e 20 mil linhas), confira a prévia e mapeie empresa, centro de custo, data, realizado e orçamento. Cada arquivo confirmado vira uma fonte persistente do espaço, com revisão própria, em BRL. Selecione essa fonte em Início para criar uma análise. Os arquivos não substituem a fonte financeira conectada.

Os dashboards possuem capas com o título. No cartão, use **Criar capa** ou peça uma capa no chat com o dashboard salvo aberto. Descreva a imagem, gere, confira e clique **Usar capa**. A geração usa Bedrock Stable Image Core em `us-west-2`, configurável por `BEDROCK_IMAGE_REGION` e `BEDROCK_IMAGE_MODEL_ID`, e tem custo por invocação. A aplicação envia a descrição da arte, sem os dados financeiros. `npm.cmd run banner:check` gera uma imagem de diagnóstico em `.local/banner-check.png` sem alterar dashboards.

O login local permanece apenas para testes isolados que o habilitem explicitamente. No piloto com `AUTH_MODE=msal`, sessões antigas de demonstração ou senha local não são aceitas. Os testes de navegador automatizados usam esse ambiente isolado; não comprovam o MFA do Microsoft Entra.

Para simular falhas do serviço financeiro, defina `FINANCIAL_TEST_PROFILE` no terminal antes de iniciar: `unavailable`, `unauthorized`, `invalid`, `slow` ou `normal`. O cache da fonte dura até 30 segundos. O perfil `slow` excede o timeout de leitura; os demais exercitam HTTP 503, HTTP 401 e moeda incompatível. O token local é aleatório por execução e não vai ao navegador.

## Backup e restauração

Dentro de `app`, escolha nomes novos de destino:

```powershell
node scripts/backup.mjs create .data/pilot .local/backups/pilot-2026-10-18.sqlite
node scripts/backup.mjs restore .local/backups/pilot-2026-10-18.sqlite .data/pilot-restaurado
```

Pare o piloto. Defina `PROMETEU_DATA_DIR` com o caminho absoluto da pasta restaurada e inicie novamente. A restauração mantém dados e contas, mas revoga sessões: é necessário entrar novamente. O comando não substitui pastas existentes.

## Conexão futura com SAP

O serviço de teste implementa apenas `GET /health` e `GET /odata/FinancialFacts`, com `value`, `@odata.nextLink` e `$skiptoken`. O conector SAP continua restrito a GET, paginação na mesma origem/coleção e mapeamento validado. A origem `financial-test` é distinta de `sap` em todas as respostas.

O trial básico SAC não oferece administração de integrações. Uma homologação real exigirá tenant/API habilitado, OAuth, modelo exportável, semântica e autorização de dados da organização. Nada neste piloto comprova essa integração. [Trial SAP](https://www.sap.com/products/data-cloud/cloud-analytics/trial-basic.html), [Data Export Service](https://help.sap.com/docs/SAP_ANALYTICS_CLOUD/14cac91febef464dbb1efce20e3f1613/db62fd76514b48f8b71d695360320f4a.html).
