# CLARA — Slate Admin Console

Em 18/10/2026, o usuário escolheu substituir o design system por `bs-slate-admin-console`. Instalada a versão **1.0.4** pelo CLI oficial, após autorização do dispositivo, em `C:/Users/jpmoo/.agents/skills/bs-slate-admin-console`. Nenhum token de autenticação faz parte do repositório.

## Implementação

Os tokens de `references/template.html` foram copiados para `app/src/studio/ui/slate-tokens.css`. A adaptação ao Next/React existente está em `slate.css`. As folhas de layout anteriores agora referenciam tokens semânticos; `taste.css` deixou de ser importado. Geist e Geist Mono são servidas localmente pelas dependências Fontsource, sem CDN em execução.

O sistema cobre início/conversa, biblioteca, dashboard, exploração, planejamento, cenários, dados e administração, além de login, editor, painéis e diálogos. Os objetos e fluxos financeiros existentes substituem as telas genéricas do template; não há clientes, equipe ou métricas inventados. A navegação existente e os links de dashboard/espaço são preservados.

- Cabeçalho de 48px, sidebar de 264px em dois grupos e painel interno com raio de 14px. Rail em tablet, expansível pelo botão do cabeçalho; gaveta em celular.
- Botões primários, secundários e discretos com estados de foco, hover, pressionado e desabilitado. A aba atual do dashboard é texto de navegação, sem falso botão.
- Campos e controles com borda explícita; dados e indicadores usam hierarquia de texto e números tabulares.
- Paletas Slate/Tangerine, modos claro/escuro e densidade. Aparência persistida em `clara:appearance:v1`, com acesso a armazenamento protegido por try/catch.
- Gráficos e tooltips usam os tokens de dados da paleta. Cores de sucesso e ação têm variantes de texto com contraste, sem alterar os tokens originais da skill. A ação Tangerine clara mistura 78% do primário com a cor de texto para obter contraste AA com texto branco.
- Filtros recolhíveis em exploração, planejamento e cenários, com resumo do recorte sempre visível. As tabelas financeiras viram registros rotulados em telas estreitas, preservando valores e campos editáveis. A prévia de importação permite rolagem por teclado.
- Conversa preserva esclarecimentos, histórico, proposta antes de aplicar e salvamento separado. O foco retorna ao campo após a resposta por efeito de layout, depois de o campo ser reabilitado.

## Verificação

`npm run build` inclui compilação e TypeScript. O teste `slate-design.spec.ts` percorre as oito áreas em 1440, 1024, 768 e 390px, nas quatro combinações de paleta/modo; verifica overflow, acessibilidade Axe, persistência, navegação mobile/tablet e diálogos. Capturas finais ficam em `app/.local/slate-final-review/`; conversa em `app/.local/slate-final/` e demais regressões em `app/.local/slate-validation/`.

Regressões: `conversation.spec.ts`, `home-refinement.spec.ts`, `design-evidence.spec.ts`, `design-priority.spec.ts` e `header-panels.spec.ts`. A conversa também é testada em 320px, incluindo perguntas de esclarecimento, refinamento, erro/reenvio, preservação de rolagem e criação do dashboard. Os testes usam conta e banco isolados, sem modificar as análises do usuário.

O validador HTML standalone da skill não se aplica ao aplicativo Next. A compilação, os testes de browser e a revisão das capturas verificam esta adaptação. A avaliação de acessibilidade é automatizada e não substitui uma auditoria manual completa com leitores de tela.

## Ajuste de alinhamento e conversa compacta

Após revisão do usuário, a busca passou a acompanhar a largura e a posição do campo do cabeçalho, com atualização por ResizeObserver, lista mais curta, navegação por setas e sem duplicar o dashboard salvo. O foco destaca o campo inteiro, incluindo o ícone.

O início exibe apenas a pergunta principal, o resumo recolhido da fonte e o campo de mensagem. Foram removidos a segunda apresentação, a saudação automática e as instruções repetidas. Nova conversa mantém o contexto recolhido; critérios da proposta continuam disponíveis em uma expansão. Espaçamentos do histórico e do painel lateral foram reduzidos sem cortar mensagens. Capturas e verificações em `app/.local/compact-chat/` e `app/.local/compact-conversation/`.
