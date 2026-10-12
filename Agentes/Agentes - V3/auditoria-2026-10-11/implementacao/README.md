# Implementação do Aval 1.1.0

Implementada em 11/10/2026, a partir do diagnóstico. O escopo foi atualizado pela orientação expressa do usuário: **todos os pagamentos são simulados e a autenticação fica local**. Não há dependência de banco, gateway, autenticação bancária ou backend financeiro para usar esta versão.

O aplicativo mantém cores, tipografia, logotipo, componentes e navegação existentes. Foram alterados conteúdo, estados, hierarquia, acessibilidade e comportamento. A release é um aplicativo de simulação utilizável; não representa um serviço financeiro nem uma homologação de publicação em loja.

## Artefatos

- [APK release de simulação](../../Aval-simulacao-release.apk): pacote `br.com.aval.prototipo`, versão 1.1.0, versionCode 2. Instalado no emulador Android.
- [APK de validação interna](../../Aval-validacao.apk): pacote separado `br.com.aval.prototipo.validation`. Mantém ferramentas internas de apresentação.
- [Diagnóstico original](../diagnostico-e-plano-aval.md): a premissa de integração real desse documento foi substituída pelo novo escopo solicitado.
- [Alterações de fontes](alteracoes.patch), [inventário de fontes alteradas](arquivos-alterados.json) e cópias anteriores em `antes/`. O patch documenta `public/` e `src/`; também foram alterados scripts de build, package.json/package-lock.json e configuração/Activity Android.

No emulador foi criada apenas a conta de teste **Teste Android**, com código **483927**. Uma instalação nova permite criar outro nome e código. Este é um código sintético de teste, não uma credencial bancária.

## O que mudou

| Frente | Implementação | Relação com o diagnóstico |
| --- | --- | --- |
| Conta local | Cadastro com nome e código de seis números, confirmação do código, entrada e saída reais no contexto local. Não há botão que finja executar biometria bancária. | A01, A14 |
| Credenciais | PBKDF2/SHA-256, salt aleatório e 210 mil iterações. O código não entra nos rascunhos nem é armazenado em texto simples. Cinco tentativas incorretas provocam espera de 30 segundos. | A01 |
| Sessão | Reabertura exige desbloqueio; segundo plano curto preserva a sessão; retorno após cinco minutos exige o código. Logout limpa os rascunhos, telas transitórias e rotas de retomada. | A02, A04, A25 |
| Privacidade | Rota bancária e superfícies privadas protegidas após logout; saudação pública sem nome; endereço do serviço omitido no convite antes da entrada. Android com `FLAG_SECURE` para impedir capturas e exposição nos recentes. | A02, A12, A25 |
| Continuidade | Conta, combinados e estado da operação persistem localmente. Depois do desbloqueio, a operação pendente pode ser retomada. | A04 |
| Ambientes | Release sem painel Demo, apresentações, balões, roteiros, slides e módulo de avanço do relógio. O build verifica a exclusão desses módulos. | A05, A19 |
| Simulação | Identificação permanente de dinheiro fictício em todas as telas; comprovantes com marca explícita de ausência de validade de pagamento. Ator da contraparte identificado e botão para voltar à própria conta. | A05–A07, A10 |
| Primeira tarefa | Banner existente orienta a criar um combinado; formulário release começa vazio e não envia nome, endereço ou valor de exemplo por padrão. | A13–A14 |
| Aceite e etapas | “Enviar combinado” e “Aceitar combinado”; modelos manuais de etapas sem obrigar o assistente. O aceite continua separado do pagamento. | A13, A16 |
| Checkout | Pagador, recebedor e método selecionado aparecem antes das opções. Ofertas adicionais foram reposicionadas; cartão sem limite suficiente não é recomendado como elegível. | A15 |
| Pagamento e liberação | Proteções contra confirmação e liberação repetidas no estado local. Registro de pagamento inclui horário e origem; Pix não aparece como débito na conta por padrão. | A03, A07, A18, A24 |
| Convite cancelado | Página explícita, histórico mantido e ausência de promessa de cobrança/devolução. Só o criador pode cancelar um convite ainda aberto. | A09 |
| Cancelamento após pagar | Pedido bilateral para combinados individuais com Pix/saldo, sem seguro, antecipação ou disputa. Pausa a liberação; aceite da contraparte registra a devolução simulada do valor ainda guardado. Valores já liberados são preservados. | A09 |
| Evidências e disputa | Removidos relato, resposta e anexos predefinidos. Anexos criados pelos botões são identificados como simulados. Texto imparcial e retirada da conclusão antecipada da matriz na fase de coleta. | A06, A17 |
| Antecipação | Verificação do limite livre considerando antecipações já em uso; bloqueio durante cancelamento pendente. | A24 |
| Mensagens | Erros persistentes, associação aos campos principais e foco na correção. Mensagens ocupam espaço próprio e não cobrem o CTA. Operações auxiliares indisponíveis não anunciam sucesso fictício. | A22–A23 |
| Acessibilidade | Contraste de texto secundário no cabeçalho, alvos de controles de pelo menos 48 px CSS, seleção anunciada nas opções, foco preso na janela e retorno ao acionador. Back fecha primeiro a janela. Fonte Android segue a escala configurada no sistema. | A20–A21, A25 |
| Versão | Metadados do projeto e Android atualizados para 1.1.0; release e validação usam pacotes e armazenamento separados. | A26 |

