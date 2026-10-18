# CLARA: criação por conversa

Implementado em 18/10/2026, preservando a identidade do Studio e as melhorias anteriores.

## Comportamento

- Início e painel lateral compartilham o histórico com identificação de Você / CLARA. A mensagem enviada aparece imediatamente, com estado de espera e foco devolvido ao campo ao responder.
- Pedido sem objetivo recebe uma pergunta. Período ambíguo recebe esclarecimento. Respostas curtas completam o pedido anterior; informações já fornecidas não precisam ser repetidas.
- A proposta pode ser refinada antes de criar o dashboard. O botão Criar dashboard aplica os filtros e a composição; Salvar versão registra o documento.
- Falha ao enviar preserva o texto e a proposta anterior, sem deixar uma mensagem duplicada no histórico visível.
- Nova conversa e troca de fonte/análise isolam o contexto. O servidor separa pessoa, espaço, identificador da conversa e fonte. A interface mantém a conversa durante a navegação; após recarregar, começa uma nova. Não há biblioteca de conversas nesta entrega.
- O modo demonstrativo interpreta um conjunto limitado de pedidos e também pede esclarecimentos. Bedrock interpreta linguagem livre dentro do contrato financeiro existente; medidas ausentes não são inventadas.

## Integração

`assistantInputSchema` aceita `conversationId` opcional e `proposalApplied`. O servidor mantém até 40 mensagens e a proposta ainda em discussão. A marca de aplicação impede reapresentar uma proposta já aplicada como pendência. Chamadas simultâneas à mesma conversa são recusadas; o limite de frequência permanece por usuário/espaço.

O Bedrock recebe histórico, catálogo e proposta pendente como dados. Saídas continuam validadas por Zod e pelo catálogo antes de serem devolvidas à interface. O ensaio real encontrou uma saída ready sem message; o formato de resposta ganhou exemplos completos e instrução explícita sobre as três propriedades obrigatórias. Não há aceitação de JSON inválido nem fallback silencioso.

## Validação

- Build de produção e TypeScript aprovados.
- Suíte completa: 115 testes aprovados.
- Playwright: conversa, início, prioridades de design e evidências aprovados. A conversa cobre esclarecimento, continuidade, refinamento, erro/reenvio, aplicação e novo contexto.
- Axe WCAG 2 A/AA na conversa: sem violações em 1440, 390 e 320 px; sem overflow horizontal. Capturas inspecionadas em desktop e celular.
- Bedrock real configurado: três turnos com dados sintéticos passaram — pedido genérico → objetivo com setembro ambíguo → resposta “2025”. Resultado create preservou Filial Sul, barras e datas inclusivas de setembro/2025, sem salvar o documento. Script reproduzível: `node --import tsx scripts/test-conversation-live.ts` a partir de `app`.
- Detector Impeccable: apenas avisos de paleta/escala/raios em relação ao DESIGN.md raiz legado. A autoridade visual desta superfície permanece `design/clara-sap-studio/DESIGN.md`; contraste e navegação por teclado foram verificados no navegador. Nenhuma alteração de identidade feita para satisfazer o documento legado.

Capturas: `app/test-results/conversation-conversa-perg-3136d-inamento-e-cria-o-dashboard/conversation-{1440,390,320}.png`.
