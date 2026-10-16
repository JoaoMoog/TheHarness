# Relatório de testes da simulação Aval (demo web)

Data: 14/10/2026. Ambiente: `http://127.0.0.1:8787/#/entrada` (`npm run server`, modo demo), Chromium via Playwright. Viewports 1280×720, 1440×900, 1920×1080 e 390×844. Capturas em `capturas/`.

## Status das correções (14/10, após aprovação)

**A versão executiva roda do início ao fim sem nenhuma intervenção** (verificado duas vezes no navegador, do zero, até "O que você viu em 7 cenários"). 207 testes unitários verdes (eram 195), `tsc` limpo, builds de release e demo ok. O APK mantém conta local, barra de simulação e selo no comprovante (conferido no build de release).

| Item | Status | Onde |
| --- | --- | --- |
| P0-1 Janela de avisos | Corrigido | `guide.js`, `main.js` |
| P0-2 Cadastro com conta BTG na demo | Corrigido | `screens/common.js` (só com `VALIDATION`) |
| P0-3 Descrição da entrega no roteiro | Corrigido | `guide-steps.js`; `player.js` re-renderiza após digitar |
| P0-4 Relato, versão e provas na disputa | Corrigido | `guide-steps.js` |
| P1-1 Onboarding não abre sozinho na demo | Corrigido | `domain/onboarding.js` (`automatic`), `main.js` |
| P1-2 Retomar após pausa reavalia o passo | Corrigido | `player.js` |
| P1-3 Datas | Corrigido | Comprovante usa a data da demo do pagamento (`paidOn`). O 11/10 do banco já era a data da demo |
| P1-4 "1 de 0 ofertas" | Corrigido | `player-views.js` (`metricTiles`) |
| P1-5 "liberados por marco aprovado" | Corrigido | Agora "liberados para quem prestou" |
| P1-6 Disputa sem provas | Corrigido | Fotos dos dois lados; caso encerrado mostra "Caso encerrado" |
| P1-7 João como "Ana" | Corrigido | Campo `as` nos passos ("João · convidado") |
| P1-8 Erro da entrega no campo | Corrigido | `actions/delivery.js` (`fieldError`) |
| P1-9 F5 desloga a demo | Corrigido | `store.js` (só com `VALIDATION`) |
| P1-10 "etapa", "a marco", "protegido" | Corrigido | Varredura sem ocorrências visíveis |
| P1-11 Logo em texto | Corrigido | Onboarding com `btgBrand("aval")`; home com "BTG Aval" |
| P1-12 Linguagem do APK na demo | Corrigido no caminho da apresentação | Helper `byEnv(demo, app)` em `ui.js`. Fluxos de cancelamento e devolução, fora do roteiro, mantêm "simulado" |
| P1-13 Onboarding | Corrigido | Títulos e notas reescritos |
| P2 Imagens dos slides | Corrigido | `whatsapp.png` e `servico.png` recapturadas |
| P2 Celular na tela "Selo" no WhatsApp | Corrigido | Cenário começa no início |
| P2 Bot: "oi" e "cancelar" | Corrigido | Respondem com Cobrar/Pagar |
| P2 390 px | Corrigido | Só o celular ativo |
| P2 Limite 429 | Corrigido | 6.000/min; vale após reiniciar o servidor |
| P2 Nomes | Corrigido | Menu "Ana Ribeiro"; cenário 3 "A contratante paga" |
| P2 Barra laranja do resultado | Corrigido | Azul BTG |
| P2 "500" sem "R$" no bot | Corrigido (15/10) | Só no bot (`domain/wa-bot.js`); ignora datas, endereço, telefone, parcelas e contagens |
| P2 Telefone no cenário QR | Corrigido (15/10) | Opção "Cobrar na hora, com QR" (`chargeInPerson`, pagador `IN_PERSON`, só canal QR) |
| P2 Fim dos slides volta à exploração | Corrigido (15/10) | No modo Slides, o fim abre o seletor de cenários |
| Duração real da executiva | Medida (15/10) | 24,4 min em ritmo normal, modo automático, sem travas |

