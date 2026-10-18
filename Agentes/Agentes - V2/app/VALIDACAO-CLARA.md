# Validação local da CLARA

## Evolução funcional — 11/10/2026

Implementados atualização e histórico de fontes; edição, duplicação e restauração de dashboards; fórmulas aritméticas por registro, vários indicadores, multisseleção e comparação entre períodos; explicação das mudanças e exceções de orçamento; qualidade da fonte; relatório executivo e apresentação HTML revisáveis; contas locais, rascunhos na conta e recuperação explícita; espaços de equipe com papéis, convites, revogação e auditoria; backup/restauração, readiness e métricas; conector SAP JSON/OData somente leitura. IA real adiada pelo usuário.

| Verificação final | Resultado |
| --- | --- |
| Testes de lógica/API | 68 passaram |
| TypeScript e build de produção | Passaram após a última alteração |
| Volume | Importação, agregação, persistência e isolamento com 20 mil registros |
| Privacidade | Conversas privadas por pessoa no espaço, inclusive diante de administradores; fontes e relatórios compartilhados conforme papel |
| Recuperação | Rede indisponível, conflito entre abas, expiração explícita e operação idempotente |
| Operação | Backup consistente com WAL, restauração, corrupção recusada, sessões revogadas, readiness e SAP simulado |

Os testes de navegador exercitaram 20 cenários distintos sobre build de produção. A última execução completa passou em 19 cenários; o cenário de retomada entre navegadores foi reexecutado e passou após abrir explicitamente o assistente que havia sido preservado recolhido. Após a correção final de privacidade, os três cenários novos de evolução passaram novamente sobre o build final. A exportação foi verificada no iframe isolado e em seu HTML, com axe sem violações nos estados exercitados. Foram capturados desktop de 1440px e celular de 390px, conferida ausência de overflow, além dos cenários anteriores de teclado, foco e 320px.

Evidências: `.local/evolution-review/`, incluindo `report-preview-visible.png`. Uma captura de página inteira não pintou o conteúdo de um iframe fora da área visível; a captura da área visível e a asserção dentro do frame confirmaram sua renderização. O isolamento do iframe foi mantido; o teste axe verifica separadamente seu documento porque a injeção entre frames é bloqueada pelo sandbox. A revisão visual teve um lote de inspeção e uma confirmação, preservando a identidade CLARA.

As bases de navegador ficam em `.local/daily-e2e-*`, separadas dos dados de uso. O runner encerrou seus servidores ao terminar. Nenhuma credencial empresarial foi usada, nenhuma integração externa foi acionada e não houve publicação.

Limites atuais: relatório/PDF usa impressão do navegador e a apresentação é HTML, sem PPTX. O SAP da empresa e Microsoft exigem configuração e validação em ambiente autorizado; o adaptador SAP foi testado com respostas simuladas. Métricas têm janela limitada por processo; backup é um comando, sem agenda externa instalada. Rascunhos são recuperáveis na conta deste servidor, sem sincronização com outro servidor. Sem rede, a cópia local preserva ajustes e oferece nova tentativa; conflitos não sobrescrevem a versão da conta. Conversas mantêm expiração de 30 minutos, com recuperação explícita após conferir fonte e plano. Não houve sessão humana com leitor de tela. O detector Impeccable continua indisponível.

## Rodada de continuidade — 11/10/2026

Registro histórico da primeira entrega: implementadas as cinco melhorias aprovadas, com retomada na sessão da aba, conferência da importação, tabela equivalente por gráfico, recuperação específica por operação e contexto/restauração do recorte salvo. Identidade CLARA e APIs públicas preservadas; sem migração de banco nesta primeira entrega. As ideias da evolução seguinte foram incluídas na evolução funcional registrada acima.

| Verificação atual | Resultado |
| --- | --- |
| Testes de lógica/backend e sessão | 35 passaram |
| Typecheck | Passou; também incluído no build final |
| Build de produção | Passou após o último ajuste |
| Suíte completa de navegador | 15 passaram |
| Casos adicionais | Expiração com página aberta e fonte removida passaram; retomada reexecutada passou |
| Capturas | Desktop 1440px e celular 390px: retomada, importação e valores dos gráficos |
| Responsividade e acessibilidade | Sem overflow a 320, 390 e 1440px no cenário novo de gráficos; axe sem violações nos estados exercitados, além dos cenários existentes |

Os 17 cenários distintos de navegador cobrem os sete fluxos anteriores e dez novos: navegação/recarga com texto e filtros, descarte cancelado, expiração na restauração e durante uso, mudança de revisão, fonte removida, isolamento de conta, recuperação após importação e salvamento, valores temporais/comparativos sem tabela geral e restauração do recorte salvo. Os novos testes também verificam ausência de erros JavaScript da página. Não houve sessão humana com leitor de tela.

