# Chat e acabamento visual da CLARA

Entrega de 18/10/2026 com Impeccable e Taste. Superfície de produto para gestores e analistas; preserva Figtree, navy, azul de ação e superfícies claras. Taste aplicado como refinamento de produto, com sua skill frontend-ui-engineering, sem transformar o aplicativo em página de marketing.

## Mudanças

- Fonte e análise em uma área recolhível, fechada após enviar para priorizar a conversa. Importação continua acessível nessa área.
- Campo de escrita compartilhado entre início e painel lateral. Cresce com o texto, respeita composição de teclado e mantém Enter / Shift + Enter.
- Mensagens com medida de leitura e contraste consistentes. Estado de espera discreto, respeitando movimento reduzido.
- Histórico com rolagem própria. Preserva a posição durante a leitura; botão para voltar à última mensagem. ResizeObserver mantém a posição correta ao mudar o tamanho da janela.
- Proposta no fluxo de leitura e campo de resposta separado da rolagem das mensagens.
- Navegação, títulos, controles, busca e painéis harmonizados com o sistema visual existente. Sem dependências novas.

## Verificação

- Build de produção e TypeScript aprovados.
- Quatro fluxos Playwright aprovados: conversa, início, prioridades de design e evidências.
- Conversa testada em 1440, 1024, 768, 390 e 320 px, incluindo Axe WCAG 2 A/AA, ausência de overflow horizontal, leitura do histórico, retorno à última mensagem, expansão do campo, esclarecimentos, refinamento, erro/reenvio e criação.
- Capturas desktop e celular inspecionadas. Corrigido contraste do autor na mensagem azul e atualização da rolagem após redimensionamento.
- Detector Impeccable com avisos de escala/raios e uma cor já existente comparados ao DESIGN.md raiz legado; autoridade desta superfície permanece `design/clara-sap-studio/DESIGN.md`. Cores do chat usam os tokens existentes.

Capturas finais da conversa: `app/.local/taste-conversation/conversation-conversa-perg-3136d-inamento-e-cria-o-dashboard/`. As capturas do site estão em `app/test-results/design-priority-*` e `app/test-results/design-evidence-*`.

Esta etapa altera a apresentação e a interação do chat. A interpretação financeira, a revisão explícita da proposta e o salvamento separado continuam com os contratos já implementados.
