# Spec detalhada — bancada agêntica 0.2

## Resultado esperado
O usuário abre uma pasta, expande seus diretórios, edita arquivos em abas, acompanha mudanças Git próprias ou feitas por CLIs, revisa diferenças e usa múltiplos agentes em terminais integrados. O título, ícone, hierarquia visual, estados vazios e mensagens devem deixar cada ação compreensível.

## Interface
1. Ícone próprio em SVG, PNG e ICO, incorporado no executável e na janela.
2. Barra de atividades: Explorador, Git, sessões. Sidebar única com seletor de repositório, botão abrir pasta e árvore expansível, indentação, ícones de pasta/arquivo/linguagem e badges de mudanças.
3. Abas com nome, caminho em tooltip, estado sujo e fechar; breadcrumb do arquivo. Editor com números de linha, realce, undo/redo, indentação, Ctrl+S, Ctrl+F e busca de arquivos Ctrl+P.
4. Painel inferior redimensionável com abas de sessões, perfil, diretório, estado real, botão nova sessão, dividir e encerrar. Seleção não deve destruir outras sessões.
5. Área Git: branch e upstream, grupos preparados/não preparados/não rastreados/conflitos, ações por arquivo, mensagem de commit, fetch/pull/push, output e falhas. Diff identifica index→worktree ou HEAD→index.
6. Tema escuro consistente, contrastes legíveis, foco por teclado, botões com títulos/rótulos. Layout utilizável a partir de 1000×700.

## Workspace e arquivos
- Catálogo anterior é migrado/lido sem perder caminhos; persistência local em LOCALAPPDATA/AgentDeskLite.
- Raízes precisam existir; caminhos relativos não podem escapar da raiz. Reparse points/symlinks são recusados na navegação e escrita desta versão.
- Árvore carregada sob demanda. Ocultar .git, node_modules e artefatos por padrão; filtro configurável para mostrar gerados. Não percorrer toda árvore no boot.
- Abrir UTF-8, com/sem BOM, até 4 MiB; recusar binários e encoding inválido com mensagem. Preservar EOL e BOM. Abas de workspaces diferentes têm identidade separada.
- Salvar verifica SHA-256 da versão lida. Se o arquivo foi alterado externamente, impedir sobrescrita e oferecer recarregar ou manter o buffer. Manter o buffer não elimina a verificação seguinte.
- Arquivo limpo alterado externamente é recarregado; buffer sujo recebe aviso e preserva conteúdo. Repositório e Git atualizam por ação, foco e reconciliação periódica coalescida.
- Criar arquivo/pasta por caminho relativo explícito; não sobrescrever existentes. Renomear exige destino ausente. Exclusão de arquivos não é requisito desta entrega.

## Git
- Invocar Git instalado com argumentos separados, `--literal-pathspecs`, cwd explícito e GIT_TERMINAL_PROMPT=0 nas ações da GUI. Autenticação interativa pode ser feita no terminal integrado.
- `status --porcelain=v1 -z --branch`; preservar espaços, Unicode e rename, distinguir index/worktree. Pasta sem Git apresenta ação informativa, sem branch falsa.
- Diff de worktree compara index com disco; diff preparado compara HEAD com index; arquivo novo compara vazio com disco/index. Deleção usa destino vazio. Binário/tamanho excessivo recebe mensagem.
- Agentes que gravam no disco aparecem após refresh automático (alvo até 4 s em repo pequeno), mesmo sem ação no editor.
- Stage/unstage por arquivo e stage geral; commit apenas com mensagem não vazia e staged real. Sem commits vazios automáticos.
- Fetch, pull --ff-only e push sem force. Operações serializadas; erros, rejeições, conflitos e falta de upstream permanecem visíveis. Operações remotas exigem clique explícito; não rodar no boot.
- Renames fazem stage de origem e destino. Conflitos são marcados e podem ser editados manualmente; nenhuma resolução automática.

## Terminais e agentes
- ConPTY real com PowerShell interativo dentro do xterm. Nenhum Start-Process de console externo no fluxo normal.
- Até 8 sessões; cada uma captura raiz no momento da criação. Trocar workspace não muda cwd de sessões existentes. Rótulo informa perfil e repo.
- Perfis: PowerShell, Copilot CLI, Kiro CLI. Os perfis de agente iniciam PowerShell com o executável descoberto e argumentos fixos documentados; é possível também digitar o comando manualmente.
- Consultar PATH atual de usuário/máquina e caminhos conhecidos. Diagnóstico mostra presença e caminho; ausência gera orientação e mantém PowerShell disponível.
- Input e output em bytes, UTF-8 sem corrupção entre blocos. Ctrl+C, setas, sequências ANSI, tela alternativa, colagem e resize são entregues ao PTY.
- Output usa canal limitado; UI confirma consumo após xterm.write. Scrollback limitado a 5.000 linhas. Não guardar prompts/saídas em logs por padrão.
- Estado real: iniciando, executando, encerrado com código ou erro. Não inferir conclusão de tarefas de texto do CLI.
- Encerramento de sessão e fechamento da IDE com trabalho aberto oferecem confirmação. Sessões não possuem reconexão após encerrar a IDE.

## Arquitetura e fronteiras
`ui/` contém frontend local; `src/desktop.rs` janela/IPC; `src/backend.rs` arquivos/catálogo/Git; `src/terminal.rs` PTY. Mensagens possuem id, método e parâmetros JSON; respostas têm resultado ou erro. Nenhuma eval de conteúdo de arquivos. Texto de paths/erros usa textContent. Navegação remota no WebView é bloqueada. IPC aceita apenas origem local da aplicação. Serviços validam raiz no backend, não só na UI.

## Aceitação e evidências
1. Build release Windows reproduzível, frontend empacotado, ícone incorporado e dependências presentes.
2. Abrir dois repos, expandir pastas, editar/salvar/reabrir e preservar EOL/BOM; teste de conflito externo/travessia.
3. Repositório Git descartável real: novo/modificado/deletado/renomeado, diff antes/depois, stage/unstage e commit.
4. Remoto bare local: push e pull --ff-only entre duas cópias, com branch/upstream e rejeições informadas. Nenhum push para remotos pessoais para testar.
5. PowerShell via ConPTY executa comando de prova, mostra cwd, aceita input, resize e Ctrl+C. Duas sessões isoladas; fechamento encerra o recurso.
6. Descoberta e `--version` dos executáveis Copilot/Kiro instalados. Fluxos de conta e tarefas pagas dependem da interação do usuário e não podem ser declarados comprovados por teste de versão.
7. Inspeção visual desktop da árvore, abas, diff e terminal; captura sem credenciais. Resultados de testes e limitações em VALIDATION.md.

## Limites explícitos
Entrega dos fluxos acima, sem afirmar compatibilidade total com VS Code. Marketplace, extensões, debugger/DAP, LSP de todas as linguagens, remote SSH/devcontainers, merge editor de três vias, colaboração e instalador MSI ficam em evolução separada. Monaco oferece editor e diff, não o produto VS Code inteiro. Metas de memória/performance serão medidas, não presumidas.
