# AgentDesk Lite 0.4.1 — sessão funcional e chat compacto

## Evidência e causa

Falha reportada em 03/10/2026: `session.create` falha com `Session state not found`,
apesar de auth.status autenticado e CLI capaz de responder. Reproduzida pelo bridge
de produção ao usar workspace diferente do cwd do aplicativo. SessionFs recebia
`stat` da pasta real do projeto; MemoryFs vazio devolvia ENOENT. O antigo teste
criava sessão no próprio cwd e não enviava mensagem, deixando escapar a regressão.
Não atribuir esta falha a créditos. Login, disponibilidade do modelo, construção
da sessão e inferência são etapas independentes.

## Sessão e arquivos

- Uma fábrica de SessionConfig compartilhada entre produção e testes.
- Estado `C:\AgentDeskSession` virtual por sessão, nunca gravado em disco.
- SessionFs híbrido: arquivos do workspace registrado usam o disco real; referências
  externas selecionadas explicitamente são somente leitura. Revalidar componentes,
  impedir escapes por traversal/reparse points e impedir mutação da raiz do workspace.
- Normalizar separadores, prefixo estendido, pontos e caixa de caminhos Windows.
- Limitar estado a 64 MiB e leituras de referências a 32 MiB; sobrescritas não
  contabilizam o conteúdo anterior duas vezes. Erros distinguem caminhos ausentes.
- Não extrair token, mudar login, criar proxy HTTP ou persistir conversas.
- Permissões do harness continuam sendo o controle das ferramentas. SessionFs não
  transforma execução de shell em sandbox; comandos aprovados têm os acessos do CLI.

## Interface

- Cabeçalho compacto: título, nova sessão (+), opções (…) e fechar.
- Linha de conexão separada: `Conectado · conta` verde e apenas Desconectar; quando
  offline, Conectar usa credencial salva ou inicia login oficial por código.
- Opções avançadas recolhidas: trocar conta/host, revalidar, sair da conta compartilhada.
- Erros em banner vermelho role=alert dentro do chat, acima do histórico e não
  em toast atrás do painel. Erro não substitui status de conexão.
- Envio malsucedido preserva texto/anexos e remove a mensagem não aceita do histórico.
- Estado vazio amigável, contexto resumido com caminho completo no tooltip.
- Composer único com anexos, modo, menu de modelos pesquisável e effort junto ao envio.
  Catálogo real, política de modelos respeitada, sem modelos/efforts fictícios.
- Enter mantém múltiplas linhas; Ctrl+Enter envia. Escape fecha menus. Rótulos
  acessíveis nos controles de ícone. Apenas um menu aberto por vez.

## Autopilot e pausa

- Padrão Agente, sem autoaprovação. Seleção Autopilot exige confirmação que explica
  execução de comandos, alterações/exclusões e possível consumo adicional.
- Aplicar modo real via `session.mode.set`, verificar resultado, além de agentMode
  no envio. Não simular autonomia com repetição de prompts no frontend.
- No Autopilot, aprovar uma vez apenas pedidos não gerenciados. Qualquer sinal
  de managed settings ou managedApprovalRequired mantém aprovação humana.
- Não confundir idle intermediário de Autopilot com tarefa concluída.
- Botão quadrado Pausar usa session.abort, interrompe a rodada, cancela pedidos
  pendentes e volta a modo interativo. Mantém conversa/contexto/arquivos. Não é
  suspensão do processo: enviar nova mensagem retoma a tarefa na mesma conversa.
- Limpar, desconectar e pausar revogam autoaprovação. Limpar encerra o runtime e
  elimina referências/estado em RAM. Autopilot não é salvo em preferências.

## Aceitação e validação

1. Testes unitários: normalização Windows; workspace real; refs somente leitura;
   impedimento de escape e mutação da raiz; estado em memória; políticas de Autopilot.
2. Testes DOM: alerta local sem toast; conexão verde preservada; rascunho após erro;
   confirmação Autopilot; pausa sem chat_clear; desconexão sem account.logout.
3. Teste ignorado, explícito, com CLI instalado: criar sessão com configuração de
   produção, trocar Autopilot/interativo e consultar modo real, sem inferência.
4. Teste live opt-in `AGENTDESK_CHAT_LIVE_TEST=1`: uma mensagem curta num workspace
   temporário vazio diferente do cwd, recusando ferramentas. Aguardar resposta real,
   encerrar runtime e remover somente a fixture vazia. Pode consumir cota da conta.
5. Build frontend antes do Rust (embed em tempo de compilação); release e pacote
   portátil com DLLs. Inspeção visual do executável e menus, sem automatizar OAuth.

## Limitações mantidas

Sem promessa de crédito gratuito, consumo inferior ao CLI ou paridade total VS Code.
Autopilot usa API experimental do SDK fixado e pode depender de versão/política do
CLI. Testar troca de modo não prova execução de uma tarefa autônoma complexa. Login
OAuth/logout corporativo exige exercício humano; não alterar a conta nos testes.
