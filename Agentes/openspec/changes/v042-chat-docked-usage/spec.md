# AgentDesk Lite 0.4.2 — painel fixo e consumo

## Escopo

Corrigir a interação reportada em 03/10/2026: popovers não fecham fora, alerta
do navegador expõe localhost, limpar sessão não é visível e chat sobrepõe o editor.
Manter terminais CLI e harness oficial, login salvo e conversa somente em RAM.

## Layout e menus

- Chat é aside irmão do main na shell flex, com divisor próprio; nunca overlay.
- Largura inicial 420 px, mínimo 320, máximo 760 limitado pelo espaço disponível.
  Reservar espaço central; min-window existente é 1000 px. Redimensionamento por
  ponteiro com capture, cancel/lost-capture e teclado (setas/Home/End).
- Persistir somente chatWidth; ao fechar ocultar também divisor e devolver espaço.
- Monaco automaticLayout e ResizeObserver do xterm acompanham o layout.
- Menus fecham por pointerdown/focusin fora, Escape ou seleção de ação. Não fechar
  ao interagir dentro da busca/lista. Apenas um details pode permanecer aberto.
- Limpar sessão é texto explícito; confirmação branded reutiliza diálogo do app,
  role=dialog, aria-modal, foco preso, Escape cancela e foco é restaurado.
- Não usar window.confirm/prompt para ações do chat. Autopilot só se ativa após
  consentimento concluído, bloqueando envio enquanto o usuário decide.

## Consumo e segurança

- chat_usage consulta somente sessão existente: não inicia runtime por conta própria.
- Usar API oficial experimental session.usage.getMetrics com timeout 5 s; enviar
  ao frontend apenas totalNanoAiu, tokens agregados e solicitações premium ponderadas.
  Não enviar credenciais, quota/account snapshots ou detalhes internos do runtime.
- Diferença entre snapshot anterior ao envio e snapshot final é o uso da rodada;
  sessão nova tem baseline zero conhecido. Baseline indisponível torna custo
  indisponível, não zero. Não somar assistant.usage ou agent_metrics ao total geral.
- Rodada pode conter várias chamadas e subagentes. Um resumo por rodada, atualizado
  no idle; Autopilot pode continuar ativo. Pausa também busca métricas consumidas.
- Valor ausente, inválido ou contador reiniciado: custo não informado, nunca gratuito.
  Tokens não são créditos; multiplicador premium não é crédito de IA.
- Exibir unidade AIU do CLI (nano-AIU / 1e9), não moeda/fatura/saldo. Documentar que
  a conversão de créditos Enterprise depende do GitHub e não foi certificada aqui.
- Mensagens e resumos permanecem em RAM; Limpar elimina todos, mantém edições.
- Projetar apenas campos dos eventos efetivamente usados pela UI, descartando
  silenciosamente eventos internos não apresentados. Não produzir avisos por
  payloads internos extensos. Manter limites e avisos de conteúdo UI extenso.
- Não aprovar ferramentas, alterar login nem matar o processo/terminais do usuário
  durante validação. Pacote versionado quando o executável antigo está aberto.

## Aceitação

1. DOM: menus fecham fora/foco/Escape, interações internas não fecham.
2. DOM: coluna correta, splitter acompanha visibilidade, limites/teclado/preferência.
3. DOM: Limpar visível, confirmação cancelada preserva histórico; aceitar limpa.
4. Uso: ausente distinto de zero, premium distinto de AIU, valores inválidos rejeitados,
   duas rodadas contabilizadas por diferença e eventos idle duplicados sem duplicação.
5. Rust: projeção mantém conteúdo/erros essenciais sem vazar campos internos.
6. Live opt-in: prompt inofensivo em fixture vazia, recusar ferramentas, verificar
   resposta real e métricas do mesmo bridge. Pode consumir cota da conta.
7. Frontend build antes de Rust release; pacote com DLLs; inspeção visual no Windows.
