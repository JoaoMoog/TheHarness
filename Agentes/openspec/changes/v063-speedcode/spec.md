# Especificação 0.6.3 — SpeedCode

## Identidade

- SHALL usar SpeedCode em título, marca, executável, recursos Windows, pacote,
  docs de uso e referências ativas. Cargo/bin: speedcode; distribuição SpeedCode.exe.
- SHALL manter CSS/paleta existentes e os cinco valores cromáticos do SVG original.
  O símbolo é SVG estático de raio + velocímetro; gerar PNG e ICO multirresolução.
- SHALL renomear checkout e repo GitHub sem perder histórico, id e privacidade.
  Não implica commit/push/deploy do código alterado nem remoção de builds antigos.
- SHALL conservar perfil/catálogo legado, origem WebView/localStorage e aliases
  de build/configuração. Não copiar recursivamente caches nem credenciais.

## Navegação Git

- Clique simples continua diff; duplo clique no caminho abre buffer + explorador.
- Ação Mostrar arquivo e duplo clique no cabeçalho oferecem alternativa acessível.
- Arquivos staged/unstaged/renomeados usam o caminho atual, não oldPath.
- Buffers dirty são reutilizados; nunca autosave, restaurar deletado ou alterar índice.
- Falha de leitura informa erro e ainda tenta revelar pasta disponível. Diretórios
  novos agrupados podem ser revelados sem carregar arquivos como documentos.
- Resposta de diff atrasada SHALL ser ignorada após navegação/troca de projeto.
- Recolher/expandir normal continua funcionando; árvore mostra seleção e scroll
  até a linha disponível, sem abrir Windows Explorer/PowerShell externo.

## Orçamento

Somente ancestrais, sequencialmente; cota 16 pastas/8.000 registros/1.000 DOM rows
já existente. Sem recursão de filesystem, timer novo, pré-carregamento de arquivos
ou cache adicional. Cancelar revelação após projeto/navegação mudar. Cotas/filtros
reportam parcialidade. CPU/RAM do app + WebView medidos em cenário isolado;
não prometer ganho frente VS Code/CLI nem esconder gate que falhe.

## Documentação e testes

README explica integração chat/CLI, sessões distintas, custos e limites reais.
Testes de paths inseguros, ancestrais, cotas, cancelamento, perfil legado e catálogo;
teste GUI isolado de diff/revelar/dirty/deleção. Build JS/Rust, gerar release portátil
com DLLs e Ruff. Nunca invocar inferência paga ou editar repos pessoais nos testes.
