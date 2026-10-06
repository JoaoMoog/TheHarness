# AgentDesk Lite 0.4 — branches e Copilot Chat

## Objetivo
Manter a bancada nativa leve, os terminais PowerShell/Copilot/Kiro e adicionar um
chat que usa o SDK oficial Rust e o harness do CLI instalado. Não implementar uma
API privada de Copilot nem extrair tokens para o frontend.

## Branches
- Listar locais e referências remotas obtidas pelo Fetch.
- Criar branch com nome validado pelo Git, escolhendo base local ou remota.
- Criação a partir de remota não herda o upstream da base: o primeiro Push publica
  o novo nome no remoto escolhido, com `--set-upstream`, sem force push.
- Pode criar sem trocar; trocar exige arquivos salvos e worktree limpo.
- Exclusão somente local, confirmação humana, `branch -d`, nunca `-D` ou delete remoto.
- Publicar exige remoto realmente cadastrado, HEAD em branch e confirmação.

## Identidade visual
Remover o ícone pequeno da barra de título Windows, preservar título, controles,
ícone da barra de tarefas e marca dentro do aplicativo.

## Copilot Chat
- Inicialização sob demanda. Processo CLI gerenciado pelo SDK em stdio, sem janela
  externa, sem servidor TCP aberto, sem sidecar Node adicional.
- Autenticação é a oficial do `copilot login --device-code`. Exibir apenas código,
  URL e estado; usuário autoriza no navegador. Credenciais ficam com o Copilot.
- Login compartilhado com CLI, com aviso. Logout só com confirmação, através da
  API oficial de conta. Atualizar conexão reinicia runtime e revalida autenticação;
  refresh de credencial é responsabilidade do CLI, não simular novo token.
- Usar credenciais salvas localmente, não variáveis de token herdadas, para evitar
  escolher acidentalmente outra identidade. Enterprise depende da licença/política.
- Modelos e esforços vêm do catálogo real; não fixar lista. Trocar modelo/effort
  limpa a sessão antes do próximo envio. Mostrar avisos de disponibilidade.
- Sessão por workspace, somente uma rodada ativa. Streaming de resposta e ferramentas.
- Aprovação explícita por ação e respostas a perguntas. Cancelamento/limpeza rejeitam
  aprovações pendentes. Nunca usar aprovação global nem contornar política corporativa.
- Referências locais via seletor nativo, arquivo aberto ou arrastar do explorador.
  Limites de tamanho e caminhos validados. Imagens dependem do suporte do modelo;
  documentos binários dependem da capacidade do harness, sem prometer OCR universal.
- Estado de conversa em memória via SessionFs customizado oficial. Sem transcript
  em localStorage/disco; caches de embeddings/MCP em memória, session store/telemetria
  de sessão desligados e sem export de sessão remota. Isso não impede processamento
  remoto do provedor nem desfaz edições feitas no projeto.
- Limpar sessão/contexto interrompe a rodada, cancela perguntas e descarta memória.
  Encerrar aplicação termina o runtime e seus processos filhos.
- Limites de memória do histórico/eventos; erros e eventos não executam HTML.

## Verificação
Testes Git com remoto bare isolado para base local/remota, publicação, upstream,
exclusão e recusa de nomes/refs/remotos inválidos. Testes para memória de sessão,
aprovação/cancelamento, auth output sanitizado e SDK/CLI real sem geração paga.
Build frontend e release Windows, empacotar EXE e DLLs. Login/model inference
corporativa só validáveis após autorização humana; reportar limites honestamente.

## Fontes oficiais
- https://github.com/github/copilot-sdk/tree/main/rust
- https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli
- https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate

O SDK Rust usado é preview, fixado no lockfile. Mudanças incompatíveis do CLI devem
produzir erro visível, não fallback silencioso para APIs não oficiais.
