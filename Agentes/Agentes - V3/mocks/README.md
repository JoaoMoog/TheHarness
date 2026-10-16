# Catálogo padrão de mocks do Aval

Registrado em 11/10/2026, atualizado em 12/10/2026. Dados totalmente fictícios; pagamentos, documentos, mensagens, crédito, seguro e decisões não são operações reais.

## Visualizar

Execute `npm.cmd run server:validation` e abra http://localhost:8787/mocks.html. No APK Aval · Teste, abra Demo → Catálogo de mocks.

Pesquise por funcionalidade ou categoria. Selecione um exemplo para abrir a tela existente no estado registrado. “Restaurar exemplo” desfaz as alterações. “Abrir separado” permite explorar a tela; “Baixar dados do mock” exporta seu estado padrão no navegador. Cada mock possui um link próprio no catálogo. Para consultar sem servidor, abra `galeria.html`: ela contém as capturas e os dados de todos os exemplos.

A conta e as credenciais dos mocks ficam somente em memória. Não leem nem modificam a conta local. O código fictício de acesso é **483927**. Recarregar restaura o exemplo. O catálogo não entra na versão release.

O onboarding está registrado nos mocks 115 a 118. Nos demais exemplos a apresentação inicial fica oculta para não cobrir a funcionalidade avaliada. Pular ou concluir um mock de onboarding não altera a preferência de primeiro acesso do usuário.

## Registro e manutenção

`public/js/mocks/fixtures.js` define os exemplos e seus estados. `catalogo.json` registra os metadados; `dados/` guarda um JSON completo por mock; `capturas/` guarda a visualização inicial de cada exemplo. Após modificar as definições, execute `node scripts/register-mocks.mjs` e `node --import tsx scripts/check-mocks.mjs` para atualizar os registros e conferir a cobertura.

O catálogo reproduz o comportamento atual. Telas legadas e referências bancárias estão identificadas; não representam novas integrações nem decisões de produto aprovadas. Estados não implementados, como erro de rede ou recuperação de provedor externo, não são inventados. Carregamento do assistente possui exemplo visual, sem executar uma requisição.

## Exemplos

