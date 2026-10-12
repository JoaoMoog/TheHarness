# Aval diagnóstico de Produto UI e UX e plano de lançamento

Avaliação em 11 de outubro de 2026. Escopo: aplicativo Android do workspace D:\Aval. Nesta etapa não houve alteração de código, design, identidade ou regras do produto. Foram criados apenas os arquivos desta auditoria e registros sintéticos durante a navegação.

**Conclusão: o Aval tem uma proposta de pagamento identificável e uma base de interface aproveitável, mas o APK chamado release ainda é um protótipo demonstrativo. Não está pronto para movimentar dinheiro real ou ser lançado como serviço financeiro.** Os bloqueios principais são autenticação simulada, exposição de informações após sair, estado financeiro apenas local, ausência de integração de pagamento e comunicação de sucesso que parece real. A prioridade é tornar verdadeiro e verificável o ciclo combinado → dinheiro confirmado → entrega → aprovação → recebimento, mantendo o design system atual.

## Método e limites da evidência

- **Observado no Android — O:** aplicativo aberto e operado por ADB/UI Automator no emulador emulator-5554, com capturas PNG e hierarquias XML. Android reportado pelo dispositivo: 17; tela 1080 × 2400, densidade 420 dpi. Um único ambiente, sem usuários participantes.
- **Verificado no código — C:** inspeção da implementação que acompanha o APK. Não significa que todos os caminhos foram executados.
- **Referência externa — R:** documentação oficial consultada em 11/10/2026; datas de publicação/atualização só são indicadas quando a fonte as informa.
- **Hipótese ou proposta — H:** interpretação de produto, melhoria ou comportamento futuro que precisa de validação.

O pacote instalado é `br.com.aval.prototipo`, versão 1.0, versionCode 1, targetSdk 34. Seu SHA-256 é `AA965D9497CA2217F4D38C8886576B025854AEE9D35E62EE6A4C13D310BD33A7`, igual ao de `BTG-Aval-release.apk`. Foram comparados os 111 arquivos de conteúdo do APK com `public/`, sem diferenças. Isso permite relacionar os achados de código à versão usada na auditoria. A interface, por sua vez, informa “Aval 5.0 · protótipo”.

Não foram usados dados bancários reais, autenticação bancária real, pagamentos reais ou mensagens externas. “Abrir como quem recebeu” e a troca de perfis foram usados exclusivamente para representar a contraparte no teste. Não há comprovação nesta auditoria de contrato com banco, seguradora, câmara de arbitragem ou prestador de pagamentos.

Não foram concluídos testes com TalkBack, leitor de QR real, aparelho físico, fontes ampliadas, múltiplos tamanhos de tela, indisponibilidade de um provedor financeiro, duas instalações sincronizadas ou retomada de um aplicativo bancário externo. O retorno testado foi do próprio Android para o Aval. O cenário de encerramento confiável foi `am force-stop` seguido de reabertura; uma tentativa de remover o cartão dos recentes não comprovou o encerramento e não é usada como evidência. A abertura inicial exibiu uma tela vazia transitória; não foi medido tempo de inicialização nem comprovada falha persistente.

## 1 Diagnóstico geral

### Produto e proposta de valor

**O/C:** o Aval organiza pagamentos de serviços que as partes já combinaram: descrição, valor, prazo, local, aceite e condições de liberação. Tanto quem cobra quanto quem paga pode iniciar. O dinheiro é apresentado como guardado no banco até aprovação da entrega, com possibilidade de divisão por etapas, liberação automática após prazo, pedido de ajuste e disputa. Crédito, antecipação e seguros são recursos adicionais.

**H:** o segmento inicial mais coerente com os exemplos atuais é o de serviços residenciais com entregas verificáveis, envolvendo contratantes e profissionais ou pequenas empresas. Pintura, interiores e reformas aparecem nos dados e modelos; isso não comprova que sejam o mercado escolhido nem que exista demanda validada.

O problema do pagador é entregar dinheiro antes de ter confiança na entrega. O do prestador é trabalhar sem segurança de recebimento e financiar materiais ou execução. O benefício conjunto pretendido é um acordo claro, com dinheiro confirmado e liberação segundo regras conhecidas. A experiência precisa provar esse benefício antes de oferecer produtos financeiros adicionais.

**Posicionamento proposto para validação:** “Combine o serviço, pague com o valor protegido e acompanhe a liberação por entrega.” Essa formulação só deve ser publicada quando a proteção e suas exceções forem sustentadas pela operação real. A novidade pode estar na experiência integrada e no contexto de uso; a pesquisa não sustenta uma alegação de mecanismo inédito de custódia ou pagamento por etapas.

### O que já funciona como base

1. **O:** há um centro de acompanhamento por serviço, com partes, valor, guardado/liberado, prazo, linha do tempo e próxima ação. É a estrutura certa para explicar uma operação que dura dias ou semanas.
2. **O:** “Cobrar” e “Pagar” permitem iniciar pelos dois lados. O retorno do cadastro à cobrança original funcionou dentro da simulação.
3. **O:** o resumo do combinado e o aceite da cláusula de arbitragem estão separados no fluxo da operação. Há impedimento de avançar sem aceitar os termos de cadastro.
4. **O:** o checkout explicita valores, parcelas e seguro opcional. O saldo insuficiente estava desabilitado; o empréstimo não foi selecionado automaticamente no caso observado.
5. **O:** entrega sem anexo gera orientação; disputa mostra valor bloqueado, prazo e resposta da contraparte. Não são apenas telas de sucesso.
6. **C:** há componentes reutilizáveis para campos, botões, opções, mensagens, folhas, linhas do tempo, comprovantes e listas. Essa base reduz a necessidade de mudanças visuais.

### Obstáculos ao lançamento

**O/C — Identidade e acesso:** autorizar com biometria e usar senha não executam autenticação real. Após sair, a rota pública “App BTG” permite visualizar saldo e atividades sintéticos da sessão anterior. Reconhecimento por primeiro nome e autenticação estão misturados.

**O/C — Dinheiro e persistência:** o botão “Simular Pix de outro banco” altera o estado local e produz comprovante. O servidor encontrado serve arquivos e um health check; não oferece API transacional. Fechar forçadamente o processo e reabrir removeu o cadastro do teste. Não há base observada para conciliação, recuperação entre aparelhos ou confirmação financeira independente do cliente.

**O/C — Promessas acima da implementação:** WhatsApp, QR, biometria, anexos, “código de autenticação”, NFS-e, avisos e exportações possuem comportamentos simulados. Vários resultados usam linguagem definitiva: “guardado no BTG”, “já está na sua conta”, “emitida”, “pedido registrado”.

**O/C — Modelo mental:** enviar um combinado não é pagar; pagar para guardar não é transferir ao prestador; aprovar não necessariamente significa que o dinheiro já chegou à conta de recebimento. Os textos atuais atravessam essas fronteiras.

**O/C — Foco:** cadastro apresenta dois limites de crédito antes do uso. A home vazia destaca saldo, limite e empréstimo antes de explicar como fazer o primeiro pagamento protegido. No checkout de R$ 18 mil, o Pix selecionado estava abaixo da primeira área visível, enquanto empréstimo, seguro e cofrinho ocupavam o início.

### Preservação do design system

O baseline é **o aplicativo atual**, não o documento histórico de outra sessão e não o BTG Banking como referência a reproduzir. Os tokens observados incluem ação `#2d5aaf`, ação pressionada `#244b93`, fundo `#f5f5f5`, cards brancos, positivo `#128850`, negativo `#ce363f`, fonte Figtree declarada em pesos 400/500 e ícones existentes. Há variantes de raio, incluindo botões de 4 px, cards de consentimento mais arredondados e Menu em pílula.

Preservar paleta, família tipográfica, iconografia, componentes, estrutura de navegação e linguagem visual. A auditoria não recomenda um novo tema, outra marca, uma nova home visual ou a reprodução de outro banco. As mudanças são de conteúdo, ordem de informação, estados, semântica, acessibilidade e funcionamento.

Não tratar toda diferença de raio como defeito: primeiro registrar as variantes intencionais e os lugares em que são usadas. Corrigir instâncias equivalentes que usem padrões diferentes sem motivo. Para contraste, preferir um token de texto já existente e mais legível; para toque, ampliar a área interativa sem mudar o desenho do ícone.

### Referências de mercado e hipóteses aplicáveis

Todas as fontes abaixo foram consultadas em **11/10/2026**. São referências de comportamento e operação, não modelos visuais nem indicação de contratação dos fornecedores.

