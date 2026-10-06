# SpeedCode 0.6.6 — expansão Git intuitiva e limitada

- Todos os níveis de Preparados/Alterações iniciam expandidos em cada projeto.
  Hierarquia indentada preserva nomes/caminhos originais e ações individuais.
- Botões compactos Expandir tudo/Recolher tudo em cada cabeçalho, com tooltip,
  nome acessível e estados independentes. Recolher tudo não modifica arquivos,
  apenas apresentação/cache; escolhas resistem a redesenho/status no projeto.
- Pastas novas carregam pelo Git scoped ao abrir o painel ou expandir tudo.
  Sem scan global, timer novo, dependência ou mudança nas regras de ignore.
  Até 16 leituras sequenciais por lote/16 grupos em cache/2 mil caminhos;
  8 mil nós, 16 níveis, 200 linhas por página incluindo cabeçalhos, como antes.
- Recolher libera cache. Troca de projeto, atualização ou recolhimento descarta
  respostas tardias; painel/janela ocultos interrompem entre leituras. Erros e
  limites aparecem no painel sem loop de retries; expandir tudo permite retry
  explícito. Limites não cortam contexto nem autorizam Git destrutivo.
- Testes de padrão, persistência, estados independentes, cancelamento, limites,
  falhas, cache e casos profundos. Builds JS/Rust e validação GUI/performance
  isolados, preservando instância e perfil reais do usuário.
