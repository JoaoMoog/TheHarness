# Validação 0.6.2 — 2026-10-04

## Estado

Proteções implementadas e build release concluída. A meta de repouso não foi
atingida em todas as amostras com diff aberto: não declarar desempenho totalmente
validado nem estabilidade por horas. Os tetos do gate não foram aumentados.

Pacote de teste: `dist/AgentDeskLite-0.6.2/AgentDeskLite.exe`, 41.850.880 bytes,
SHA256 final `28C63018B22A1D194A07FAC01250160CFA6935EB2F575687741E6073BC8481D4`.
Inclui WebView2Loader.dll, libunwind.dll, Ruff 0.16.10 e licença.

## Testes e build

- JS: 39 testes passaram; nenhum falhou. Incluem checkpoint sem cópia de texto,
  orçamento agregado, scheduler coalescido/oculto, apresentação longa de chat,
  polling vazio/oculto e consumo que espera drenar backlog.
- Rust: 51 testes passaram; nenhum falhou; 8 opt-in ignorados. Incluem limites
  IPC/diff/imagens/filas e transporte MCP stdio/JSON HTTP/SSE. Fixture MCP retorna
  2 MiB, inclusive HTTP chunked sem Content-Length: erro explícito e uma chamada,
  sem retry iniciado pelo app. Processos de fixture são encerrados.
- Benchmark SCM opt-in executado separadamente: passou. Coleta antiga enumerou
  44.105 caminhos, 1.922.663 bytes stdout, 239 ms. Projeção limitada devolveu 6
  entradas, 624 bytes JSON, 155 ms. Amostra única, formatos diferentes; não é
  p95 nem economia de tokens/financeira.
- Frontend e release Rust compilados; `git diff --check` passou. Vite mantém
  aviso de chunk principal ~4,49 MB: não é erro, mas há espaço para code splitting.
- Não executamos prompts pagos, autorização GitHub, push, deploy ou descarte.
  O teste .NET completo e inferências continuam opt-in, não foram simulados como
  validação real.

## Interface e medidas reais

Perfil isolado `.validation/v062-profile`, fixture `.validation/v061-large`:
42.000 arquivos node_modules, 2.100 arquivos novos e cinco amostras/ignore.
Git exibe seis entradas; dependências não são enumeradas; pasta nova é agrupada.
Editor TypeScript abriu; comentar e undo foram verificados sem salvar. Diff abriu
em duas colunas. Nenhum repositório pessoal nem contexto de agente foi modificado.
A instância 0.6.1 já aberta pelo usuário foi preservada.

Hardware: Intel i7-4790, 4 núcleos/8 processadores lógicos. Medidor inclui host e
descendentes WebView2. CPU normalizada pelo total de processadores; working sets
podem contar páginas compartilhadas. Meta controlada: CPU média ≤2%, pico working
set ≤900 MiB, crescimento ≤128 MiB. Sem CLI/chat inferindo, browser ou formatador.

### Amostras durante investigação, antes da alteração final de entrada/WebView2

| Cenário | Janela observada | CPU máquina | Pico WS MiB | Gate |
| --- | ---: | ---: | ---: | --- |
| Inicial, sem buffer | 15,87 s | 0,160% | 457,45 | Passou |
| TS após comentar/undo | 17,36 s | 1,845% | 458,01 | Passou |
| Diff aberto | 15,64 s | 2,148% | 469,31 | Falhou CPU |
| Minimizado | 15,82 s | 0,025% | 473,72 | Passou |
| Restaurado, editor/Git | 32,43 s | 2,752% | 473,12 | Falhou CPU |
| Foco no botão Git | 15,60 s | 2,153% | 464,33 | Falhou CPU |

### Release final: textarea Monaco e target Low do WebView2 ao perder foco

| Cenário | Janela observada | CPU máquina | Pico WS MiB | Crescimento MiB | Gate |
| --- | ---: | ---: | ---: | ---: | --- |
| TS aberto, primeira sessão de teste | 17,19 s | 1,897% | 421,34 | 0,35 | Passou |
| Diff, primeira sessão | 32,51 s | 2,493% | 438,31 | -3,05 | Falhou CPU |
| Minimizado, primeira sessão | 15,63 s | 0,087% | 351,89 | -1,02 | Passou |
| Novo processo sem buffer, ativado durante amostra | 32,46 s | 1,095% | 449,94 | -86,83 | Passou |
| TS aberto, novo processo, captura apenas visual | 15,80 s | 1,595% | 402,38 | -1,84 | Passou |
| Diff, novo processo, captura apenas visual | 32,35 s | 1,926% | 423,41 | -2,47 | Passou |
| Mesmo diff, amostra longa | 65,94 s | 2,201% | 432,17 | -0,29 | Falhou CPU |