| Referência e evidência | Problema concreto do Aval | Adaptação com o sistema atual | Como validar |
| --- | --- | --- | --- |
| **R — Escrow.com:** período de inspeção acordado, com aceite, rejeição e consequência por ausência de resposta. A página não informa data de atualização. [Fonte oficial](https://www.escrow.com/support/faqs/what-is-an-inspection-period,-when-does-it-start,-and-how-long-does-it-last). | “Até você aprovar” omite a liberação automática que aparece depois. | Reusar a mensagem e a linha do tempo para mostrar gatilho, data/hora limite e ações de revisão. **H:** isso reduz surpresa e disputa. Não importar o prazo do concorrente. | Antes de aceitar, pedir ao participante que explique o que ocorre se não responder; depois verificar a compreensão do prazo e da ação que o suspende. |
| **R — Upwork:** marcos com valor, entrega e prazo; revisão após submissão e opção de solicitar alterações. Data de atualização não apresentada no conteúdo consultado. [Fonte oficial](https://support.upwork.com/hc/en-us/articles/211068218-How-to-use-milestones-in-fixed-price-jobs). | O assistente define etapas, mas critérios de entrega e o consenso final entre as partes precisam ser verificáveis. | Enriquecer o card de etapa com “o que será entregue” e “como conferir”; manter modelos atuais. **H:** critérios objetivos diminuem ajustes e discussões. | Testar se pagador e prestador descrevem a mesma entrega e o mesmo valor sem ajuda; medir pedidos de esclarecimento e alterações antes do aceite. |
| **R — Stripe:** uma operação mantém identificador e ciclo de estados; a documentação recomenda reaproveitar a operação na retomada, idempotência e acompanhamento por webhooks. Sem data de atualização explícita. [Fonte oficial](https://docs.stripe.com/payments/payment-intents). | O Aval guarda a tentativa em `s.ui.payment` e confirma localmente; retorno pode perder contexto ou produzir estado errado. | Uma operação persistente no servidor alimenta os mesmos componentes de status. Reabrir consulta essa operação. É referência técnica, não escolha da Stripe como provedor. | Interromper antes/depois da confirmação, repetir requisição e reenviar eventos; exigir uma única cobrança e estado final consistente. |
| **R — Mercado Pago Point:** documentação distingue contas de teste e produção e descreve testes de sucesso, falha, cancelamento e reembolso com notificações. Sem data de atualização explícita. [Fonte oficial](https://www.mercadopago.com.br/developers/pt/docs/mp-point/integration-test). | Simulação e release estão no mesmo APK, e o comprovante parece uma transação real. | Separar ambientes e evidências. Na validação de produto, manter apenas o controle de contraparte necessário; testes técnicos de falhas ficam na suíte/sandbox, fora da release. | Inspecionar o artefato final e executar cenários com credenciais de homologação; nenhum controle de sucesso manual disponível na produção. |

**H — Primeira experiência orientada ao combinado:** trocar o conteúdo do banner da home vazia por uma explicação curta do próximo passo, com as ações Cobrar/Pagar existentes. Evidência: tela 08. Benefício esperado: distinguir Aval de uma conta bancária ou vitrine de crédito. Validar com duas rodadas de cinco pagadores e cinco prestadores; isso é pesquisa qualitativa, não estimativa estatística de conversão.

**H — Cobrança compartilhável verificável:** aproveitar resumo, link e QR existentes com recebedor verificado, valor, validade e estado. Evidência: telas 53–54 mostram link e QR conceituais sem distribuição real. Validar uma jornada completa em dois aparelhos: criar, compartilhar, abrir, autenticar, retomar, aceitar e confirmar. Não exigir instalação ou conta de banco específico sem que essa restrição seja uma decisão de negócio explícita.

**H — Crédito e antecipação no momento de necessidade:** usar os cards existentes somente após o contexto do pagamento e critérios reais de elegibilidade. Evidência: tela 23 recomenda cartão com aumento de limite ainda não obtido; tela 34 oferece antecipação antes de comprovada integração. Validar se as pessoas distinguem preço do serviço, custo de financiamento e líquido a receber. Não usar contratação de crédito como principal indicador de sucesso do pagamento.

## 2 Mapa dos fluxos

### Caminhos avaliados

| Fluxo | Caminho e resultado atual | Cobertura | Lacuna ou dependência |
| --- | --- | --- | --- |
| Primeira entrada e cadastro | Entrada → “Entrar com a conta BTG” → consentimento dentro do Aval → dados sintéticos → termos → home vazia. Cancelar consentimento voltou à entrada. | **O**, telas 02–08. | Identidade real, autorização do parceiro, conta elegível, consentimento versionado, falha/recusa/expiração. |
| Autenticação recorrente | Após sair → Entrar → “Use a biometria” → “Usar senha” abre a home sem solicitar senha. | **O**, 42, 44–45. | Autenticação nativa/servidor, alternativa legítima e recuperação de acesso. |
| Pagamento iniciado pelo pagador | Ana cria combinado de R$ 18 mil → valor único → Marina → envio → contraparte aceita → Ana escolhe Pix → confirmação simulada → serviço ativo. | **O**, 10–29. | Mensagem real, consenso persistente, operação Pix e custódia reais. |
| Cobrança iniciada pelo prestador | Carlos cobra R$ 16 mil → WhatsApp interno simulado → link sem sessão → cadastro → retorno ao mesmo convite → assistente define 2 × R$ 8 mil → aceite → Pix simulado. | **O**, 51–61. | Compartilhamento externo, App Link, autenticação de retorno, confirmação das condições finais pelo prestador. |
| Entrega e conclusão | Marina envia entrega; sem anexo houve erro; adicionar foto não abriu arquivo; Ana revisa e libera R$ 18 mil; comprovante de liberação e avaliação pendente. | **O**, 30–39, 45. | Upload, integridade de provas, autorização, liquidação ao recebedor e documento verificável. |
| Cancelamento antes do aceite | Envio → cancelar → home sem convite e toast “link deixou de funcionar”. | **O**, 14–16. | Reabrir link cancelado não foi testado no Android. **C:** a página não trata explicitamente `cancelled`, embora o aceite recuse status diferente de `sent`. |
| Cancelamento após financiar | Serviço ativo oferece disputa; não foi encontrado caminho equivalente de cancelamento e devolução voluntária. | **O/C**. | Definir antes/depois da entrega, com/sem liberação parcial, tarifas e prazo de devolução. Não confundir com estorno ou disputa. |
| Disputa | Ana abre disputa de R$ 8 mil → mediação → Carlos envia resposta → “Com provas” para ambos e alteração da regra exibida. | **O**, 62–65, 68. | Decisão humana/operacional, upload real, acordo bilateral, execução do reembolso e recurso. Desfecho não executado no Android. |
| Sessão e retorno | Segundo plano → mesma home; segundo plano no Pix → mesma tentativa; sair → entrada nominal; App BTG após sair → saldo/atividades; force-stop → entrada sem Ana cadastrada. | **O**, 09, 26, 42–49. | Política de bloqueio e retenção, limpeza de dados protegidos, estado persistente e consulta ao servidor. |
| Cartão, empréstimo e saldo | Opções, valores e saldo insuficiente observados no checkout. A contratação completa desses meios não foi executada. | **O parcial/C**. | Autorização, negativa, análise, custos contratados, idempotência, conciliação e devolução por meio original. |
| Antecipação | Oferta de R$ 16.604,10 observada para entrega de R$ 18 mil. A confirmação foi inspecionada no código, não executada. | **O parcial/C**. | Decisão real, limite disponível, taxa, elegibilidade, risco e liquidação. O verificador atual não compara o valor solicitado ao limite livre. |
| Pagamento coletivo | Editor de contatos e percentuais, aceite de participantes e bloqueio até respostas existem no código. | **C**, sem percurso completo no Android. | Convites reais, consentimento ao novo rateio após recusa, timeout do grupo, recuperação de parcelas pagas, centavos e devoluções. |
| Ajuste e liberação parcial | Opções presentes na folha de revisão e implementadas por alteração local. | **O da tela/C**, sem execução dessas ramificações. | Acordo sobre saldo remanescente, novo prazo, suspensão da liberação automática e extrato consistente. |
| Recorrência, entrada e subcontratos | Rotas e ações locais presentes; há recorrência por relógio Demo, entrada fora do guardado e liberação em cascata. | **C**. | Autorizações e exceções próprias; não incluir no lançamento só porque a tela existe. |
| Conta em análise e recusada | Variantes de tela e contestação existem; o cadastro observado não passou por KYC real. | **C**. | Fornecedor/processo de identidade, SLA, revisão e retomada. |
| Ajuda, exportação, segurança e benefícios | Perfil observado; “Segurança” é informativo, “Baixar meus dados” apenas produz mensagem no código. Assistente é determinístico. | **O parcial/C**. | Atendimento com protocolo, exercício de direitos, central de segurança real e contratos dos benefícios. |

### Modelo de estados proposto

Separar três dimensões, representadas pelos chips, mensagens e linha do tempo atuais. Um único rótulo “Em andamento” não deve explicar dinheiro, trabalho e revisão ao mesmo tempo.

| Dimensão | Estados necessários e regra |
| --- | --- |
| Combinado | Rascunho → enviado → aguardando aceite → aceito. Saídas: recusado, cancelado ou expirado. Alteração material de valor, prazo ou etapas exige nova versão e novo aceite de quem for afetado. |
| Pagamento | Aguardando pagamento → processando → confirmado/valor guardado. Saídas: falhou, expirou, cancelamento solicitado, cancelado antes de liquidar. Um retorno do banco não basta para confirmar; deve haver verificação do servidor. |
| Serviço e liberação | Em execução → entrega enviada/em revisão → ajuste solicitado e reenvio, disputa/bloqueado ou liberação solicitada → processando liberação → liberado. “Disponível na conta” depende da confirmação do recebimento. |
| Devolução | Solicitada → em análise quando aplicável → processando → devolvida ou falha com recuperação. Preservar transação original, parte devolvida e saldo ainda protegido. |

Fluxo feliz de referência: **combinado aceito por ambos → pagamento confirmado → prestador autorizado a começar → entrega registrada → revisão → liberação confirmada → comprovante e histórico**. Qualquer timeout entre solicitação e confirmação mantém estado pendente, nunca gera sucesso ou falha definitiva por suposição.

### Política de sessão proposta

| Situação | Observado | Comportamento de aceite proposto |
| --- | --- | --- |
| Segundo plano breve | Home e Pix permaneceram. | Preservar contexto. Revalidar sessão/status ao retornar; bloquear conforme política de tempo, risco e bloqueio do aparelho. Não chamar isso de logout. |
| Voltar/fechar uma tela | O Back do Android na folha de aprovação voltou à home e fechou também a folha. | Primeiro fechar teclado/folha; depois voltar à tela anterior. Saída de formulário preserva rascunho ou explica seu descarte. |
| Processo encerrado | Cadastro de Ana deixou de existir após force-stop. | Dados de negócio no servidor; cache/rascunho durável quando apropriado. Reabrir pode pedir autenticação, mas deve recuperar a mesma operação. |
| “Sair do app” | Flag local muda; nome fica. App BTG ainda revela valores e atividades. | Renomear para “Sair da conta”, invalidar a sessão e limpar dados protegidos. Rota, histórico e retorno não podem reapresentar informações privadas. |
| Reconhecer o usuário | Primeiro nome permanece após sair na mesma sessão. | Decidir se existe “Lembrar de mim”. Pode manter identificação mínima autorizada; não manter saldo, extrato, endereço ou acesso implícito. Oferecer “Usar outra conta”. |
| Recentes do Android | Prévia mostrou saldo e limite. | Definir proteção da prévia e mascaramento ao perder foco conforme política do produto; testar explicitamente. Não confundir com impedir todo compartilhamento de comprovante. |

### Da demonstração à operação real

| Área | O que existe hoje | O que precisa funcionar de verdade |
| --- | --- | --- |
| Ambiente release | `?app=1` adiciona Demo; perfis, relógio e cenários acompanham os assets. | Artefatos separados; release sem dados seed, seletor de pessoas, relógio, apresentação ou handlers de sucesso simulado. Não basta esconder o botão com CSS. |
| Identidade e parceiro | Ana fixa, consentimento interno e `loggedIn=true`. | Identidade autenticada, autorização do parceiro, retorno validado e vinculado à sessão, revogação e erro recuperável. |
| Estado e autorização | `sessionStorage` e verificações locais; partes identificadas em vários pontos pelo nome. | API com banco de dados, IDs imutáveis, autorização por usuário/operação, histórico de eventos e regras executadas no servidor. |
| Pix, saldo e cartão | QR como ícone, código com “demo”, saldo/limite alterados localmente. | Provedor contratado, criação de cobrança, QR/código válidos, expiração, confirmação, consulta, conciliação e devolução. Segredos permanecem no servidor. |
| Valor guardado e liberação | Contadores e ledger locais. | Arranjo de guarda de recursos definido com o parceiro, segregação e conciliação operacional; liberação autorizada, contabilizada e confirmada. Não presumir que receber um Pix sozinho implementa proteção. |
| Link e WhatsApp | Tela imita mensagem; abertura troca o perfil no mesmo dispositivo. | Link em domínio controlado, token não previsível, validade/revogação, minimização de dados públicos, compartilhamento nativo e App Links verificados. Compartilhar não prova entrega ou leitura. |
| Entregas e provas | Objetos `{kind, caption}`. | Seleção/captura real, upload com progresso e repetição, permissões, visualização, remoção confirmada, metadados e conservação de evidências. |
| Prazo automático | Data-base 04/10/2026 e avanço manual da Demo. | Relógio e agendador no servidor, timezone, calendário aplicável, notificações e execução idempotente; bloquear liberação durante ajuste/disputa conforme regra contratada. |
| Crédito e antecipação | Taxas, notas, limites, concessão e contratos calculados localmente. | Política e decisão do parceiro, proposta válida, custos e aceite, negativas, limite comprometido atomicamente, desembolso e cobrança. |
| Disputa | Matriz usa existência/quantidade de provas e resposta. | Processo de análise, responsáveis, contraditório, decisão fundamentada, acordo das partes quando aplicável e execução financeira auditável. |
| Seguros, NFS-e e benefícios | Apólices/numeração/benefícios e emissão derivados de regras locais. | Contratos e integrações que sustentem cada promessa; se não existirem, não ofertar esses módulos no escopo lançado. |
| Avisos e suporte | Notificações em array local e preferências na memória da sessão. | Eventos do servidor, entrega por canal autorizado, permissão nativa, falhas de entrega e suporte com protocolo. |
| Copiar, compartilhar e exportar | Mensagens de sucesso sem os efeitos correspondentes em diversos handlers. | Clipboard/compartilhamento de fato, geração do arquivo correto, sucesso após conclusão e falha com alternativa. |

**Simulações permitidas nas validações de produto:** um painel de teste separado pode representar a contraparte aceitando, recusando, enviando entrega ou respondendo a um ajuste. Cada ação deve indicar ator e ambiente. Pagamento, autorização, risco, liquidação e comprovantes não podem se passar por reais. Testes técnicos devem usar sandbox do provedor e eventos controlados pela suíte, sem expor “simular sucesso” no aplicativo release.

## 3 Achados priorizados

**P0:** impede lançamento com dinheiro/dados reais ou submissão pretendida. **P1:** deve ser resolvido antes do piloto externo do fluxo correspondente. **P2:** evolução posterior, sem afetar integridade do pagamento. A ordem considera gravidade, exposição no fluxo e efeito na compreensão, confiança e conclusão; não há telemetria para estimar frequência real de usuários.

Esforço de implementação após decisões e acesso a APIs: **S** até 2 dias, **M** 3–5 dias, **L** 1–2 semanas, **XL** múltiplas semanas/integrações. São ordens de grandeza, não orçamento nem soma de prazo: há sobreposição entre itens. Responsabilidade/etapas estão na seção 5.

| ID e etapa | Evidência | Problema | Impacto e exposição | Recomendação concreta | Prioridade | Esforço |
| --- | --- | --- | --- | --- | --- | --- |
| A01 Autenticação | **O/C**, 03, 44–45; `session.js` 33–37, 62. | Biometria/senha são botões que autorizam localmente; falso contexto “app BTG”. | Todos os acessos; falsa segurança e identidade não comprovada. | Integração real, autenticação e retorno validados; fallback real; marcar toda encenação em homologação. | P0 | XL |
| A02 Saída da conta | **O/C**, 42–43; rota `btg` pública em `main.js`. | Saldo e atividades aparecem após logout. | Qualquer usuário que sai; exposição de dados na versão real. | Guardas de todas as superfícies privadas, invalidação de sessão e limpeza de cache; teste pelo histórico e pelo CTA App BTG. | P0 | M + dependência A01 |
| A03 Operação financeira | **O/C**, 25–29; `payment.js`, servidor estático. | Cliente decide que pagou e que o valor está guardado. | Todos os pagamentos; sucesso sem lastro financeiro. | Backend transacional, integração, idempotência, conciliação e estados pendentes. | P0 | XL |
| A04 Continuidade | **O/C**, 49; `store.js` 7–24. | Cadastro/estado do teste perdidos no reinício do processo. | Retomadas e recuperação; perda de confiança e risco de repetir pagamento. | Persistência de negócio no servidor e retomada pelo ID; armazenamento local só como apoio. | P0 | L/XL com A03 |
| A05 Demo na release | **O/C**, todas as telas; APK igual ao release. | Troca de perfil, relógio, seeds e simulações no artefato final. | Toda a experiência; mistura de atores e resultados fictícios. | Separar build/configuração/dados; remover também atalhos de contraparte e simulação embutidos nas telas. | P0 | M, mais substituições XL |
| A06 Provas de entrega | **O/C**, 31–37, 62, 65. | Foto não é arquivo; disputa nasce com provas fictícias preenchidas. | Revisão, disputa e liberação; decisão sem evidência real. | Upload real e campos vazios na release, com ajuda em placeholder; validar visualização e recuperação. | P0 | L |
| A07 Comprovantes | **O/C**, 27–28, 39; `money.js` 40, `btg-kit.js` 97. | Simulação parece pagamento real; origem mostra conta BTG mesmo no Pix externo; código gerado localmente. | Toda confirmação; comprovação enganosa. | Comprovante baseado no registro confirmado, meio/origem corretos, recebedor final e destino do guardado, hora/ID; homologação permanentemente marcada. | P0 | M + A03 |
| A08 Prazo e proteção | **O/C**, 02, 11, 24, 37; `clock.js`. | “Até você aprovar” contradiz o autoaceite; relógio e execução locais. | Todos os aceites e liberações por silêncio. | Explicitar exceção em cada decisão, data/hora e início da contagem; rotina confiável com lembretes e bloqueios. | P0 | L |
| A09 Cancelamento e devolução | **O/C**, 15, 29; `protected.js`, `perks.js`. | Convite cancelado desaparece; não há tratamento explícito da página cancelada; pós-financiamento depende de disputa. | Saídas e exceções de pagamento; dúvida se houve cobrança/devolução. | Estados separados de convite cancelado e dinheiro devolvido; política por estágio e por meio; preservar histórico e motivo. | P0 | L/XL |
| A10 Promessas operacionais | **O/C**, 29, 39, 63; seguros, invoices e benefícios locais. | Banco, seguro, renda, nota fiscal e decisão são apresentados como contratados/executados. | Todas as telas que usam essas garantias. | Matriz de promessas com operador, contrato, integração e prova. Publicar só o que for sustentado; adequar escopo, sem trocar identidade. | P0 | XL/negócio |
| A11 Publicação Android | **C/R**, targetSdk 34. | Build abaixo do requisito atual de novas submissões Android comuns. | Publicação Google Play. | Planejar targetSdk/compileSdk e testes de compatibilidade; confirmar situação da conta e eventuais exceções no Play Console. | P0 para loja | M/L |
| A12 Link e recebedor | **O/C**, 53–54; token `PG-001`, troca automática de ator. | Link/QR não implementam distribuição/autenticidade; endereço completo antes de login. | Aquisição e abertura de cobrança; confiança e privacidade. | App Link real, token não previsível, verificação do recebedor e dados públicos mínimos; sem troca de identidade na release. | P0 | L |
| A13 Enviar versus pagar | **O**, 12–19. | “Enviar pagamento” só envia convite; exemplo de aviso associa aceitar a dinheiro guardado. | Todo fluxo iniciado pelo pagador. | “Enviar combinado”; tela “Aguardando aceite”; só “Valor guardado” após confirmação. | P1 | S |
| A14 Primeira experiência | **O**, 05–08. | Limites e oferta de empréstimo precedem entendimento do produto e ocupam a home vazia. | Todo primeiro uso. | Resumir dados importados e termos; detalhes expandíveis; banner existente orienta primeiro combinado. Crédito aparece no contexto do checkout. | P1 | M |
| A15 Checkout e ofertas | **O/C**, 23–24. | Pix pré-selecionado fora da primeira área visível; recomendação de cartão depende de aumento de limite. | Pagamentos acima do saldo; seleção pouco perceptível e promessa de crédito. | Resumo de método/total sempre visível; elegibilidade antes da recomendação; comparar custo total e preservar escolha. | P1 | M |
| A16 Assistente e negociação | **O/C**, 56–58, 37. | Definir etapas na cobrança passa obrigatoriamente pelo assistente; conferência sugere que está tudo certo com evidência mínima. | Aceite e revisão; fricção e confiança indevida. | Oferecer escolha manual com opções/campos já existentes; sugestões editáveis e novo aceite de condições; não certificar entrega. | P1 | M/L |
| A17 Disputa imparcial | **O/C**, 63–65, 68. | “Quem documenta rápido tende a vencer” e regra de reembolso mostrada antes da defesa; matriz fixa. | Toda disputa; impressão de julgamento automático e parcial. | Exibir “Aguardando resposta até…”; separar coleta de evidências, proposta e decisão fundamentada; remover linguagem de vitória. | P1, P0 para resolver dinheiro | L/XL |
| A18 Datas e SLA | **O/C**, 27, 63; data-base e `addDays(7)`. | Comprovante de 04/10 no teste de 11/10; “5 dias úteis” usa cálculo de 7 dias corridos. | Todos os prazos e comprovantes. | Data/hora do servidor, timezone e calendário explícitos; prazo contratual e UI derivados da mesma regra. | P0 para dinheiro | M/L |
| A19 Sobreposição | **O**, 08, 27, 37. | Demo cobre ações; Menu cobre conteúdo; balão de apresentação compete com comprovante/CTA. | Telas centrais no Android. | Remover apresentações da release; reservar espaço ao Menu existente; eliminar camadas redundantes de sucesso. | P1 | S/M |
| A20 Acessibilidade visual | **C + medição**, `bk-line`: branco a 66% em `#2d5aaf` ≈ 3,85:1 para texto 16 px. | Contraste insuficiente para texto normal. | Saldo/limite na home. | Reusar cor/opacidade de texto mais contrastante já presente; validar todas as combinações de tokens. | P1 | S |
| A21 Acessibilidade de controles | **O/C**, XML 09; `option()` e abas não expõem seleção semanticamente. | Ícones de topo ≈ 40 dp e olho ≈ 37 dp; estado das opções é visual; olho sem nome no XML apesar de aria-label no HTML. | Navegação, privacidade e escolha do pagamento. | Áreas mínimas 48 dp, semântica radio/tab, foco e teste real de TalkBack na WebView. Não atribuir o XML sozinho ao leitor de tela. | P1 | M |
| A22 Erros e recuperação | **O/C**, 06, 32; toast de 3,5 s. | Erro aparece distante do campo; termos obrigatórios estavam abaixo da dobra; não há estados reais de falha financeira. | Cadastro, formulários e falhas de rede. | Erro persistente associado ao campo, foco na correção; preservar dados; distinguir offline, processando e falha confirmada. | P1 | M/L |
| A23 Auxiliares sem efeito | **C/O parcial**, perfil; `copied`, `downloadData`, `shareProof`. | Copiar/exportar/compartilhar anunciam sucesso sem concluir a operação; “Segurança” não abre controles. | Suporte, comprovantes e privacidade. | Implementar efeito e confirmação real ou retirar ação do escopo até disponível; dar acesso a atendimento com protocolo. | P1 | M/L |
| A24 Antecipação e grupo | **C**, `anticipationCheck`, `confirmAnticipation`, `splitEditor`. | Limite de antecipação não bloqueia solicitação; recusa no grupo redistribui parcelas. | Caminhos opcionais com consequências financeiras. | Limite validado atomicamente; qualquer aumento de quota exige novo aceite. Validar ou adiar os módulos. | P0 se lançados | L/XL |
| A25 Retorno e privacidade | **O/C**, 38, 46; WebView `setTextZoom(100)`. | Back sai da tela sob o modal; dados visíveis em recentes; fonte fixada requer validação de escala. | Retomadas, uso compartilhado e acessibilidade. | Back fecha folha antes de navegar; política de privacidade para prévia; respeitar ampliação de texto sem cortar controles. | P1 | M |
| A26 Escopo e nomenclatura | **O/C**, menu, perfil e cadastro. | “Serviços”, “Pagamentos”, “Movimentos”, “Extrato”; versões 1.0/5.0; “marco” exige conhecimento. | Orientação e suporte. | Glossário por conceito, versão única obtida do build, “etapa (marco)” na introdução; consistência sem renomear tudo indistintamente. | P2; versão antes da loja | S/M |

O requisito de loja em A11 foi verificado na documentação oficial: desde 31/08/2026, novas submissões e atualizações Android comuns devem visar API 36 ou superior. A página menciona possibilidade de extensão até 01/11/2026, mas a situação deste aplicativo no Play Console não foi verificada. [Google Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB).

A20–A21 usam como referência contraste de 4,5:1 para texto normal, 3:1 para texto grande e alvos de toque de pelo menos 48 × 48 dp. Não é uma certificação de acessibilidade. [Android Developers](https://developer.android.com/guide/topics/ui/accessibility/apps).

## 4 Revisão de textos

As versões a seguir são propostas para os mesmos componentes. Expressões entre colchetes dependem de dados reais ou decisão de negócio. Não trocar uma promessa simulada por uma frase definitiva antes de implementar o serviço que a sustenta.

| Tela ou etapa | Texto atual | Texto sugerido | Por quê ou condição |
| --- | --- | --- | --- |
| Entrada | “Pague o que combinou. O dinheiro fica guardado até a entrega.” | “Pague serviços com o valor guardado e liberação por entrega.” | Não equiparar entrega a liberação. Mostrar as condições antes do aceite. |
| Consentimento interno atual | “Você está no app BTG” | Homologação: “Simulação de autorização bancária”. Produção, antes de abrir: “Autorize no app do banco”. | Só dizer onde a pessoa está quando isso for verdade. |
| Dados importados | “Você volta para o Aval com os seus dados. Não precisa digitar nada.” | “Autorize o compartilhamento para continuar no Aval.” | Reduz texto e evita garantir que nunca haverá complementação cadastral. |
| Limites do cadastro | “São só seus, aprovados pelo BTG. Não é um limite dividido com quem você contrata.” | “Limites disponíveis para sua conta.” | Detalhes de elegibilidade/custo no contexto correto; só exibir aprovação confirmada. |
| Início vazio | “Nada por aqui. Use Cobrar ou Pagar para começar.” | “Seu primeiro pagamento começa com um combinado. Escolha Cobrar ou Pagar.” | Aproveita as ações existentes e explica a primeira tarefa. |
| Criação pelo pagador | “Enviar pagamento de R$ 18.000,00” | “Enviar combinado de R$ 18.000,00” | Ainda não movimenta dinheiro. |
| Envio | “Enviado para Marina Costa Interiores” | “Combinado enviado. Aguardando Marina aceitar.” | Deixa a próxima ação e o responsável explícitos. |
| WhatsApp | “Mensagem pronta no WhatsApp” | Antes de abrir o compartilhamento: “Mensagem pronta para compartilhar”. | Não afirmar que outro aplicativo foi aberto nem que a mensagem foi enviada. |
| Aceite do prestador | “Aceitar o pagamento” | “Aceitar combinado” | Aceitar não comprova dinheiro recebido. |
| Aviso de exemplo após convite | “Quando aceitarem” + “R$ 18.000,00 guardados… Pode começar.” | “Exemplo de aviso após a confirmação do pagamento: ‘Valor guardado. Você pode iniciar a etapa’.” | Condição correta e marca de exemplo. Não confundir aceite com pagamento. |
| Regra de guarda | “Fica guardado até você aprovar.” | “Liberação após sua aprovação ou ao fim do prazo de revisão.” | A regra deve estar próxima da ação; completar com data/hora e efeito de ajuste/disputa. |
| Prazo automático | “Sem resposta em 7 dias, libera sozinho” | “Após a entrega, revise até [data e hora]. Sem resposta, o valor será liberado.” | Mais específico; prazo depende da regra escolhida e do evento inicial. |
| Checkout Pix | “Pagar R$ 18.000,00 com Pix” | Se só gera cobrança: “Gerar Pix de R$ 18.000,00”. | O verbo corresponde ao efeito imediato. Para débito real, manter “Pagar”. |
| Pix aguardando | “De outro banco, a confirmação chega em segundos. Aqui, simule a confirmação.” | Release: “Aguardando pagamento. Você pode sair e acompanhar depois.” | Acrescentar validade do código, atualização de status e identificação da operação; sem promessa absoluta de tempo. |
| Confirmação de funding | “Pagamento confirmado” | “Valor guardado: R$ 18.000,00” | Complemento: “Marina recebe após a liberação de cada etapa”. Só após confirmação real. |
| Saldo insuficiente | “Seu saldo não cobre” | “Faltam R$ 3.000,00 no saldo desta conta.” | Ajuda a decidir. Oferecer Pix/outra forma sem induzir crédito. |
| Cartão recomendado | “com um aumento pequeno de limite” | “Precisa de R$ 3.000,00 a mais de limite. Sujeito à aprovação.” | Não qualificar como pequeno nem prometer concessão. |
| Entrega sem prova | “Inclua a descrição e pelo menos um anexo.” | “Adicione uma foto, vídeo ou documento da entrega.” | No caso observado a descrição já existia; apontar o erro concreto. |
| Revisão pelo assistente | “Parece estar tudo certo. A decisão é sua.” | “Confira a entrega e os itens combinados antes de liberar.” | Não sugerir verificação de qualidade a partir de legenda e contagem de anexos. |
| Aprovação | “Aprovar e liberar R$ 18.000,00” | “Liberar R$ 18.000,00 para Marina” | Manter, na mesma folha, etapa, motivo, saldo que fica guardado e regra de recuperação. |
| Antecipação concluída | “Já está na sua conta BTG.” | “Antecipação em processamento” ou “Valor disponível na conta”, conforme confirmação. | Exibir líquido, taxa e prazo reais. |
| Disputa | “Quem documenta rápido tende a vencer: envie fotos e vídeos logo.” | “Envie sua versão e as provas até [data e hora]. As duas partes serão ouvidas.” | Orienta sem antecipar vencedor. |
| Disputa sem defesa ainda | “Prestador sem nenhuma evidência: reembolso…” | “Aguardando resposta do prestador até [data e hora].” | Resultado não deve ser inferido antes de concluir a análise. |
| Convite cancelado | “Pagamento cancelado. O link deixou de funcionar.” | “Combinado cancelado. Nenhum pagamento foi feito.” | Usar apenas quando esse for o estado financeiro confirmado. Manter página com status cancelado. |
| Perfil | “Sair do app” | “Sair da conta” | Diferencia logout de fechar ou colocar em segundo plano. |
| Exportação | “Pedido registrado. O arquivo chega em até 48 horas.” | “Solicitação [protocolo] recebida. Disponível até [prazo].” | Somente após registrar o pedido no serviço responsável; sem serviço, não anunciar registro. |
| Entrada antecipada, código | “Vai direto ao prestador, sguardado” | “Vai direto ao prestador e fica fora do valor protegido.” | Correção do texto encontrado em `client.js`; ramificação não executada no Android. |

**Glossário proposto:** “combinado” para termos ainda não financiados; “pagamento” para a movimentação que guarda o dinheiro; “etapa” para uma entrega parcial; “liberação” para saída do valor protegido; “recebimento” para chegada à conta do prestador; “devolução” para retorno confirmado ao pagador. “Cancelar” exige explicar o que está sendo cancelado. É possível apresentar “etapa (marco)” uma vez e manter consistência depois.

## 5 Plano por fases

### Fase 0 Definir o produto operável

**Objetivo:** delimitar qual promessa poderá ser cumprida no primeiro lançamento. Ordem de grandeza: 3–5 dias úteis de trabalho conjunto após disponibilidade dos responsáveis; negociações externas não cabem nessa estimativa.

**Responsáveis propostos:** Produto, Tecnologia, Operações e responsáveis jurídico/comercial do parceiro.

1. Escolher o público e o serviço inicial; decidir se conta BTG é requisito e qual a relação formal do Aval com o operador.
2. Mapear por onde passa o dinheiro, quem guarda, quem recebe, quem cobra tarifas e quem executa devoluções. Explicar o seguro de arbitragem “incluído”, sem deixar indeterminado quem o paga e o líquido do prestador.
3. Aprovar regras de prazo, silêncio, ajuste, cancelamento, disputa e consenso das partes. Resolver diferenças entre 7 dias, 3 dias de recorrência e dias úteis da mediação.
4. Definir política de sessão e dados pessoais da seção 2.
5. Fixar escopo inicial proposto: combinado individual, aceite bilateral, um meio de pagamento operante, guarda/liberação, prova de entrega, ajuste, disputa com atendimento e devolução. Crédito, antecipação, seguro opcional, cofrinho, benefícios, rateio e recorrência entram apenas se houver operação pronta e validação própria.

Essa redução é de escopo de lançamento, não de identidade ou design. Componentes e módulos podem ser preservados para fases futuras; não precisam ser redesenhados.

**Saída exigida:** matriz “promessa → operador → integração → responsável → comprovação”, diagrama dos estados, regras de dinheiro e backlog aprovado. A01, A03, A08–A12, A17–A18 e A24 dependem dessas decisões. Não iniciar piloto com dinheiro real enquanto houver promessa central sem operador.

### Fase 1 Corrigir o entendimento e isolar os testes

**Objetivo:** permitir validação de produto sem confundir protótipo com operação financeira. Ordem de grandeza: 1–2 semanas; não equivale à conclusão das integrações.

**Responsáveis propostos:** Produto/UX para textos e hierarquia, desenvolvimento da interface/Android para comportamento, QA para regressão.

1. Separar ambiente e identificação de testes; remover da distribuição candidata a release todos os perfis, valores preenchidos, relógio e controles de simulação. Manter a contraparte controlada apenas em ambiente autorizado de validação.
2. Aplicar a revisão de texto prioritária: enviado/aceito/guardado/liberado, origem do Pix, fim do prazo e logout. A13 e parte de A07–A08.
3. Reordenar conteúdo dentro das telas existentes: começo da tarefa antes de ofertas, estado atual antes de benefícios, recebedor/método/total antes de confirmar. A14–A16.
4. Resolver sobreposição da Demo/balões e espaço do Menu; padronizar o Back para folhas. A19 e A25.
5. Corrigir contraste, alvos, identificação e estados selecionados; tornar erros persistentes e locais. A20–A22.
6. Fechar a rota que expõe dados após logout, deixando claro que o controle definitivo de acesso dependerá do servidor. A02 não se encerra só com essa correção de interface.

**Saída exigida:** duas rodadas qualitativas com pagadores e prestadores; nenhuma pessoa interpreta convite como pagamento confirmado; ninguém confunde saldo protegido com valor recebido; nenhum caminho da versão de teste produz comprovante sem a marca de teste. Inventário de componentes confirma ausência de nova identidade.

### Fase 2 Implementar o núcleo real e a recuperação

**Objetivo:** uma operação rastreável entre duas contas e dispositivos. Estimativa inicial de 6–10 semanas para uma equipe pequena dedicada, condicionada à disponibilidade de APIs, homologação e regras fechadas. É uma hipótese de planejamento a refinar com Engenharia; não uma data de lançamento.

**Responsáveis propostos:** backend/integrações, Android/interface, segurança, QA e operador financeiro; Produto acompanha os contratos de estado.

| Frente | Entrega concreta | Dependência | Evidência de conclusão |
| --- | --- | --- | --- |
| Identidade e sessão | Autenticação, autorização por operação, retorno do parceiro, revogação e recuperação. | Fase 0 e credenciais de homologação. | Duas identidades isoladas, logout efetivo e retorno correto após falha/interrupção. |
| Combinado | Persistência, versões, aceite de ambas as partes, vínculo com recebedor e expiração. | Identidades/IDs definitivos. | Mudança material invalida os aceites necessários; nenhum ator pode aceitar por outro. |
| Pagamento | Criação da tentativa, consulta, webhooks, idempotência, expiração e reconciliação. | Provedor e arranjo de guarda. | Um pagamento por intenção, recuperação após timeout e nenhuma confirmação só pelo dispositivo. |
| Link e retorno | Compartilhamento, App Links, retomada após login e links cancelados/expirados. | Domínio controlado e combinado persistente. | Jornada completa em dois aparelhos, com/sem aplicativo instalado e sem exposição excessiva antes de autenticar. |
| Entrega e revisão | Arquivos reais, upload recuperável, critérios da etapa e pedido de ajuste. | Armazenamento e política de retenção. | As duas partes abrem a mesma evidência; falha de upload não equivale a entrega enviada. |
| Liberação e devolução | Solicitação, confirmação, regras automáticas no servidor e contabilidade consistente. | Guarda, identidade e estados financeiros. | Valor solicitado/confirmado reconciliado; disputa e ajuste impedem transição incompatível. |
| Operação e suporte | Histórico, alertas, fila responsável, intervenção auditada e atendimento. | Equipe e SLAs contratados. | Um caso com falha é localizado por ID e resolvido sem alterar dados manualmente sem registro. |
| Documentos e comunicação | Comprovantes, termos versionados e avisos reais. | Eventos confirmados e dados corretos. | Documento e aplicativo mostram o mesmo valor, partes, estado, horário e identificador. |

Manter a camada visual existente. A presença de WebView não obriga reescrever a interface; validar sua adequação e implementar as pontes nativas necessárias para autenticação, arquivos, compartilhamento e retorno. A decisão arquitetural deve considerar os testes, não um desejo de reformulação.

**Saída exigida:** todos os testes P0 da seção 6 aprovados em homologação; conciliação sem diferença não explicada; nenhuma ação de dinheiro depende de estado confiado ao cliente. A03–A04, A06–A09, A12 e A18 são gates dessa fase.

### Fase 3 Homologar e liberar um piloto controlado

**Objetivo:** comprovar uso e operação fora do roteiro de demonstração. Ordem de grandeza: 2–3 semanas após Fase 2, ajustada ao volume, prazos de revisão e processo do parceiro.

**Responsáveis propostos:** QA, Operações, Produto, parceiro financeiro e responsáveis pela distribuição.

1. Testar aparelhos físicos, versões Android suportadas, teclado, gestos/Back, processo morto, fonte ampliada, TalkBack e conectividade instável.
2. Atualizar a configuração Android necessária à publicação e executar homologação; conferir versão, permissões, descrição de privacidade e declarações aplicáveis ao produto. Não presumir aprovação da loja.
3. Rodar piloto com participantes consentidos e limites operacionais definidos. O número de usuários e o limite monetário são decisões do parceiro/Produto, não definidos por esta auditoria.
4. Medir o funil até **recebimento confirmado**, acompanhar disputas e reconciliar recursos. Realizar exercício de falha do provedor e de atendimento.
5. Definir mecanismo operacional para interromper novas operações preservando consulta, suporte e recuperação das existentes. Não usar rollback de interface como solução para movimentação já executada.

**Saída exigida:** nenhum P0 aberto, P1 dos caminhos lançados resolvidos, suporte capaz de resolver exceções e resultados do piloto atendendo aos critérios acordados. A publicação só ocorre quando o produto e o operador sustentam todas as promessas visíveis.

### Fase 4 Evoluir os módulos adicionais

Priorizar por necessidade observada, usando as mesmas telas/componentes:

- **Antecipação:** quando prestadores demonstrarem necessidade de caixa; validar líquido, taxa, limite, risco e situação após disputa.
- **Crédito/cartão:** quando falta de saldo impedir pagamentos que os usuários desejam concluir; separar financiamento de contratação do serviço e validar custo total e consentimento.
- **Rateio:** quando houver demanda recorrente de pagadores conjuntos; resolver recusa, mudança de quota, abandono e devolução de quem já pagou.
- **Recorrência:** depois de autorização, cancelamento e falha por ciclo funcionarem; nenhuma entrega deve ser gerada automaticamente como fato consumado.
- **Seguro, benefícios, cofrinho e subcontratação:** somente com contratos, responsabilidade operacional e ganho para a jornada demonstrados.

O assistente pode ajudar a estruturar o combinado, mas não deve ser obrigatório para uma configuração simples nem ser apresentado como auditor da qualidade da entrega. Uma ferramenta baseada em regras pode ser útil; não precisa ganhar IA generativa para resolver os problemas identificados.

## 6 Critérios de aceite e testes

**Estes são critérios propostos para a implementação futura.** Não devem ser confundidos com testes já aprovados. A execução desta auditoria está registrada no mapa de fluxos e no índice de evidências.

### Matriz funcional e de recuperação

| Teste | Cenário | Aceite verificável | Achados cobertos |
| --- | --- | --- | --- |
| T01 Autenticação real | Login válido, cancelamento biométrico, biometria indisponível e alternativa. | Cancelar não autentica; alternativa exige credencial válida; identidade vem do serviço autorizado. Nenhum botão muda sozinho o usuário autenticado. | A01 |
| T02 Logout | Sair e abrir App BTG, histórico, notificações e rotas privadas. | Nenhum saldo/atividade/documento pessoal aparece sem autenticação; sessão anterior inválida; identificação mínima só conforme política. | A02, A25 |
| T03 Segundo plano | Pausar no combinado, checkout e Pix; retornar após intervalo curto, timeout e bloqueio do aparelho. | Rascunho/contexto preservados; desbloqueio conforme política; estado atualizado sem pagamento duplicado. | A04, A25 |
| T04 Processo morto | Encerrar após criar cobrança, após enviar pagamento e antes de receber confirmação. | Reabrir encontra a mesma operação no servidor. Estado incerto aparece como pendente. Cadastro não desaparece. | A03–A04 |
| T05 Retorno externo | Login/pagamento no parceiro concluído, cancelado, sem app instalado e callback repetido/inválido. | Retorno validado, mesma operação e mesmo usuário; cancelamento permite continuar; callback sozinho não confirma dinheiro. | A01, A12 |
| T06 Release limpa | Instalar artefato final em aparelho limpo e inspecionar pacote/configuração. | Sem Demo, relógio, perfis sintéticos, campos preenchidos de exemplo, ações simuladas ou credenciais de teste. Produção rejeita eventos/clientes de homologação. | A05 |
| T07 Consenso | Prestador sugere etapas; pagador altera valores, entrega ou prazo. | As duas partes veem e aceitam a versão final antes de financiar/iniciar, conforme regra. Uma alteração não é aceita silenciosamente em nome da outra parte. | A12, A16 |
| T08 Formulários | Valor zero/inválido, prazo passado, ausência de recebedor, erro no CEP e campos longos. | Nenhum valor fictício enviado; erro junto ao campo, foco e dados preservados. Endereço manual funciona se consulta falhar. Campos opcionais identificados. | A14, A22 |
| T09 Identidade e valores | Revisar cada confirmação e comprovante pelos dois lados. | Pagador, recebedor final, operador de guarda, valor do serviço, tarifas, total debitado, líquido e etapa aparecem quando relevantes, sem inconsistência entre resumo e CTA. | A07, A10, A15 |
| T10 Pix | Gerar QR/código; copiar e colar em app compatível; expirar e regenerar. | Código real com valor/recebedor corretos; clipboard contém o código; expiração explícita; nova tentativa não duplica recursos nem perde histórico. | A03, A12, A23 |
| T11 Timeout e rede | Desconectar antes/depois do envio, atrasar resposta e reabrir. | Sem rede é diferente de falha confirmada. Tela permite consultar/acompanhar. Só oferecer nova cobrança quando o estado permitir. | A03–A04, A22 |
| T12 Repetição e concorrência | Duplo toque, requisição repetida, evento duplicado/fora de ordem e duas sessões. | Um único efeito financeiro. Evento antigo não regride pagamento confirmado. Resultado idêntico no aplicativo e na conciliação. | A03, A24 |
| T13 Cancelamento | Cancelar convite antes/depois do aceite e concorrer com confirmação de pagamento. | Link mostra estado verdadeiro; cancelar convite não promete devolver recursos. Se o dinheiro chegou, fluxo adequado de devolução; nenhum sucesso indevido. | A09, A13 |
| T14 Devolução | Total/parcial, falha no provedor e retomada; operação com liberação parcial. | Histórico ligado ao pagamento original, montante restante correto e prazo/status consultáveis. Repetir não devolve duas vezes. | A03, A07, A09 |
| T15 Evidência | Upload interrompido, permissão negada, arquivo inválido, substituição e visualização pelo outro usuário. | Sem upload confirmado não há anexo concluído; repetir preserva o restante; ambas as partes veem o arquivo correto e a versão da entrega. | A06, A22 |
| T16 Aprovação | Revisar, cancelar confirmação, aprovar e repetir aprovação. | Cancelar não libera; autenticação proporcional ao risco; valor correto liberado uma vez; status processando até confirmação; recebedor e saldo coerentes. | A03, A07–A08 |
| T17 Ajuste e prazo | Pedir ajuste antes do limite, reenviar entrega, perder conectividade perto do vencimento. | Regra de contagem explícita e única; rotina automática não vence a disputa/ajuste já registrado; aviso informa data/hora real. | A08, A18 |
| T18 Disputa | Abrir, responder, vencer prazo, solicitar mediação/perícia e executar decisão. | Valor afetado bloqueado; nenhum resultado definitivo antes do devido processo; evidências acessíveis, decisão fundamentada e execução auditada. | A06, A09, A17–A18 |
| T19 Crédito e antecipação | Limite insuficiente, consumido por outra sessão, oferta expirada, negativa e consentimento cancelado. | Sem promessa de aprovação prévia; cotação/custo e líquido corretos; limite respeitado no servidor; não liberar porque o botão estava habilitado. | A15, A24 |
| T20 Rateio | Convidado recusa/expira; um já pagou; percentuais geram resto de centavos. | Soma exata, novo valor exige aceite, parcela já paga preservada/devolvida conforme política, prazo de financiamento definido. | A24 |
| T21 Recorrência | Autorização revogada, saldo insuficiente, ciclo repetido e entrega não realizada. | Nenhum débito sem autorização; nenhum comprovante/entrega fabricados; falha por ciclo visível e recuperável. | A03, A10, A24 |
| T22 Arquivos e suporte | Copiar, compartilhar, baixar contrato/dados e abrir atendimento. | Efeito verificável, conteúdo correto, protocolo real, falha compreensível. Nunca toast de sucesso para operação que não ocorreu. | A23 |
| T23 Loja e versão | Instalação/upgrade da candidata a release e checagem no Play Console. | Configuração atende à política aplicável; versão única, permissões justificadas e upgrade preserva conta/operações. | A11, A26 |

Devolução deve ter tratamento ligado à operação original. Como referência específica de Pix, o Banco Central orienta a funcionalidade de devolução da transação recebida, em vez de um novo Pix, no caso explicado em sua FAQ. Isso não substitui a definição do fluxo contratual do Aval. Fonte atualizada em **29/05/2025**, consultada em 11/10/2026: [Banco Central — devolução com Pix](https://bcb.gov.br/meubc/faqs/p/devolucao-de-dinheiro-com-pix).

### Acessibilidade e qualidade da interface

1. **TalkBack:** percorrer entrada, cadastro, checkout, Pix, entrega, revisão e disputa. Nome, papel, estado e ordem de leitura devem permitir concluir sem visão. Testar especialmente olho, opções de pagamento e abas. O XML atual não substitui esse teste.
2. **Seleção e foco:** anunciar método selecionado, aba ativa e switches. Ao abrir folha, foco entra nela; conteúdo ao fundo não recebe interação; ao fechar, foco retorna ao acionador. Back fecha primeiro a folha.
3. **Toque:** medir alvos mínimos de 48 × 48 dp e ausência de sobreposição. Ícones podem continuar com as dimensões visuais atuais.
4. **Texto:** validar escala normal, ampliada e até 200% onde suportado. Nenhum valor, recebedor, prazo ou CTA pode ser cortado; testar o efeito de `setTextZoom(100)` e da fonte remota indisponível.
5. **Contraste:** pelo menos 4,5:1 para texto normal e 3:1 para texto grande; distinguir estado por texto/ícone, além da cor. Verificar os tokens efetivamente compostos sobre seus fundos.
6. **Mensagens:** sucesso e erro devem ser percebidos por tecnologia assistiva sem mudar o foco indevidamente; erro que exige correção não desaparece após 3,5 s. [W3C — mensagens de status](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), consulta em 11/10/2026, sem data de atualização explícita na leitura.
7. **Layout:** testar larguras compactas e grandes, fonte carregada/fallback, teclado aberto, navegação por gestos/botões e safe areas. O Menu não cobre o último item, e o CTA não esconde o conteúdo necessário à decisão.
8. **Carregamento e vazio:** usar os componentes atuais para carregando, vazio legítimo, sem acesso, offline, falha e atualização em curso. “R$ 0,00” não deve ser substituto de saldo ainda não carregado; “Nada por aqui” não deve encobrir erro de API.

### Validação de valor e critérios de produto

**Perguntas por tarefa, sem orientar a resposta:** quem paga? Quem recebe ao final? Onde está o valor agora? O clique envia convite, paga ou libera? Quanto sai no total? O que acontece sem resposta? Como interromper/corrigir? O que ocorre se fechar o aplicativo?

**Metas propostas para discussão antes do piloto:**

- Pelo menos 90% dos participantes conseguem identificar partes, valor e estado antes de confirmar, sem ajuda. Na pesquisa pequena, avaliar também cada erro crítico; o percentual não dá confiança estatística.
- Nenhum participante confunde uma operação pendente/simulada com pagamento confirmado ou liberação recebida.
- Pelo menos 90% concluem o cenário principal e encontram o pagamento ao retornar sem intervenção do moderador.
- Todos os cenários financeiros de repetição e retomada resultam em um único efeito correto e conciliado. É um gate técnico, não uma meta média de conversão.
- Zero exposição de informações financeiras após logout nos caminhos testados; zero P0 aberto no escopo lançado.

Eventos propostos: combinado criado/enviado/aceito/recusado/expirado, checkout aberto, método escolhido, tentativa criada, confirmação financeira recebida, entrega registrada, ajuste solicitado, liberação solicitada/confirmada, disputa aberta/resolvida e devolução confirmada. Associar IDs de correlação e versão do fluxo; não registrar documentos, arquivos, conteúdo de conversa ou credenciais nos eventos analíticos.

Indicadores: conclusão de pagamento por etapa e por método; abandono antes/depois da autenticação; tempo até confirmação; retomadas resolvidas sem suporte; diferenças de conciliação; duplicidades; compreensão do prazo automático; tempo de recebimento do prestador; disputas por motivo e tempo de resolução. Não usar cliques em “Pagar” ou número de empréstimos como substituto de pagamento concluído e compreendido.

## 7 Decisões pendentes

| Decisão | Evidência ou necessidade | Responsável sugerido | Quando resolver |
| --- | --- | --- | --- |
| Qual é o primeiro público e tipo de serviço? | Exemplos de reformas/interiores não equivalem a pesquisa de mercado. | Produto/Negócio. | Antes de fechar escopo do piloto. |
| Quem é o operador e qual a relação com BTG? | Interface afirma operação, conta, seguros e marca; parceria não comprovada na auditoria. | Negócio/parceiro e jurídico. | Antes de promessas públicas e integração. |
| Não correntista pode usar? | Entrada exige conta BTG; há rota “Sem conta BTG” e Pix de qualquer banco no código. | Produto/parceiro. | Antes de fechar cadastro e comunicação de aquisição. |
| Quem guarda os recursos e quem é o destinatário identificado no Pix? | “Guardado no Aval” não esclarece toda a cadeia financeira. | Parceiro/Financeiro/Tecnologia. | Antes de contratar integração. |
| Quem paga cada tarifa e qual o líquido do prestador? | Ex.: R$ 72 de seguro de arbitragem “já incluso” em R$ 18 mil, com liberação exibida de R$ 18 mil. A fonte do custo não fica clara na jornada. | Negócio/Financeiro. | Antes do checkout real. |
| Financia o serviço inteiro ou cada etapa? | Checkout observado cobra o total; a promessa enfatiza liberação por marcos. | Produto/parceiro. | Antes do modelo financeiro e de cancelamento. |
| Quem pode mudar as etapas e quando o outro lado aceita? | Na cobrança, pagador define etapas; prestador não percorre segundo aceite no caminho observado. | Produto/Operações. | Antes do contrato/versão persistente. |
| O que inicia e suspende o prazo automático? | Textos de 7 dias, recorrência de 3 dias e datas sem horário. | Produto/Operações/jurídico. | Antes de agendador e termos. |
| Qual é a política de cancelamento após aceite, funding e liberação parcial? | Cancelamento simples só cobre convite; devolução aparece na disputa. | Produto/parceiro/Operações. | Antes de piloto com dinheiro. |
| Qual é a atuação humana na disputa? | Matriz local antecipa repartição conforme provas/resposta; SLAs e custos anunciados. | Operações/jurídico/parceiro. | Antes de prometer proteção em caso de conflito. |
| Crédito e antecipação pertencem ao primeiro lançamento? | São proeminentes, porém decisões/limites simulados. | Produto/Negócio/parceiro. | Fase 0; adiar se não operáveis. |
| Que benefícios existem de fato? | Rendimento, cashback, garantia, assistência, NFS-e e seguros aparecem como ativos. | Negócio/Operações. | Antes de manter ofertas na release. |
| Como logout difere de bloqueio e reconhecimento? | Reuso de nome após sair, exposição pela rota BTG e perda após encerramento. | Produto/Segurança/Tecnologia. | Antes da integração de sessão. |
| Quais dados aparecem em link, recentes, notificação e comprovante? | Endereço antes de login, prévia de saldo, conta no recibo. | Produto/Privacidade/Segurança. | Antes de compartilhamento real. |
| Como funciona recuperação de acesso e uso em outro aparelho? | Não há fluxo real observado nem sincronização. | Segurança/Operações/Tecnologia. | Antes de piloto externo. |
| Quais versões Android, aparelhos e canais de distribuição? | Teste em um emulador; targetSdk antigo para nova submissão. | Engenharia/QA/Distribuição. | Antes de homologação final. |
| O que mede sucesso econômico sem prejudicar a proteção? | Ofertas adicionais concorrem com o núcleo; nenhum dado de uso real fornecido. | Produto/Financeiro. | Antes do piloto e das metas de conversão. |

## Evidências e rastreabilidade

As capturas abaixo são do aplicativo Android. Arquivos XML de mesmo nome registram a hierarquia acessível extraída no teste. Uma captura pode ocorrer durante um toast ou animação; os efeitos duráveis foram conferidos nas telas seguintes e no código. Os nomes e valores são dados sintéticos do protótipo.

| Evidência | Registro | O que sustenta |
| --- | --- | --- |
| E01 | [Entrada](02-entrada.png) | Proposta inicial, conta BTG como entrada e Demo na release. |
| E02 | [Consentimento](03-consentimento.png) | Contexto “Você está no app BTG” e dados fixos sem redirecionamento real. |
| E03 | [Erro nos termos](06-termos-obrigatorios.png) e [termos após rolagem](07-termos.png) | Mensagem temporária no topo e aceite abaixo da primeira área visível. |
| E04 | [Home vazia](08-inicio-vazio.png) | Saldo/limite/crédito antes do primeiro pagamento; sobreposição do Menu. |
| E05 | [Pagar](10-pagar-combinado.png), [liberação](11-liberacao.png), [enviar](12-envio.png) | Formulário preenchido, regras e “Enviar pagamento”. |
| E06 | [Aviso após enviar](13-enviado.png) | Exemplo de dinheiro guardado associado a aceitar. |
| E07 | [Cancelamento](15-convite-cancelado.png) | Feedback e desaparecimento do convite antes de financiar. |
| E08 | [Aceite](18-aceite-termos.png), [aguardando pagamento](19-aceito-aguardando.png) | Diferença entre aceite e dinheiro guardado. |
| E09 | [Checkout](23-checkout.png) e [métodos](24-checkout-metodos.png) | Ofertas, limite insuficiente e Pix selecionado abaixo da dobra. |
| E10 | [Pix](25-pix-pendente.png) e [retorno](26-retorno-pix.png) | QR/código Demo e preservação em segundo plano. |
| E11 | [Confirmação com sobreposições](27-pagamento-confirmado.png) e [comprovante](28-servico-pago.png) | Sucesso sintético e conta de origem inconsistente com Pix externo. O nome do segundo arquivo não implica que seja tela de serviço: o clique inicial foi interceptado pela transição. |
| E12 | [Serviço ativo](29-servico-ativo.png) | Contadores, linha do tempo, próxima ação e promessas de rendimento/benefícios. |
| E13 | [Erro na entrega](32-entrega-erro.png) e [anexo](33-anexo-simulado.png) | Validação sem anexo e criação de foto sem arquivo. |
| E14 | [Entrega enviada](34-entrega-enviada.png) | Prazo, oferta de antecipação e status da evidência. |
| E15 | [Revisão](37-aprovacao.png) e [Back](38-voltar-com-modal.png) | Assistente, aviso de risco, prazo, simulação e saída para a home. |
| E16 | [Liberação](39-liberacao-confirmada.png) | Comprovante sintético e NFS-e anunciada como emitida. |
| E17 | [Perfil](40-perfil.png) e [ações finais](41-perfil-final.png) | Segurança informativa, exportação e versão 5.0 protótipo. |
| E18 | [Logout](42-logout.png) e [acesso após logout](43-pos-logout.png) | Reprodução da exposição de saldo/atividades sem autenticação. |
| E19 | [Biometria](44-login-biometria.png) e [Usar senha](45-senha-sem-senha.png) | Alternativa que entra sem pedir credencial. |
| E20 | [Reabertura após encerramento](49-demo-apos-reinicio.png) | Perfil “Você — criar conta” e entrada sem identificação de Ana. |
| E21 | [Cobrar](52-cobrar-form.png), [WhatsApp](53-whatsapp.png), [link sem sessão](54-link-sem-sessao.png) | Dados preenchidos, canal encenado e exposição do endereço antes de autenticar. |
| E22 | [Retorno ao convite](55-retorno-ao-convite.png), [assistente](57-assistente-marcos.png), [etapas](58-marcos-definidos.png) | Retomada interna e definição de duas etapas no recebimento de cobrança. |
| E23 | [Nova disputa](62-abrir-disputa.png) e [mediação](63-disputa-pendente.png) | Provas preenchidas, prazo, valor bloqueado e antecipação de resultado. |
| E24 | [Resposta](65-resposta-disputa.png), [teclado](66-teclado.png), [resposta confirmada](68-resposta-confirmada.png) | Participação da contraparte e mudança da regra conforme presença de provas. |

### Fontes locais principais

- [Estado e persistência](../public/js/store.js), linhas 7–24; [servidor](../src/server/app.ts), implementação de arquivos estáticos e health check.
- [Sessão e cadastro](../public/js/actions/session.js), linhas 33–38 e 53–89; [proteção de rotas](../public/js/main.js), linhas 32–33 e 84–89.
- [Entrada e perfil](../public/js/screens/common.js); [conta BTG simulada](../public/js/screens/account.js); [handoff](../public/js/screens/menu.js).
- [Combinados e links](../public/js/actions/protected.js); [telas correspondentes](../public/js/screens/protected.js); [cancelamento e compartilhamento](../public/js/actions/perks.js).
- [Pagamento](../public/js/actions/payment.js), linhas 26–53, 176–220 e 253 em diante; [checkout](../public/js/screens/checkout.js); [Pix e comprovante](../public/js/screens/money.js), linhas 11–44.
- [Entrega e liberação](../public/js/actions/delivery.js); [revisão](../public/js/screens/client.js); [antecipação](../public/js/actions/provider.js).
- [Disputa](../public/js/actions/dispute.js); [telas de disputa](../public/js/screens/dispute.js); [rotina de prazos](../public/js/actions/clock.js); [data-base](../public/js/domain/dates.js).
- [Componentes](../public/js/ui.js), linhas 57–70 e 102–104; [tokens e estilos](../public/css/styles.css); [variantes atuais](../public/css/btg-banking.css), especialmente linhas 19–34.
- [Configuração do APK](../android/app/build.gradle); [WebView e ciclo Android](../android/app/src/main/java/br/com/aval/prototipo/MainActivity.java); [manifesto](../android/app/src/main/AndroidManifest.xml).

As estimativas e metas deste plano são propostas. A conclusão de prontidão depende de evidências de execução e operação dos fluxos lançados, não da quantidade de telas disponíveis.