## Conclusão

**A apresentação não roda sozinha hoje.** O cenário 1 trava em dois pontos e, como os cenários seguintes refazem o cenário 1 por trás da capa, qualquer cenário escolhido também trava. Ao todo são **4 bloqueios (P0)**, todos com a mesma origem: a implementação de 11/10 mudou regras do app (conta local, descrição obrigatória na entrega, relato obrigatório na disputa, janela de avisos desligada), mas o roteiro do guia (`guide-steps.js`) não foi atualizado.

Com contornos aplicados só no navegador, os 9 cenários rodaram até o fim. Os cenários 3, 4, 5, 8 e 9 passaram sem nenhuma intervenção. A base está sólida: slides, console do banco, layout em projetor, guarda de rotas e testes unitários estão ok.

## Resumo por suíte

| Suíte | Resultado | Observação |
| --- | --- | --- |
| Linha de base | Passou | 195 testes unitários verdes, `tsc` sem erros |
| S1 Entrada e onboarding | Passou com ressalvas | Navegação, foco e Esc ok. O onboarding bloqueia os controles da apresentação (P1-1) |
| S1 Guarda de rotas | Passou | Deslogado, todas as rotas voltam à entrada; link inexistente mostra "Este link não existe" |
| S2 Botões sem ação | Passou | 161 ações referenciadas, todas com handler |
| S4 Console do banco | Passou | 12 telas sem corte nem rolagem horizontal em 1280 e 1440 |
| S5/S12 Três celulares | Passou | Nada cortado em 1280×720, 1440×900 e 1920×1080. Em 390 px quebra (P2) |
| S6 WhatsApp | Passou com ressalvas | Cenário 8 limpo; mensagens fora do roteiro têm respostas fracas (P2) |
| S7/S8 Cenários | **Falhou** | 4 bloqueios P0 nos cenários 1, 2, 6 e 7 |
| S8 Slides | Passou | 7 slides, ←/→/PageDown/Enter/Espaço ok, só os fluxogramas animam, cores BTG |
| S9 Estado | Falhou parcialmente | F5 desloga a demo (P1-9) |
| S10 Texto e marca | Falhou | "etapa", "a marco", "valor protegido", logo em texto (P1-10, P1-11) |
| S11 Acessibilidade | Parcial | Foco do onboarding e erro de campo ok; o aviso cobre o campo com erro (P1-8). Leitor de tela não testado |
| Console | Passou | Nenhum erro de JS durante as 9 corridas |

Não verificado: duração real da versão executiva (24 min anunciados). As corridas foram aceleradas (`?ritmo=12`) e tiveram pausas por causa dos bloqueios. Medir de novo depois das correções.

## P0: travam a apresentação

