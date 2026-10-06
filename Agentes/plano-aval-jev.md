# Plano: Aval com julgamentos TypeSafe (Jev)

Princípio: o código decide dinheiro, limites, prazos e estados. O Jev só dá o julgamento semântico (texto, evidência, intenção) como Choice, Noul ou Score. Nenhum julgamento move dinheiro sozinho. Baixa confiança vai para a fila de trabalho do banco.

## Estado em 04/10/2026
- Figma novo (o original não foi tocado): https://www.figma.com/design/NJwtyAWsDf8IyoUXySxntZ
  - 00 Fundação: variáveis Orquestra, estilos Figtree, 52 ícones Phosphor, logo BTG, componentes (Botão, Chip, Aval IA/Sinal, botão flutuante, Cabeçalho, Abas, Linha, Etapa, Menu web, Barra web).
  - 01 App: 24 telas (390×844). 02 Website: 6 telas (1280×800), incluindo W6 Aval IA. 03 Escopo: 41 funções com tela e o mapa do Jev.
- Funções acrescentadas: 33 Central de avisos e 34 Perfil e privacidade (inferidas para as seções 09, 10, 14 e 15, validar), além de 2, 16, 35 e 41 (Aval IA).
- Fase 0 ok (smoke jev-1.13.0, typecheck). Fase 1 ok: `src/policy.ts` (limiares iguais à W6) e `src/fixtures/av-2026-001.ts`, com 8 testes (`npm test`).
- Fase 2 ok: 7 julgamentos em `src/judgments/` (confirmação tácita, conferência da entrega, motivo da disputa, provas suficientes, prioridade da fila, perícia e intenção do Aval IA). Total de 20 testes com cliente falso. A avaliação real (`npm run jev:eval`, 16 casos sintéticos em português) acertou 16 de 16, depois de reescrever a pergunta da perícia; antes eram 15 de 16, com o erro indo para a revisão humana. A confiança das Nouls é |2p − 1|, como recomenda a documentação.
- Fase 3 ok: `npm run server` (`src/server/`, node:http, sem framework), com as rotas `GET /health`, `GET /queue` e `POST /judge/:nome` para os 7 julgamentos.
  - Proteções: validação zod estrita, corpo de até 32 KB, 60 requisições por minuto por IP, erro do Jev vira 502 sem detalhes, a chave fica só no servidor e há CORS opcional (`ALLOWED_ORIGIN`).
  - Para onde vai a baixa confiança (`escalateTo`): "user" (confirmação tácita, entrega, motivo da disputa e Aval IA) pede confirmação no app; "bankQueue" (provas, perícia e prioridade) entra na fila do banco.
  - A fila fica em memória e zera quando o servidor reinicia. São 31 testes, e o teste de ponta a ponta com o Jev real passou.
- Fase 4 ok: protótipo navegável em `public/`, servido pelo `npm run server` em http://127.0.0.1:8787.
  - Seletor de perfil (Marina, Horizonte, Banco) com estado compartilhado entre os três.
  - Telas novas: aba Serviços, biometria, cadastro, novo serviço em 3 passos, convite enviado, Pix, pagamento confirmado, extrato, disputas, antecipação disponível, contrato e pedido de ajuste.
  - Julgamentos novos: etapas sugeridas, sinais de fraude e moderação de avaliações (agora são 10). Nova rota `POST /queue/:id/resolve`, além de `GET /policy`.
