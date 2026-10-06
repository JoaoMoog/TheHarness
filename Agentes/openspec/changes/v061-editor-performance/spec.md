# Requisitos e aceitação

## Editor
- Shift+Alt+F e menu de contexto: formatar documento atual. Prettier sob demanda em worker descartável para TS/TSX/JS/JSX/JSON/CSS/HTML/Markdown/YAML; Ruff 0.16.10 portátil para Python; .NET SDK 6+ `format whitespace --folder` em pasta temporária isolada para C#.
- Parser inválido ou indisponível deve preservar buffer; erro compreensível. Até 512 KiB e 30 s por solicitação. Capturar versão/modelo, não sobrescrever edições concorrentes ou aba trocada. Aplicar como transação undo, sem salvar disco. Ctrl+S salva normalmente.
- Ctrl+/ alterna comentários conforme configuração de linguagem Monaco; Ctrl+K, Ctrl+C adiciona, Ctrl+K, Ctrl+U remove. Configuração de comentários é a do tokenizer, não um analisador semântico de JSX dentro de tags. Não prometer formatos onde não existe parser; reindentação básica Monaco permanece disponível.
- TS/web não inicializam workers semânticos contínuos. IntelliSense semântico/análise de tipos não são oferecidos neste perfil; sintaxe e agentes continuam.

## SCM
- Git nativo respeita .gitignore, .git/info/exclude e ignore global; check-ignore --no-index confirma também alterações de arquivos tracked que passaram a ser ignorados. node_modules em qualquer nível é excluído da projeção mesmo sem gitignore. Conflitos ignorados permanecem visíveis para não esconder resolução necessária.
- Root usa untracked normal; pastas novas expandem somente ao clicar. Máximo 2.000 registros, NUL/rename preservados; parcial sinalizado, não apresentado como completo. Máximo 200 linhas por seção/página.
- Ações individuais usam path literal; grupos precisam ser expandidos. Ações em todos têm escopo completo de até 200 arquivos elegíveis e não atingem arquivos ocultos. Lotes incompletos/volumosos são recusados. Commit recusa índice com node_modules ou ignored que estavam preparados fora da IDE; nada é removido automaticamente.
- Estado dirty real para trocar branch/merge continua usando Git completo, não projeção UI. Segurança acima de ocultação estética.

## Custo e atualização
- Atualização coalescida a cada 10 s quando visível; foco e eventos de agente antecipam refresh. Metadata (mtime/tamanho) evita leitura/hashing contínuos; conteúdo verificado por hash a cada 60 s/foco. Arquivo externo dirty vira conflito; não sobrescrever trabalho não salvo. Metadata sozinha não garante frescor absoluto entre verificações forçadas.
- Explorador compara lista antes de reconstruir, badges por Map, máximo 1.000 itens por diretório/render. Avisar truncamento e permitir Ctrl+P para localização fora da lista.
- Terminal entrega dados ativos com backpressure de xterm; idle até 500 ms e oculto até 1 s. Não abortar processos agentes/terminais existentes.

## Evidência
Testes de formatadores idempotentes, texto/strings preservados, erro sintático; Git real com ignore tracked, dependências nested, lotes parciais, rename; fixture grande e medições reais de app+WebView2. Testes sintéticos não comprovam RAM em sessões IA longas nem economia de tokens.