**P0-1. Janela "Ativar avisos" desligada, mas o guia espera por ela.**
Cenário 1, logo após "Envie a cobrança": o rodapé pede "Ative os avisos", o botão não existe e o player para com "Não consegui seguir sozinho". Captura: `t-s8-stuck-avisos.png`.
Causa: [main.js:171](../public/js/main.js#L171) fixa `const prompt = null`, mas [guide.js:33-38](../public/js/guide.js#L33-L38) continua trocando o passo por `PROMPT_STEP` quando `activePrompt()` é verdadeiro.
Correção: o guia usa a mesma regra da tela. Se a janela continuar desligada, remover `PROMPT_STEP` e `promptOn` do guia.

**P0-2. O cadastro com a conta BTG foi trocado pela conta local também na demo.**
Cenário 1, "Autorize com biometria": a tela mostra "Criar conta local" (nome e código), e os passos biometria, "Veja os limites dela", "Marque os termos" e "Confirme" ficam sem alvo. Isso também apaga da apresentação a mensagem "ela já é cliente BTG, entra sem cadastro" e os dois limites.
Causa: [common.js:28-38](../public/js/screens/common.js#L28-L38) (`cadastroDados = cadastro`). As ações `btgAuthorize` e `importBtgAccount` ainda existem em `actions/session.js`.
Correção: na demo (`VALIDATION`), restaurar as telas de consentimento BTG e de dados e limites (versão em `auditoria-2026-10-11/implementacao/antes/public/js/screens/common.js:29-76`). O APK continua com a conta local.

**P0-3. A entrega exige descrição, e o roteiro não preenche.**
Cenários 2 (dois marcos), 6 e 7, "Envie a entrega": aparece o aviso "Inclua a descrição e pelo menos um anexo", o player clica 3 vezes e para. Captura: `t-stall-entrega.png`.
Correção: em `deliverySteps` ([guide-steps.js:68-74](../public/js/guide-steps.js#L68-L74)), incluir um passo `type` em `entrega.description` antes de enviar. O guia já suporta `type`.

**P0-4. A disputa exige relato e a resposta exige "sua versão".**
Cenário 6, "Envie" e depois "Responda": aparecem os avisos "Conte o que aconteceu." e "Escreva sua versão.". O balão ainda diz "Relato e fotos já estão no caso", o que deixou de ser verdade. Captura: `t-stall-disputa.png`.
Correção: passos `type` em `disputa.report` e `resposta.statement`, mais um anexo de foto de cada lado (ver P1-6). Atualizar o texto do balão.

## P1: confundem o público ou o apresentador

1. **O onboarding trava os controles na abertura.** Ao abrir o link, o play, "Escolher cenário" e "Demo" parecem ativos, mas não respondem até alguém tocar em "Pular" (`inert`). Na demo, sugiro não abrir o onboarding sozinho (ele continua em "Conhecer o Aval") ou fechá-lo quando a apresentação começar.
2. **Depois de uma intervenção manual, o player trava de novo.** Quando o apresentador resolve um passo à mão e retoma, o guia não reavalia o passo (o guia fica inativo enquanto está pausado e nada re-renderiza ao retomar). O player volta a parar 8 s depois. Correção: re-renderizar ou chamar `syncGuide()` ao retomar ([player.js:230](../public/js/player.js#L230)).
3. **Datas que não batem.** O relógio da demo marca "Hoje 04/10", o comprovante diz "Registrado em 14/10/2026" (data real do computador), o gráfico do banco termina em 11/10 e o webhook de exemplo diz 2026-10-11. Tudo deveria usar a data da demo.
4. **"1 de 0 ofertas do banco aceitas"** no resultado da Antecipação (`t-s8-resultado-c7.png`). A oferta foi mostrada num cenário anterior e aceita neste, e o resultado mostra a diferença dos dois contadores ([metrics.js:26-27](../public/js/domain/metrics.js#L26-L27), [player-views.js:187](../public/js/player-views.js#L187)). Correção: mostrar "N ofertas aceitas" quando o mostrado for menor que o aceito.
5. **O resultado da Disputa diz "R$ 8.000,00 liberados por marco aprovado"**, mas o dinheiro saiu por acordo. Usar "resolvidos por acordo".
6. **A disputa aparece "Sem provas" dos dois lados** e com a regra "Reclamação sem provas", enquanto a narração diz que "os dois mostram provas" e que "a matriz decide pelas provas". O roteiro precisa anexar fotos na abertura e na resposta.
7. **No cenário "Pagar em conjunto", as ações do João** (convidado sem app, pelo e-mail) aparecem no rodapé como "Ana · cliente". Mostrar "João · convidado".
8. **O aviso de erro na entrega cobre o campo de descrição**, que é justamente o que falta preencher, e o campo não fica marcado como erro (`ui.errors` vazio). Usar `fieldError` no campo, como no cadastro.
9. **F5 durante a demo desloga** e volta à entrada pedindo o código local (o rascunho fica salvo). Na demo, manter a sessão depois de recarregar.
10. **Termos fora da regra do projeto** ("marco", nunca "etapa"; nunca "protegido"):
    - "Uma forma de pagar por entregas, com cada **etapa** à vista" e `aria-label="Etapa 1 de 4"` ([onboarding.js:5](../public/js/screens/onboarding.js#L5), [:46](../public/js/screens/onboarding.js#L46))
    - "Modelo de etapas" ([protected.js:183](../public/js/screens/protected.js#L183)), "Etapa não encontrada." ([provider.js:53](../public/js/actions/provider.js#L53)), "ver esta etapa" ([common.js:43](../public/js/screens/common.js#L43)), "Não há decisão nesta etapa" ([dispute.js:86](../public/js/screens/dispute.js#L86))
    - "quando **a** marco for liberado" ([guide-steps.js:181](../public/js/guide-steps.js#L181), [moments.js:100](../public/js/moments.js#L100))
    - "fica fora do valor **protegido**" e o fluxo "Decidir entrada" ainda no código ([client.js:188-195](../public/js/screens/client.js#L188-L195)), embora o escopo diga "sem entrada". Não aparece nos cenários.
11. **Logo em texto.** O topo do app (home) e o onboarding mostram "Aval" em texto, não `btgBrand()`.
12. **Linguagem do APK na frente do BTG.** Aparecem "SIMULAÇÃO · SEM VALIDADE", "Mensagem de teste preparada. Nenhuma mensagem foi enviada ao WhatsApp", "Simular a resposta da outra pessoa", "Criar conta neste aparelho", "7 dias corridos no cenário de teste" e a barra "Simulação · sem dinheiro real · Controles" em todos os celulares. **Decisão sua:** manter um selo discreto só no APK e, na demo, voltar à linguagem de produto.
13. **Onboarding denso:** 4 telas de texto; o título "Cobrar começa por quem paga" é confuso, e "Pendente não significa concluído" soa técnico.

## P2: polimento

- A imagem `public/img/slides/whatsapp.png` do slide "Canais" é antiga e mostra "Cobrança protegida". Recapturar depois das correções.
- Durante o cenário WhatsApp, o celular principal continua na tela "Selo" do cenário anterior.
- Bot do WhatsApp: "oi" e "cancelar" recebem "Ainda não sei responder isso" sem os botões Cobrar/Pagar, e "quero pagar 500" (sem "R$") não é entendido.
- Em 390 px a demo web mostra três celulares espremidos. Em tela estreita, mostrar só o celular ativo.
- Limite do servidor: 1.200 requisições por minuto, e cada carga faz 98, então umas 12 recargas em um minuto bloqueiam o app com 429.
- Nomes: o menu Demo diz "Você · criar conta", e os cenários dizem "Ana" e "a cliente". A regra diz Contratante/Prestador, e o cenário 3 se chama "O cliente paga um prestador".
- No cenário QR (presencial), o Carlos ainda digita o telefone de quem paga, o que é estranho no balcão.
- O card de resultado usa barra de destaque laranja; confirmar se segue a paleta BTG.
- Passar do último slide volta para "Exploração livre" na entrada, em vez de seguir para a demonstração.

## Ordem sugerida de correção

1. P0-1 a P0-4, no roteiro e na tela de cadastro da demo; depois rodar a versão executiva inteira sem intervenção.
2. P1-1 e P1-2 (abertura e retomada do player).
3. P1-3 a P1-9 (números, datas, disputa, F5).
4. P1-10 a P1-13 (texto e marca), depois de você decidir o P1-12.
5. P2, recapturando a imagem do slide por último.

Cada correção leva teste unitário quando a regra permitir (por exemplo: todo passo do roteiro com alvo existente na rota, e o texto sem "etapa"), mais reteste no navegador.
