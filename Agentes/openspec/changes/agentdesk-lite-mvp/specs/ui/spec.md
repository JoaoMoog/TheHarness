# UI — requisitos normativos

## Requisitos

- UI-01 MUST fornecer barra superior de workspace/agentes, explorer esquerdo, centro de abas/editor/diff, painel inferior de terminais/logs, painel Git e status bar.
- UI-02 MUST permitir ocultar/redimensionar painéis e suportar tema escuro, DPI 100/150/200%, teclado, foco e mensagens acionáveis.
- UI-03 MUST preservar seleção/foco enquanto status Git atualiza e representar vazio, carregando, erro, conflito e cancelamento.
- UI-04 MUST definir Ctrl+P, Ctrl+S, Ctrl+F, Ctrl+Tab, navegação de hunks, foco de terminal e foco Git; busca global só entra após decisão explícita.
- UI-05 MUST usar notificações locais não intrusivas somente para sinal confiável de término.
- UI-06 MUST não depender de webview e nunca bloquear a UI em operação de worker.

## Cenários

### UI-S01 — abertura rápida de arquivo

Given usuário pressiona Ctrl+P em workspace multirepo
When seleciona arquivo permitido
Then a UI mostra loading e abre buffer quando DiskSnapshot chega
And permanece navegável durante I/O.

### UI-S02 — atualização Git sem perda de foco

Given um arquivo ou hunk selecionado
When RepoStatus novo é aplicado
Then a seleção compatível permanece
And se a versão tornou o item obsoleto a UI explica a transição.

### UI-S03 — DPI e teclado

Given escala 150% e painel estreito
When usuário navega por atalhos definidos
Then controles focáveis continuam acessíveis
And nenhuma ação crítica depende somente de cor ou mouse.
