# Implementação e validação

- [x] Substituir dados simulados por catálogo local carregável e persistente.
- [x] Permitir adicionar pasta pelo seletor nativo ou caminho digitado e alternar repositório.
- [x] Navegar a árvore sob demanda sem seguir links simbólicos.
- [x] Abrir/editar/salvar texto UTF-8 com limite, EOL/BOM e proteção de alteração externa.
- [x] Lançar Windows PowerShell em janela real com cwd do repositório ativo.
- [x] Remover Git, diff, métricas, terminal e agentes fictícios da interface.
- [x] Compilar release Windows e atualizar pacote portátil com dependências de runtime (`dist/AgentDeskLite`, incluindo `libunwind.dll`).
- [x] Rodar `cargo fmt --check`, testes unitários (3/3) e verificar imports do executável (`llvm-readobj`; dependência local `libunwind.dll`).
- [x] Abrir a versão publicada; testar cadastro e troca AgentDeskLite/JTK, abrir arquivo real, editar/salvar e conferir bytes em disco; confirmar pelo status e processo filho `powershell.exe -NoLogo -NoExit` que o botão inicia o terminal, com `current_dir` configurado para a raiz ativa.
- [x] Confirmar estado final e limitações ao usuário; a proposta maior `agentdesk-lite-mvp` continua incompleta.

Validação manual em 2026-09-23. O arquivo temporário da prova de salvamento foi removido após a leitura de confirmação; o catálogo local agora mantém AgentDeskLite e JTK para facilitar o teste de troca.
