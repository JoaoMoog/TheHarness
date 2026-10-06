# 0.6.8 — branches e stashes sob demanda

- Abrir modal pelo nome da branch; branches/stashes deixam de ocupar o painel.
- Descrição e ações de aplicar sem remover/remover com confirmação por stash.
- Arquivos somente por clique; diff de um arquivo somente por clique.
- Criar stash da projeção visível (até 200 arquivos), excluindo node_modules e
  ignorados inclusive rastreados. Recusar índice com preparados ocultos/conflitos/
  projeção parcial antes da mutação. Não modificar gitignore/configuração do projeto.
- Pathspec NUL em arquivo temporário com exclusões: staged deletes/renames não
  falham no cleanup por pathspec positivo de um caminho já ausente do índice.
- ID SHA estável, lista limitada a 500 stashes, páginas de 50 nomes/100 arquivos,
  máximo 2.000 caminhos e somente um snapshot/RPC de arquivos ativo.
- Fechar/recolher/trocar projeto libera snapshot; resultados tardios não reabrem UI.
- Nenhum timer/scanner extra; listagem de extras somente com modal aberto.
- Testar Git real: dependências, ignorados rastreados, novos, rename/delete, staged,
  aplicar preservando stash e excluir ID antigo sem atingir outro; testar JS
  demanda/cancelamento/limites. Build JS/Rust, janela isolada e gate CPU/WebView2.
- Git externo pode alterar o índice durante uma operação; não há lock contra
  todos os clientes Git. Falhas não geram rollback, retry ou limpeza automática.
