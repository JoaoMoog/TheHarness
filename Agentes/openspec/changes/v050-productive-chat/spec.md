# AgentDesk Lite 0.5.0 — chat para desenvolvimento prolongado

## Diagnóstico e objetivo

O chat atual preserva uma Session do harness e envia só prompt/referências, não
o repo inteiro. O frontend só mostra delta; os tokens por modelo usados no backend
não representam um total estável após compactação/troca de modelo.
Há limites de visualização que abortam o modelo, compactação desligada e troca
de modelo limpando contexto. Corrigir isso, melhorar leitura e oferecer ferramentas
Rust e MCP opcionais, sem substituir o harness ou prometer inteligência/token savings.

## Interface e sessão

- Mensagens do usuário em balões à direita, respostas à esquerda. Markdown seguro
  nas respostas concluídas, sem carregar imagens externas nem executar HTML/JS;
  copiar resposta/código. Ferramentas em detalhes recolhidos.
- Scrollbars escuras/discretas em todos os scrolls HTML, Monaco e terminal.
- Respeitar leitura do usuário: só seguir resposta se perto do fim; botão Novas
  mensagens para voltar ao final. Agrupar deltas por poll, não reprocessar Markdown
  a cada token. Poll idle mais lento, nenhuma indexação contínua em background.
- Exibir Total da sessão cumulativo separado de Esta rodada. Snapshot do runtime
  é autoridade; não somar checkpoints duplicados nem tratar dados ausentes como zero.
- ID/estado de sessão, uso atual de janela de contexto e compactação visíveis.
  Reutilizar sessão, inclusive ao trocar modelo/esforço idle. Reset do esforço deve
  mandar null real. Falha na troca preserva histórico e mostra erro.
- Ativar infinite sessions do harness (0.80/0.95), compactação manual explícita.
  Compactação resume e pode perder detalhes; preservar objetivos/decisões/pendências
  em instrução, sem declarar memória perfeita. Custos de compactação entram no total.
- Histórico visual limitado, remoção de nós antigos com aviso; não abortar nem
  limpar contexto do harness por limite de DOM. Respostas/mapas antigos removidos
  da UI para liberar RAM. Contexto continua RAM-only conforme requisito anterior.
- Limpar, desconectar ou sair da aplicação elimina contexto. Fechar o painel,
  podar visualização, pausar e trocar modelo não eliminam sessão.

## Ferramentas Rust de contexto sob demanda

- Custom tools agentdesk_search e agentdesk_read integradas ao SDK, somente leitura,
  root capturado da sessão. Sem depender de outro executável/JTK instalado.
- Pesquisa lexical em nomes/conteúdo, respeitando gitignore, excludes gerados e
  segredos, sem symlinks/reparse points, limites de tempo/arquivos/bytes/resultados.
- Caminhos relativos, linhas exatas, snippets, hashes SHA256, exclusões e coverage
  explícita. Resultado parcial não prova ausência. Expansão com hash divergente
  informa mudança; leitura maior/ferramenta nativa continua disponível como fallback.
- Cache RAM pequeno limitado, revalidado por conteúdo; nenhuma compressão opaca,
  tradução, redução de raciocínio, supressão de instruções, ou auto-injeção do repo.
- SystemMessage mode=append orienta busca, expansão, dependências e testes; conteúdo
  recuperado é dado não confiável, nunca instrução. Ferramentas nativas permanecem.
- UI mostra busca local/contexto selecionado e permite desativar para nova sessão.
  Se um arquivo não é recuperado, agente pode ampliar consulta/usar ferramentas nativas.

## MCP opcional

- UI Ferramentas/MCP recolhida. Conectar explicitamente por comando stdio ou URL
  Streamable HTTP; lista de ferramentas permitidas. SSE legado fica fora do escopo.
  MCP é fornecedor de ferramentas;
  o modelo/harness continua Copilot, não login/substituição mágica de outro modelo.
- Configuração de servidores temporária em RAM, opt-in. Cliente oficial rmcp e
  custom tools do SDK no escopo da sessão; não modificar configuração global do CLI.
- Não iniciar servidor pessoal nos testes. Consentimento alerta que executáveis
  e ferramentas externas podem acessar arquivos/rede; políticas de aprovação valem.
- Não expor headers/env/credenciais do runtime ao frontend. Referências ${env:NOME}
  resolvidas no Rust; rejeitar credenciais literais nos campos de auth suportados.