## Regra adotada para cancelamento simulado

A interface explica a regra antes de enviar o pedido: ambas as partes precisam aceitar e somente o valor guardado é devolvido. Enquanto o pedido está pendente, pagar/liberar fica bloqueado. Recusar mantém o combinado. Aceitar registra uma única devolução e preserva os valores já liberados.

O primeiro recorte abrange combinados individuais em Pix ou saldo. Financiamento, seguro, antecipação, subcontratação, rateio e disputas abertas não são desfeitos silenciosamente por esse fluxo. Os caminhos de disputa existentes continuam disponíveis para esses casos. Esta é uma regra de simulação adotada para tornar o fluxo testável, não uma política de devolução de um banco.

## Verificação executada

- **178 testes automatizados passaram**, incluindo credenciais locais, guardas de sessão, devolução única, rejeição de pedido desatualizado, preservação de valor liberado e recomendação de cartão conforme limite.
- `npm run typecheck` aprovado.
- Builds Android debug e release concluídos; verificação de lint vital release aprovada pelo Gradle.
- Inspeção do pacote e `scripts/check-release.mjs`: apresentação, roteiro e relógio não fazem parte da release. Perfis de contraparte e lógica de pagamentos simulados permanecem intencionalmente, conforme o escopo revisado.
- **Fluxo de interface automatizado em Chromium**: cadastro; formulário vazio; erro junto ao campo; envio e aceite; checkout; reinício com Pix pendente; código incorreto/correto; comprovante; tentativa repetida de pagamento; entrega da contraparte; Back na janela de revisão; aprovação; liberação repetida; cancelamento bilateral e devolução; etapas manuais; bloqueio após cinco minutos; logout e tentativa de acessar a rota bancária. Sem exceções JavaScript no fluxo.
- Layout compacto de 320 px verificado sem transbordamento da superfície principal na tela de entrada. Capturas de revisão realizadas a 412 × 915.
- **Android nativo**: instalação/upgrade; cadastro; encerramento forçado; reconhecimento da conta sem exibir o nome na entrada; desbloqueio e retorno. O estado `SECURE` da janela foi verificado. A recuperação do Pix pendente foi testada no navegador, não reproduzida com dinheiro real nem em aparelho físico.

Capturas: [início](home-release.png), [checkout](checkout-release.png), [pagamento simulado](recibo-release.png), [liberação](liberacao-release.png), [cancelamento/devolução](devolucao-release.png). Os XMLs `android-*.xml` registram os testes nativos. [Roteiro executável de interface](verificar-ui.mjs).

## Limites desta entrega

- Persistência local não é backup ou sincronização. Limpar dados/reinstalar apaga a conta. Recuperação de código por e-mail e migração entre aparelhos não foram implementadas; a tela informa essa limitação.
- O código protege o acesso pela interface. Os dados de negócio em localStorage não foram criptografados; não se trata de autenticação bancária ou proteção contra alguém com acesso ao armazenamento do aparelho.
- Anexos, documentos fiscais, seguros, crédito, avisos, links e operações financeiras continuam sendo simulações. Exportar/compartilhar que não tenham efeito real mostram indisponibilidade, em vez de sucesso. Não há upload, envio de WhatsApp ou comunicação com pessoas externas.
- Cobertura completa de TalkBack, fontes ampliadas em aparelhos físicos, diferentes versões Android e todos os módulos de rateio/recorrência continua pendente. Ajustes de acessibilidade implementados não equivalem a certificação.
- O projeto Android ainda utiliza compileSdk/targetSdk 34 e o toolchain já existente. Atualização de compatibilidade e requisitos da loja continua necessária caso se deseje publicação; nenhum envio à loja foi feito.
- O teste por etapas elimina a obrigatoriedade do assistente, mas negociação versionada entre duas instalações independentes está fora deste aplicativo local. A simulação da contraparte acontece no mesmo aparelho.
- As regras longas de mediação, arbitragem, juros, prazo automático e benefícios continuam sendo regras do simulador. Não foram homologadas como operação real. Disputas e módulos secundários não receberam a mesma cobertura ponta a ponta do fluxo principal documentado acima.

## Como executar

```text
npm run build
npm test
npm run typecheck
node scripts/check-release.mjs
npm run server
```

`npm run server` serve a release simulada em `http://127.0.0.1:8787`. `npm run server:validation` abre o ambiente interno com ferramentas de apresentação. Os builds Android `:app:assembleRelease` e `:app:assembleDebug` geram automaticamente os assets correspondentes. A assinatura release usa a configuração local existente, sem copiar credenciais para código ou documentação.

O roteiro de interface nesta pasta usa o Chromium/Playwright já instalado na máquina e a porta 8798; seus caminhos de ferramentas são específicos deste ambiente. A suíte `npm test` não depende desse navegador.
