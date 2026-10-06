# SpeedCode 0.7.0 — validação

Validado em 06/10/2026, Windows x64. Testes em fixtures/perfil isolados; nenhuma
alteração Git/worktree nos projetos reais, instalação ou inferência paga.

## Evidências

- `npm --prefix ui test`: 65 testes passaram. Default ligado; base opcional;
  preparação antes de envio/MCP, uma vez; erro preserva prompt sem fallback;
  contexto mantido ao mudar explorador; clear não remove arquivos/branches.
- `scripts/build.ps1 -Action test`: 65 Rust passaram, 9 opt-in ignorados.
  Git real: três repos, tarefas com mesma/diferente base, branches próprias,
  dirty originals/dependências preservados, links/submodules/base ausente
  recusados antes do checkout, 64 tarefas sem evicção. Mapping de anexos e
  snapshots conserva texto/hash; clear libera RAM sem apagar worktrees.
- Instruções originais herdadas e includes disponíveis somente para leitura;
  adaptador FS recusa escrita no original e aceita no grupo. Hook pré-tool
  recusa caminhos externos/ambíguos de mutadores conhecidos; Autopilot deixa
  permissões para a pessoa. MCP stdio herda cwd isolado/remapeia cwd de repo;
  argumentos absolutos/servidores remotos não são sandbox.
- Busca Rust em três worktrees: hashes/paths do grupo, exclusões compartilhadas
  de `.git/info/exclude` respeitadas; `pathPrefix` poda subárvores sem aumentar
  orçamento. Catálogo do perfil não recebe raízes temporárias quando cadastra
  outro projeto; arquivos abertos continuam salváveis após limpar o chat.
- Opt-in `installed_cli_worktree_session_without_inference`: sessão SDK real
  confirmada com dois repos isolados; MCPs pessoais desabilitados no teste,
  sem `send`. Runtime não confirmou política das ferramentas Rust automáticas:
  `rustToolsActive=false`, fallback nativo preservado. Busca manual funciona.
- Frontend e Rust release compilados. Vite mantém aviso do chunk principal
  grande; não foram aumentados limites para ocultá-lo.

## Conferência visual (computer-use)

EXE release, perfil separado, fixture com 150 endpoints, dependências ocultas e
dois stashes. Check ligado, base alternativa recolhida; busca manual preparou
uma worktree em HEAD/main. Resultados apontam para o checkout isolado; botão
Abrir worktree muda o explorador/controle de versão, não a branch original.
Fonte continuou em main, índice/working tree rastreados limpos e mesmos OIDs dos
dois stashes. Opção trava depois do preparo. Confirmação de limpar informa que
branches/worktrees permanecem; Cancelar preserva a tarefa. Fechar o app mantém
manifesto e arquivos no perfil de teste.

Duas janelas abriram no mesmo perfil; a segunda mostrou projeto original e
chat novo, sem reutilizar o estado preparado da primeira. Não foi executada
edição por LLM nas duas janelas; isolamento de tarefas com três repos foi
verificado nos testes Git/Rust. Automação teve limitação de geometria da janela
ocluída, contornada para leitura/abertura pela faixa visível; não é evidência
de teste completo de dois agentes inferindo simultaneamente.

## Desempenho medido

Intel Core i7-4790, 8 processadores lógicos. Uma janela, chat conectado sem
inferência, configurações abertas, busca concluída e worktree selecionada.
`scripts/check-performance.ps1 -ExePath dist/SpeedCode-0.7.0/SpeedCode.exe -Seconds 30`:

- Janela efetiva: 32,73 s; CPU média da máquina: 0,137% (0,3591 CPU-s).
- Pico working set agregado: 404,33 MiB; private bytes: 497,95 MiB.
- Crescimento working set: -0,32 MiB. PASS com tetos existentes: 2% CPU,
  900 MiB working set e 128 MiB crescimento.

Inclui host + descendentes WebView2/CLI/MCP encontrados pelo medidor; working
sets podem compartilhar páginas. Sem inferência/build durante coleta. Não é
soak de horas, comparação pareada com VS Code/0.6.9, garantia de todas as
máquinas/cargas ou prova de tokens/créditos poupados. Mais janelas/builds/MCPs
têm custo adicional. Não foram adicionados watchers, timers ou runtime.

## Entrega e limites

0.7.0 portátil e Setup, fora do Git em `dist/`. Nenhum commit/push/instalação
na máquina do usuário. Worktrees gerenciadas não copiam arquivos não commitados
nem node_modules; snapshots são explícitos. Preparar no início mantém paths e
contexto consistentes, mesmo em pedidos inicialmente só de análise. HEAD usa
último commit da branch atual por repo; base remota usa último Fetch. Não exige
indicar branch ou repetir worktree no prompt.

Worktree compartilha metadados Git (inclusive stashes), não é isolamento de
sistema operacional. Comandos/MCPs externos continuam exigindo revisão humana.
Não há limpeza/merge/push automático, UI de arquivar tarefas, submodules ou
links simbólicos no preparo gerenciado. Arquivos são preservados, não removidos
para caber no limite; 64 tarefas exigem revisão manual do armazenamento.
