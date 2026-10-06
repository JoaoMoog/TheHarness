# SpeedCode 0.6.5 — árvore Git e fechamento do visualizador

- Diretórios e subdiretórios reais expansíveis por nível no próprio painel Git.
  Caminho completo no tooltip; nome curto e indentação indicam hierarquia.
- Pastas novas não substituem o painel por uma lista separada: carregam por Git
  scoped sob ação explícita. Sem scan do projeto/timer novo. Mantêm ignore,
  node_modules excluído, dados originais para ações e proteção de listas parciais.
- Árvore até 8.000 nós/16 níveis; overflow compõe caminhos restantes sem perder
  registros/caminhos originais. Até 2.000 registros projetados e 200 linhas por
  página incluindo cabeçalhos. Cache até 16 grupos, reads serializados; recolher
  libera cache. Troca de projeto/status/recolhimento descarta resposta tardia.
- Preparados/alterações têm expansão independente. Clique abre diff e duplo
  clique revela o arquivo; nenhuma alteração da semântica de stage/discard.
- Fechar diff atualiza abas/cabeçalho e libera seus modelos. Se não houver buffer
  selecionado, limpa nome/path/title/encoding e previews, exibindo welcome.
  Fechar um buffer não deve esconder um diff diferente que permanece aberto.
- Validar testes normais/adversariais/async, GUI real isolada, builds e amostra
  app/WebView2 sem ampliar tetos. Não tocar na instância/projetos do usuário.
