# Prompt de implementação — AgentDesk Lite 0.2

Transforme o AgentDesk Lite em uma bancada desktop leve para desenvolvimento com múltiplos agentes de CLI. Leia a investigação e a spec desta mudança antes de implementar. Preserve arquivos e configurações existentes. Entregue código, pacote Windows executável, ícone próprio, instruções e evidências reproduzíveis.

Implemente explorador hierárquico expansível com ícones por tipo, seleção de workspace persistente, abas de editor com realce de sintaxe, busca, atalhos e proteção de alterações não salvas. Integre Git real: status de index e worktree, mudanças externas feitas por agentes, diff lado a lado com fontes nomeadas, stage/unstage, commit com mensagem, fetch, pull fast-forward e push normal. Mostre erros e conflitos sem ocultá-los.

Substitua o lançamento externo por terminais PowerShell integrados usando ConPTY e um renderizador VT/ANSI completo. Permita várias sessões, abas, divisão visual, resize, Ctrl+C, colagem e encerramento. Ofereça perfis PowerShell, Copilot CLI e Kiro CLI. Descubra os executáveis reais, atualize o PATH herdado do Windows e preserve os prompts de autenticação/permissão dos CLIs. Não trate saída textual como prova de tarefa concluída.

Use Rust para filesystem, Git, processos e persistência. Use WebView2 do sistema com Monaco e xterm.js empacotados localmente. Nenhum CDN ou servidor HTTP público. Separe UI, serviço de arquivos, serviço Git e PTY. Mantenha filas/scrollback limitados e I/O fora da thread da janela. Gere ícone vetorial e recursos Windows do executável.

Valide com repositórios Git reais descartáveis, incluindo um remoto bare local, sem publicar mudanças em remotos pessoais. Teste mudança externa, diff, staging, commit, pull/push local, conflito de salvamento, travessia e terminais reais. Verifique as versões dos CLIs instalados sem iniciar tarefas pagas ou alterar seus repositórios. Documente o que passou e o que continuar pendente. Não anuncie paridade completa com VS Code: extensões, LSP e debugger exigem implementação e validação próprias.