- Testes: 41 de unidade e integração. A avaliação real tem 20 casos e acertou 20 de 20. O teste ponta a ponta no navegador (Playwright) passou nos 3 perfis e nas 43 rotas.
- Fase 5 ok (plano de ideias, ondas 1 a 5), sobre as 22 imagens do escopo (`Downloads/Escopo.zip`).
  - **Onda 1:**
    - Conta única com dois papéis: Marina e Carlos, cada um com "Contratando" e "Prestando", e limites separados para contratar e para antecipar.
    - Conectar conta BTG: consentimento, token e modo à vista sem conta. Open Finance. App BTG com o Aval dentro.
    - Início no estilo BTG (saldo oculto, atalhos, pré-aprovado, selo de proteção).
    - Seguro Aval e seguro de arbitragem. Cláusula compromissória.
    - Jornada de crédito: simulador, proposta, análise, CCB e meus créditos. A decisão é feita por função pura, em `public/js/domain/credit.js`, e o dinheiro vai só para a custódia.
    - Relógio da demonstração.
  - **Onda 2:** orçamento com modelos de etapas, Aval Link, maquininha (POS), agenda de recebíveis com antecipação parcial e automática, subcontratação com liberação em cascata, NFS-e a cada liberação, serviço recorrente e Pix Automático.
  - **Onda 3:** conversa do contrato, nova data (matriz), prazos e regra da matriz na disputa, antifraude da evidência (código mais Jev), contestação de bloqueio e régua de cobrança configurável.
  - **Onda 4:** receita por fonte e resultado para o BTG, FIDC, simulador de limiares, conluio e lista negra, compliance com trilha de auditoria, portal da API do ELO.
  - **Onda 5:** Aval Labs (custódia que rende, cofrinho, cartão 12x), marcado "a decidir com o BTG".
  - Julgamentos novos:
    - `requestCredit`, nova intenção do Aval IA.
    - `conversationEscalation`, limiar de 0,7, com destino "user".
    - `scheduleOnly`, limiar de 0,8, com destino "user".
    - `evidenceConsistency`, limiar de 0,75, com destino "bankQueue".
    - `blockAppeal`, sempre humano.
- Testes: 67 de unidade e integração. A avaliação real tem 28 casos e acertou 28 de 28, com 0 erros automáticos. A varredura no navegador fez 216 visitas, em 4 lados e no banco, sem erro.
- Visual BTG Banking (05/10/2026), a partir de prints reais do app BTG:
  - Cores amostradas dos prints: azul #2D5AAF, faixa #233B81, navy #081327 e cinza #E1E2E6. Botões e cartões com raio 4.
  - Entrada "Que bom te ver por aqui", início com saldo, faixa de atalhos, banner e atividades, e um botão "Menu" com blocos no lugar da barra de abas.
  - Telas internas com cabeçalho "← Título", e versão navy nas telas de produto.
  - Telas no formato das equivalentes do app BTG: Serviços e Financeiro (limite e barras por mês), comprovantes, Notificações, Perfil, Gestão de contas e app BTG simulado.
  - Varredura: 111 visitas em 36 telas distintas e 95 links do início e do Menu, sem erro.
- Marketplace BTG Serviços (05/10/2026). O Aval vira o nome da proteção: custódia, crédito, seguro e arbitragem.
  - Quem contrata:
    - busca e categorias;
    - perfil público e anúncio com preço, que se contrata na hora;
    - "Fazer pedido" em 4 passos, até 4 orçamentos, comparativo e aceite com pagamento;
    - favoritos.
  - Quem presta: oportunidades, que é grátis responder; taxa de 6% só ao fechar; vitrine com destaque pago (R$ 49,90 por 7 dias); anúncios moderados.
  - Banco: página com GMV, conversão, receita de taxa e destaque, categorias mais pedidas e moderação de anúncios.
  - Jev: 4 julgamentos novos (`requestCategory`, `requestCompleteness`, `serviceMatch` e `listingModeration`). O ranking e as taxas são decididos pelo código, em `domain/marketplace.js`.
  - Testes: 94 de unidade e integração. Avaliação real com 41 casos, 41 acertos e 0 erros automáticos. Roteiro de ponta a ponta no Playwright ok. Varredura com 192 visitas em 66 telas, sem erro.
  - Conversa antes do aceite (contatos ocultados pelo código com `maskContacts`) e "Contratar de novo" (pedido direcionado ao mesmo prestador): feitos.
- Auditoria de alinhamento (05/10/2026): 347 telas, com 10 verificações de layout, consistência de medidas e estresse com textos longos. Tudo zerado depois das correções:
  - alvos de toque de 24 px;
  - campos de conversa com 40 px;
  - espaço para o botão de IA;
  - rodapé vazio removido;
  - tabela do banco sem estouro.
- Figma: página "04 · Protótipo v5 · BTG Banking e BTG Serviços" com 18 telas-chave em camadas editáveis; os 88 ícones agora são componentes.
- Próximo: levar as telas novas ao Figma e calibrar os limiares com casos reais rotulados (fase 6).