| ID | Funcionalidade | Tela | Estado | Rota |
| --- | --- | --- | --- | --- |
| mock-001 | Conta | Boas-vindas | signedOut | #/entrada |
| mock-002 | Conta | Cadastro local | signup | #/cadastro |
| mock-003 | Conta | Cadastro — acesso alternativo | signup | #/cadastro/dados |
| mock-004 | Conta | Entrar com código local | login | #/biometria |
| mock-005 | Conta | Perfil | default | #/perfil |
| mock-006 | Conta | Conta em análise (legado) | accountAnalysis | #/conta-analise |
| mock-007 | Conta | Contestar bloqueio (legado) | accountRefused | #/contestar |
| mock-008 | Conta | Avisos | default | #/avisos |
| mock-009 | Conta | Avisos — vazio | empty | #/avisos |
| mock-010 | Início | Início — quem paga | default | #/inicio |
| mock-011 | Início | Início — quem recebe | provider | #/inicio |
| mock-012 | Início | Início — sem pagamentos | empty | #/inicio |
| mock-013 | Início | Buscar pagamentos | default | #/buscar |
| mock-014 | Início | Menu | default | #/menu |
| mock-015 | Cobrar | Quem vai pagar — telefone | chargePhone | #/cobrar/destinatario |
| mock-016 | Cobrar | Quem vai pagar — CPF/CNPJ | chargeDocument | #/cobrar/destinatario |
| mock-017 | Cobrar | Quem vai pagar — e-mail | chargeEmail | #/cobrar/destinatario |
| mock-018 | Cobrar | Destinatário inválido | chargeError | #/cobrar/destinatario |
| mock-019 | Cobrar | Dados da cobrança | chargeDetails | #/combinado/1 |
| mock-020 | Cobrar | Revisar e compartilhar | chargeReview | #/combinado/3 |
| mock-021 | Cobrar | Cobrança enviada | chargeSent | #/combinado/enviado/PG-001 |
| mock-022 | Cobrar | Cobrança cancelada | inviteCancelled | #/p/PG-001 |
| mock-023 | Cobrar | Marcos disponíveis para cobrar | providerWork | #/cobrar |
| mock-024 | Pagar | Dados do combinado | agreement | #/combinado/1 |
| mock-025 | Pagar | Definir liberação por marcos | agreement | #/combinado/2 |
| mock-026 | Pagar | Revisar e enviar combinado | agreement | #/combinado/3 |
| mock-027 | Pagar | Combinado enviado | inviteSent | #/combinado/enviado/PG-001 |
| mock-028 | Pagar | Conferir cobrança recebida | default | #/p/PG-001 |
| mock-029 | Pagar | Convite recusado | inviteDeclined | #/p/PG-001 |
| mock-030 | Pagar | Link inexistente | default | #/p/inexistente |
| mock-031 | Pagar | Ler QR simulado | default | #/ler-qr |
| mock-032 | Pagar | Checkout — saldo | checkout | #/pagar/AV-2026-001 |
| mock-033 | Pagar | Checkout — cartão | checkoutCard | #/pagar/AV-2026-001 |
| mock-034 | Pagar | Checkout — crédito | checkoutCredit | #/pagar/AV-2026-001 |
| mock-035 | Pagar | Checkout — sem saldo | checkoutNoBalance | #/pagar/AV-2026-001 |
| mock-036 | Pagar | Pix aguardando confirmação | pix | #/pix |
| mock-037 | Pagar | Pagamento confirmado | default | #/pago/AV-2026-001 |
| mock-038 | Pagar | Pagamento não confirmado | checkout | #/pago/AV-2026-001 |
| mock-039 | Pagar | Decidir entrada | downPayment | #/entrada-decidir/AV-2026-001 |
| mock-040 | Dividir | Editar divisão | checkout | #/dividir-pagamento/AV-2026-001 |
| mock-041 | Dividir | Grupo aguardando participantes | collective | #/coletivo/AV-2026-001 |
| mock-042 | Dividir | Responder convite para dividir | splitInvite | #/dividir/DV-002 |
| mock-043 | Serviço | Lista de pagamentos | default | #/servicos |
| mock-044 | Serviço | Lista de pagamentos — vazia | empty | #/servicos |
| mock-045 | Serviço | Entrega aguardando aprovação | default | #/servico/AV-2026-001 |
| mock-046 | Serviço | Serviço em execução | work | #/servico/AV-2026-001 |
| mock-047 | Serviço | Ajuste solicitado | adjustment | #/servico/AV-2026-001 |
| mock-048 | Serviço | Serviço concluído | completed | #/servico/AV-2026-001 |
| mock-049 | Serviço | Contrato | default | #/contrato/AV-2026-001 |
| mock-050 | Serviço | Comprovante de liberação | released | #/comprovante/AV-2026-001/0 |
| mock-051 | Serviço | Pedir cancelamento | cancellation | #/servico/AV-2026-001 |
| mock-052 | Serviço | Cancelamento pendente | cancellationPending | #/servico/AV-2026-001 |
| mock-053 | Serviço | Devolução confirmada | cancelled | #/devolucao/AV-2026-001 |
| mock-054 | Serviço | Conversa do contrato | default | #/conversa/AV-2026-001 |
| mock-055 | Serviço | Propor nova data | work | #/nova-data/AV-2026-001/0 |
| mock-056 | Serviço | Avaliar serviço | completed | #/avaliar/AV-2026-001 |
| mock-057 | Receber | Enviar entrega com evidências | delivery | #/entrega/AV-2026-001/0 |
| mock-058 | Receber | Simular antecipação | provider | #/antecipar/AV-2026-001/0 |
| mock-059 | Receber | Antecipação confirmada | anticipated | #/antecipado/AV-2026-001/0 |
| mock-060 | Receber | Agenda de recebíveis | provider | #/agenda |
| mock-061 | Receber | Notas fiscais simuladas | provider | #/notas |
| mock-062 | Receber | Subcontratar marco | providerWork | #/subcontratar/AV-2026-001/0 |
| mock-063 | Disputa | Lista de disputas | dispute | #/disputas |
| mock-064 | Disputa | Nenhuma disputa | empty | #/disputas |
| mock-065 | Disputa | Abrir disputa | newDispute | #/disputa/nova/AV-2026-001/0 |
| mock-066 | Disputa | Mediação pendente | dispute | #/disputa/DP-001 |
| mock-067 | Disputa | Prestador responde | disputeProvider | #/disputa/DP-001 |
| mock-068 | Disputa | Proposta da mediação | proposal | #/disputa/DP-001/resultado |
| mock-069 | Disputa | Disputa encerrada | disputeClosed | #/disputa/DP-001/resultado |
| mock-070 | Disputa | Como funcionam as disputas | default | #/arbitragem |
| mock-071 | Seguro | Apólice simulada | default | #/seguro/AV-2026-001 |
| mock-072 | Seguro | Sinistro em análise | claim | #/seguro/AV-2026-001 |
| mock-073 | Crédito | Meus créditos | default | #/creditos |
| mock-074 | Crédito | Meus créditos — vazio | empty | #/creditos |
| mock-075 | Crédito | CCB e parcelas | default | #/ccb/CCB-001 |
| mock-076 | Crédito | Parcela em atraso | lateCredit | #/ccb/CCB-001 |
| mock-077 | Financeiro | Financeiro | default | #/financeiro |
| mock-078 | Financeiro | Extrato | default | #/extrato |
| mock-079 | Financeiro | Extrato — vazio | empty | #/extrato |
| mock-080 | Benefícios | Pontos e benefícios | default | #/beneficios |
| mock-081 | Benefícios | Selo do prestador | provider | #/selo |
| mock-082 | Benefícios | Cofrinho do pagamento | checkout | #/cofrinho/AV-2026-001 |
| mock-083 | Assistente | Assistente | default | #/assistente |
| mock-084 | Assistente | Montar marcos | agreement | #/etapas/novo |
| mock-085 | Assistente | Ajuda | default | #/ajuda |
| mock-086 | Integrações simuladas | Sem conta conectada | disconnected | #/sem-conta |
| mock-087 | Integrações simuladas | Entrada bancária existente (legado) | default | #/btg |
| mock-088 | Integrações simuladas | Retorno do app externo — pontos | default | #/no-app-btg/pontos |
| mock-089 | Banco | Visão operacional | bank | #/banco/visao |
| mock-090 | Banco | Operações | bank | #/banco/operacoes |
| mock-091 | Banco | Operações — contratos | bank | #/banco/operacoes/contratos |
| mock-092 | Banco | Fila operacional | bank | #/banco/fila |
| mock-093 | Banco | Detalhe da fila | bankDispute | #/banco/fila/DP-001 |
| mock-094 | Banco | Clientes e limites | bank | #/banco/clientes |
| mock-095 | Banco | Carteira de crédito | bank | #/banco/credito |
| mock-096 | Banco | Pedido de crédito | bank | #/banco/credito/CR-001 |
| mock-097 | Banco | Seguros | bankClaim | #/banco/seguros |
| mock-098 | Banco | Detalhe do sinistro | bankClaim | #/banco/seguros/SI-001 |
| mock-099 | Banco | Receitas | bank | #/banco/receita |
| mock-100 | Banco | Funding | bank | #/banco/funding |
| mock-101 | Banco | Conluio | bank | #/banco/conluio |
| mock-102 | Banco | Compliance | bank | #/banco/compliance |
| mock-103 | Banco | API | bank | #/banco/api |
| mock-104 | Banco | Ofertas | bank | #/banco/ofertas |
| mock-105 | Confirmações | Revisar e aprovar entrega | approveSheet | #/servico/AV-2026-001 |
| mock-106 | Confirmações | Ofertas do pagamento | offersSheet | #/pagar/AV-2026-001 |
| mock-107 | Confirmações | Compartilhar comprovante | proofSheet | #/servico/AV-2026-001 |
| mock-108 | Confirmações | Confirmar arbitragem | arbitrationSheet | #/disputa/DP-001 |
| mock-109 | Confirmações | Repetir cobrança | confirm:repeat | #/combinado/1 |
| mock-110 | Confirmações | Contratar seguro | confirm:insurance | #/pagar/AV-2026-001 |
| mock-111 | Confirmações | Usar pontos | confirm:points | #/pagar/AV-2026-001 |
| mock-112 | Confirmações | Antecipação automática | confirm:autoAnticipate | #/agenda |
| mock-113 | Confirmações | Pix Automático | confirm:pixAuto | #/financeiro |
| mock-114 | Assistente | Aguardando resposta do assistente | assistantLoading | #/assistente |
| mock-115 | Onboarding | Conhecer o Aval — boas-vindas | onboarding:0 | #/entrada |
| mock-116 | Onboarding | Conhecer o Aval — cobrar | onboarding:1 | #/entrada |
| mock-117 | Onboarding | Conhecer o Aval — pagar | onboarding:2 | #/entrada |
| mock-118 | Onboarding | Conhecer o Aval — acompanhar | onboarding:3 | #/entrada |
