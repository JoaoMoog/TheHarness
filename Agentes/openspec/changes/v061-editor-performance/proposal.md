# 0.6.1 — Editor útil e Git com custo limitado

## Problema e evidências
O teste do usuário mostra 42.620 alterações (dependências incluídas), erro de saída Git acima de 8 MiB e renderer WebView2 perto de 2,7 GB. O código expandia untracked=all, construía uma linha DOM por alteração, fazia busca linear de status para cada entrada do explorador, relia todos os buffers e reconstruía árvore a cada 3 s. Monaco importava serviços TypeScript/JavaScript e seus workers completos. Essas são causas identificadas no código, não um perfil causal completo de toda a memória do processo.

## Plano em ordem
1. Separar projeção SCM limitada da verdade Git usada para decisões destrutivas.
2. Excluir dependências por pathspec, respeitar ignore nativo, agrupar pastas novas; limitar JSON antes de alocar e paginar DOM.
3. Tornar ações em lote explicitamente elegíveis e completas; impedir commit de arquivos escondidos que já estavam staged. Não modificar gitignore, índice ou arquivos de terceiros automaticamente.
4. Remover serviços semânticos contínuos do perfil leve; manter sintaxe, diff, undo, localizar e comentários.
5. Formatar sob demanda com parser por linguagem, buffer versionado e undo. Sem executar configs/scripts do projeto.
6. Comparar metadata antes de ler conteúdo, hash forçado periódico/foco, coalescer refresh e não reconstruir UI sem mudança; adaptar polling de terminal.
7. Validar fixtures reais, gerar release portátil, medir árvore de processos. Não prometer economia versus VS Code sem cenário comparável.

## Fora do escopo
Não trocar modelos, reduzir raciocínio ou alterar o harness Copilot/MCP. Não instalar LSP permanente, limpar sessões do usuário, editar repositórios pessoais ou publicar/deployar. Não reindentar Python com regex: whitespace altera semântica.
