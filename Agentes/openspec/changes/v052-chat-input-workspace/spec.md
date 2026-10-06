# v0.5.2 — Enter envia e conversa vinculada ao projeto

Problema confirmado: frontend usava root do explorador para envio e MCP, exigindo
limpar ao navegar para outro projeto. Comparação textual de caminhos Windows
também confundia diferenças de caixa/separadores. Isso não era perda de contexto
do modelo: a mensagem era bloqueada antes do envio.

- Enter envia; Shift+Enter insere linha; Ctrl+Enter continua compatível.
- IME/composição, tecla mantida, rodada em andamento e operação pendente não enviam
  mensagens acidentalmente. Entrada preservada se envio falhar.
- Sessão criada mantém workspace retornado pelo backend como autoridade.
  Envio, busca local, início/MCP e modelo usam esse workspace. Não mudar cwd de uma
  conversa ativa implicitamente, nem editar outro projeto por causa do explorador.
- Navegar no explorador não apaga ou exige apagar conversa, consumo ou MCPs.
  Aviso informativo identifica os dois projetos e destino dos próximos pedidos.
  Voltar ao projeto do chat só navega no explorador, sem limpar contexto.
- Anexos de outro projeto continuam explicitamente selecionados pelo usuário;
  não rebasear caminho do arquivo arrastado/aberto para o projeto do chat.
- Backend mantém validação de workspace contra clientes incorretos, com mensagem
  de preservação; nenhuma chamada automática de chat_clear para tratar troca.
- Limpar segue ação explícita/confirmada do usuário. Trocar deliberadamente o
  workspace de uma conversa continua exigindo iniciar contexto novo; não migrar
  silenciosamente instruções/permissões do projeto original.

Validar JS de teclas/composição/repetição, troca entre projetos e manutenção do ID,
histórico, consumo, busca/MCP, navegação de volta; testes Rust regressão, UI build,
release e pacote versionado. Preservar aplicações antigas abertas e alterações locais.

## Adição solicitada durante execução: prévia Markdown

Botão contextual .md/.markdown deve renderizar buffer atual sem gravar e permitir
Voltar ao código. HTML apenas .html/.htm. Suportar GFM, HTML seguro e imagens locais
relativas resolvidas sob workspace do buffer, não do explorador/chat. Não carregar
rede implicitamente nem executar código/handlers; links externos requerem clique.
Limites visualização 512 KiB, 8 imagens de 2 MiB, mensagens de falha/limite. Não
quebrar troca/fechamento de abas, visualizador de imagens ou diff. Testes DOM de
renderização, segurança, navegação, paths/traversal e orçamento; build novamente.