Na amostra curta de discriminação com diff, a maior parcela de CPU estava no
processo principal WebView2 e no host; renderer quase sem atividade. Portanto não
é correto atribuir todo o residual ao JavaScript/Monaco. A consulta de UI Automation,
startup, foco e outros processos podem afetar as medições; não há controle A/B
suficiente para afirmar causa única ou atribuir economia ao EditContext.
Mesmo sem consultar a árvore de acessibilidade, a amostra longa excedeu a meta:
UI Automation não explica sozinha o custo residual.

### Isolamento do runtime

Compilamos `examples/webview-idle.rs` em release: mesma pilha Tao/Wry, tamanho de
janela 1440×900, HTML mínimo sem JavaScript, sem workbench/editor/Git/chat/IPC,
perfil temporário exclusivo por PID. Nenhuma flag desativa GPU ou acessibilidade.

- WebView2 mínima, primeira amostra: 32,60 s, CPU 0,899%, pico WS 362,20 MiB,
  privado 152,67 MiB, crescimento 22,76 MiB; gate passou.
- WebView2 mínima, após startup: 32,37 s, CPU 1,146%, pico WS 356,52 MiB,
  privado 149,34 MiB, crescimento -0,22 MiB; gate passou.
- Janela nativa sem WebView2 (captura HID padrão do Tao): 15,49 s, CPU 0,580%,
  pico WS 18,15 MiB, privado 3 MiB, crescimento 0,01 MiB; gate passou.

Há custo mensurável sem as funcionalidades da IDE, mas isso não atribui toda a
diferença ao runtime nem comprova um bug do WebView2. Seguiu-se o isolamento com
conteúdo simples recomendado na [documentação Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance).
Não foram alterados runtime, drivers, Windows ou configuração de segurança.
Após esses ensaios, desabilitamos DeviceEvent/HID bruto no host (o aplicativo
não consome esses eventos). Mouse/teclado normais da janela/WebView permanecem.
O probe tem `--raw-events` para reproduzir a captura anterior; isso não prova
que HID era a causa única. As amostras acima precedem esse último ajuste.
- Probe nativo sem captura HID, após ajuste: 16,45 s, CPU 0,439%, pico WS
  18,04 MiB, privado 2,89 MiB, crescimento zero. Uma amostra não comprova ganho
  causal ou fixação de CPU; o trabalho dispensável foi retirado independentemente disso.
- Workbench final sem captura HID, mesmo diff aberto: 65,83 s, CPU 2,127%,
  pico WS 253,59 MiB, privado 325,51 MiB, crescimento 0,63 MiB. **Gate falhou CPU**;
  memória passou. A variação de working set/target Low não prova menor memória
  comprometida: comparar também privado. Não atribuir toda a mudança ao filtro HID.

O pacote final continua sendo build de validação. O último ajuste foi compilado
em release e retestado: 51 testes Rust passaram, 8 opt-in ignorados, nenhum falhou.
Na interface final, clicar abriu arquivos/Git/diff; Ctrl+/ comentou TypeScript e
Ctrl+Z restaurou o buffer original, sem salvar. A leitura em disco confirmou que
a amostra permaneceu original. Todas as janelas de teste/probe foram encerradas;
a instância 0.6.1 do usuário continuou aberta.

## Limites e próximo aceite

Os limites transversais estão em `docs/PERFORMANCE.md` e as instruções futuras em
`AGENTS.md`. Erros de excesso preservam arquivos/contexto; não cortamos o harness
oficial para satisfazer cotas visuais. MCP interno/herdado do CLI, inferência,
builds, sites e programas arbitrários do terminal têm custo próprio.

Pendente: reproduzir/profilar CPU residual de foreground/diff até atingir a meta
de modo consistente, medir múltiplos CLIs/MCP e executar soak por horas. A redução
do screenshot de ~2,7 GB para estas amostras não é comparação equivalente. Não
comprova ausência de leak, superioridade ao VS Code ou economia de créditos.