## Situação atual
- Existe um scaffold em TypeScript: `src/jev.ts` (cliente, falha sem chave) e `src/smoke.ts` (Choice, Noul, Score).
- Chave em `.env` (fora do git). Fica só no servidor, nunca no HTML do protótipo.
- As telas HTML hi-fi e o `build.py` do resumo estão em `/mnt/project-files/aval/fonte/`, que não está nesta pasta.

## Onde o Jev entra (mapa pelas telas do resumo)

| # | Função do Aval | Tela | Primitiva | Julgamento | Código decide |
|---|---|---|---|---|---|
| 1 | Confirmação tácita | Aprovar etapa | Choice | resposta do contratante é aprovação, ressalva, rejeição ou ambígua | prazo de silêncio, liberação |
| 2 | Conferência da entrega | Enviar entrega | Noul por critério | a descrição e os anexos cobrem cada item da etapa | exige foto, vídeo ou local conforme etapa |
| 3 | Motivo da disputa | Abrir disputa | Choice | categoria (prazo, qualidade, escopo, pagamento, outro) | bloqueio de repasse |
| 4 | Suficiência de evidência | Acompanhar disputa | Noul | cada parte anexou prova relevante ao motivo | prazos da arbitragem |
| 5 | Prioridade da fila | Fila de trabalho (web) | Score | urgência e gravidade do caso | ordenação e SLA |
| 6 | Pedido de perícia | Resultado e arbitragem | Noul | o caso depende de avaliação técnica presencial | abertura da perícia |
| 7 | Antifraude | Conta em análise | Noul por sinal | inconsistências no cadastro e no texto do serviço | regras de KYC, limites |
| 8 | Etapas a partir do texto | Novo serviço | Choice sobre trechos candidatos | seleção de valores e marcos do texto | soma das etapas igual ao total, parcelas, CET |
| 9 | Aval IA | botão flutuante | Choice + Noul | intenção (pagar, aprovar, disputar, ver extrato, outro) e parâmetros | executa só após folha de confirmação |
| 10 | Reputação | Clientes e limites | Score por dimensão | qualidade das avaliações textuais | fórmula de limite |

As funções 1 a 6 e 9 são o núcleo para a demonstração ao BTG. 7, 8 e 10 vêm depois.

## Arquitetura
1. `src/judgments/<funcao>.ts`: uma função por julgamento, entrada tipada, retorno `{ valor, confianca, precisaRevisao }`.
2. `src/policy.ts`: limiares de confiança por julgamento (valores iniciais calibrados com casos do AV-2026-001).
3. `src/server.ts`: API HTTP mínima (`POST /judge/<funcao>`) que o protótipo chama. Valida entrada, nunca devolve a chave, registra entrada, resposta e latência.
4. `src/fixtures/av-2026-001.ts`: caso de demonstração (Marina Costa, Horizonte Reformas, R$ 12.000 em 3 etapas) mais variações para teste.
5. Perguntas independentes sobre o mesmo estado vão numa única chamada (fan-out). Ex.: na entrega, os critérios da etapa viajam juntos.

## Fases
0. Verificar `npm run jev:smoke` e `npm run typecheck`.
1. Fixtures e cliente: `fixtures/`, `policy.ts`, tipos compartilhados.
2. Julgamentos do núcleo (1 a 6, 9) com testes de unidade usando cliente falso e um conjunto pequeno de casos reais com a chave.
3. Servidor HTTP e roteamento por confiança para a fila de trabalho.
4. Ligar ao protótipo: trocar os dados estáticos das telas por chamadas ao servidor nas telas de entrega, disputa, aprovação e Aval IA.
5. Julgamentos 7, 8 e 10.
6. Calibração: para cada julgamento, tabela confiança contra acerto nos casos de teste, e ajustar limiares.

## Riscos e decisões
- Os arquivos HTML do protótipo não estão em D:\Aval. Preciso deles (ou o caminho) para a fase 4.
- Seções 09, 10, 14 e 15 do escopo não vieram; podem trazer funções que mudam o mapa.
- Dados de cliente reais não devem ir ao Jev na demonstração: usar só fixtures sintéticas.
- Typed output garante o formato, não a verdade: toda decisão com efeito financeiro exige confirmação humana ou regra de código.
- Pendências do resumo (prints do app BTG, Figma novo, validação do logo) continuam independentes deste plano.