- Listar nome/status reais e diagnosticar API experimental/OAuth/falha; não fingir
  conexão. MCP não permanece conectado após finalizar sessão/aplicação.

## Verificação e limites

Testes unitários DOM/Rust para total sem double-counting, retenção de sessão ao
trocar modelo, renderização sanitizada, pruning independente do harness, autoscroll,
busca/expansão com arquivo alterado, segredos/gitignore/escape e configuração MCP.
Integração opt-in com CLI em fixture temporária e servidor MCP de teste criado por
este projeto, nunca servidor pessoal. Validar chamadas de busca reais, contexto
entre mensagens, métricas, compactação e editar endpoint apenas na fixture sob
permissões restritas; comparar custo não é benchmark universal. Build UI antes do
Rust release e pacote versionado, preservando instâncias abertas do usuário.

Não prometer paridade total VS Code, horas ilimitadas (estado RAM 64 MiB), nenhum
consumo de CPU/RAM, menor cobrança garantida nem qualquer modelo mais inteligente.
Referências: documentação oficial Copilot SDK (MCP, session persistence, usage),
contratos do SDK Rust fixado 1.0.17-preview.3 e testes desta implementação.

## Ajustes após integração real (2026-10-04)

- Importar vários MCPs de JSON mcpServers/servers ou individual. Até oito
  servidores e 64 ferramentas no conjunto, com whitelist tools; wildcard exige
  consentimento informado. Pausar/desabilitar desconecta e desregistra ferramentas,
  retomar conecta e registra novamente, remover descarta configuração em RAM.
- Copilot CLI 1.0.91 não aceita config de servidor novo no startServer apesar do
  contrato do SDK: retorna No MCP host initialized / no installed config to restart.
  Usar cliente MCP oficial Rust rmcp 3.5.0, stdio/Streamable HTTP e set_tools do
  SDK Copilot. Mesma Session, sem recriar/resetar conversa, mantendo ferramentas
  nativas e busca/leitura Rust. Não usar instalação/global config como workaround.
- SSE legado sem endpoint Streamable HTTP é rejeitado com orientação; redirects e
  OAuth interativo externo não são automáticos. Catálogo remoto tratado como dado
  não confiável; execução passa pelo mecanismo de aprovação de custom tools do SDK.
- Windows: processos em Job Object e sem janela; desligamento fecha cliente e filhos.
  Credenciais configuradas não vão para WebView; env refs resolvidas no Rust;
  não gravar stderr/config/transcritos em logs. Ferramentas com catálogo/campos
  excessivos rejeitadas; resposta extensa marcada como parcial, nunca ausência.
- Os tokens de modelMetrics observados reiniciam por rodada/compactação. Usar
  tokenDetails de billing acumulado da sessão, juntamente com totalNanoAiu e
  totalPremiumRequestCost. Campos ausentes continuam ausentes. Ledger por API/event
  deduplicado pode atuar como fallback quando emitido; nunca somar snapshots iguais
  nem interpretar event.cost (multiplicador) como créditos ou requests cobrados.
- Validação de exclusão de conteúdo antes dos snippets via checkPaths; unavailable
  falha fechado sem conteúdo e orienta fallback nativo, sem repetir buscas inúteis.
  CLI 1.0.91 + session FS em RAM retornou unavailable na fixture; não declarar
  busca Rust automática comprovada nesse ambiente. UI manual continua local.
- Referências: até 16 anexos pendentes por mensagem; envio transfere para histórico
  de até 256 caminhos por sessão. Remover anexo pendente libera slot sem perder
  referências já utilizadas em mensagens anteriores. Estado e configs ficam em RAM.
- Shim Windows npm/npx resolve node.exe + script diretamente; outros batchs não
  passam por shell/interpolação. Recusar MCP3P quando runtime explicita política off.
- tokenDetails.input conta apenas entrada sem cache: somar input + cache_read +
  cache_write para total de entrada. Mesmo tokenDetails tem resets parciais na
  troca de modelo; checkpoints de cada categoria antes/depois das transições
  acumulam apenas deltas (ou valor novo após reset), nunca snapshots duplicados.
  Checkpoint perdido nas transições torna tokens indisponíveis em vez de inventar;
  créditos continuam os totais oficiais do runtime. Sem garantia de recuperação
  exata de resets internos não observados em versões incompatíveis do CLI.