Evidências atuais: [.local/daily-review](.local/daily-review/). Inspeção visual realizada em um lote desktop/celular; corrigido um espaço entre frases na introdução móvel e confirmada a nova captura. As capturas de gráficos usam dados de teste de dois anos e mostram as duas séries na tabela correspondente.

Execução local Windows/Chrome sobre build de produção, com `AUTH_MODE=demo`, `AI_PROVIDER=demo`, servidor `127.0.0.1:3112` e bases separadas em `.local/daily-e2e-*`. Build e navegador precisaram executar fora do isolamento restrito para permitir os processos locais; a revisão automática autorizou essas execuções. O runner encerrou o servidor ao final de cada rodada. Não houve publicação externa nem uso de integrações reais.

Limites: a retomada é por conta na sessão da aba, não entre dispositivos. Quando o armazenamento do navegador está indisponível, a navegação interna preserva o trabalho em memória, mas recarregar não tem essa garantia. O servidor continua validando propriedade, revisão, plano e expiração. Detector do Impeccable segue indisponível; a validação atual usa testes, Chrome e capturas.

## Rodada visual anterior — 10/10/2026

Data: 10/10/2026. Ambiente: Windows, aplicação Next.js local, Chrome instalado, `AUTH_MODE=demo` e `AI_PROVIDER=demo`. Testes de navegador apontaram para `http://127.0.0.1:3100` com `PROMETEU_DATA_DIR` isolado em `.local/clara-review-data`. A prévia de demonstração da sessão usa outra base, `.local/clara-preview-data`.

## Resultados executados

| Verificação | Resultado |
| --- | --- |
| `npm.cmd test` | 32 testes passaram |
| `npm.cmd run typecheck` | Passou |
| `npm.cmd run build` | Passou após a última alteração de código |
| `npm.cmd run test:e2e` | 7 testes passaram: 4 jornadas de negócio e 3 de workspace |
| Capturas e inspeção responsiva | 16 PNGs; sem erros de página ou overflow do documento nas larguras verificadas |

Jornada exercitada: importar → perguntar → esclarecer → conferir prévia → filtrar → refinar → salvar → reabrir → exportar. Verificados cancelamento, erro/nova tentativa, texto e pedido em andamento ao recolher o assistente, preservação de filtros, foco ao abrir/fechar modais, Escape, teclado nos menus e seletor dentro do diálogo. A consulta/exportação respeita o recorte atual; outra análise preserva o dashboard salvo.

Os testes axe com tags WCAG 2 A/AA e 2.1 AA não encontraram violações nos estados exercitados. Redução de movimento foi verificada. Isso não representa auditoria completa de acessibilidade nem sessão humana com leitor de tela.

## Evidências visuais

[checks.json](.impeccable/review/clara/checks.json) registra `errors: []` e `overflow: false` para 1440, 1920, 1024, 768, 390 e 320px. As [capturas](.impeccable/review/clara/) abrangem login, visão geral, dashboards, fontes, importação, assistente, prévia, seletor, navegação e integrações. Após a revisão, “Prévia para conferir” foi colocado junto de “Salvar dashboard”; build e capturas foram atualizados. O revisor independente confirmou esse ajuste sem regressão visível; seu parecer final de liberação se limita à correção pontual.

## Reproduzir

O [README](README.md#testes-de-navegador-no-windows) contém os comandos para iniciar uma base demonstrativa isolada e rodar `npm.cmd run test:e2e`. O runner é `node tests/run-e2e.mjs`, com cache local `.local/playwright-cache`. Chrome/Edge são detectados no Windows; `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permite escolher outro executável.

Para renovar as capturas, use `node tests/capture-clara.mjs` com o servidor demo ativo e `PLAYWRIGHT_BASE_URL` definido. No Windows, esse script de captura exige `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para usar o navegador instalado; sem a variável, tenta o navegador gerenciado pelo Playwright. Ele grava na pasta de evidências acima e opera sobre os dados demonstrativos.

## Limites

- Microsoft MSAL, SAP e AWS Bedrock externos não foram testados com serviços reais. Bedrock mantém testes com respostas simuladas; SAP permanece demonstrativo.
- APIs, cálculo, dados e identificadores técnicos existentes foram preservados. Não houve migração de banco nem publicação externa.
- O contexto/detector local do Impeccable não ficou disponível: o engine não estava instalado e a gravação do instalador fora do workspace foi bloqueada. A verificação usou código, navegador, capturas e revisão manual; não há resultado de detector automático a declarar.
- Este registro complementa [VALIDACAO.md](VALIDACAO.md) e `../VALIDACAO-LOCAL.md`, que permanecem históricos.
