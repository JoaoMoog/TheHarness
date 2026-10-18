# Membros e convites da CLARA

Implementação de 18/10/2026. Há dois níveis independentes de acesso:

- **Espaço:** Administração → Membros e convites. Administradores criam convites com papel Leitor, Editor ou Administrador; alteram papéis e removem participantes. Também é possível compartilhar o próprio espaço. Seu proprietário mantém o papel de administrador, e espaços de equipe sempre mantêm ao menos um administrador.
- **Dashboard individual:** Mais opções → Compartilhar. Administradores do espaço consultam participantes diretos e acessos herdados, criam convites de leitura, revogam convites e removem acessos individuais. O convidado pode consultar somente o dashboard salvo, seus indicadores e gráficos. Não recebe associação ao espaço, acesso livre às fontes, edição nem uso da IA nesse espaço.

O acesso herdado do espaço continua válido quando um acesso individual é removido. Para removê-lo, use a administração do espaço. Remover a pessoa do espaço não apaga uma concessão individual independente; os dois níveis são mostrados separadamente. Não existe exclusão de um dashboard específico para alguém que já é membro do espaço.

## Convites

Links de uso único, válidos por sete dias e revogáveis. O servidor armazena somente o hash do código aleatório de 192 bits. Com e-mail informado, a aceitação exige autenticação Microsoft e correspondência com o e-mail da sessão validada. Contas locais, sem verificação de e-mail, não podem aceitar convites direcionados por e-mail. Sem e-mail, o primeiro usuário autenticado com o link pode aceitar. A CLARA mostra a análise/espaço, o papel e a validade antes da aceitação.

O administrador copia o link e o envia ao destinatário. Não há envio automático por e-mail. O login preserva o convite. Aceitar não modifica papéis preexistentes e não consome um convite quando a pessoa já tem acesso. A biblioteca mostra os dashboards recebidos em **Compartilhados comigo**.

## Isolamento e persistência

As APIs de consulta compartilhada usam o documento salvo no servidor. Não recebem fontes, filtros, widgets ou documentos arbitrários do convidado; retornam somente resultados agregados. O servidor confere autorização antes e depois da consulta assíncrona. Revogação bloqueia consultas posteriores; cópias de informações já vistas não podem ser retiradas do destinatário.

Os endpoints existentes continuam exigindo participação no espaço. `dashboard_members` e `dashboard_invites` são tabelas aditivas em SQLite. `workspace_invites.email` é adicionado preservando os convites existentes. Criação, aceitação e remoção de acessos ficam na auditoria do espaço. Excluir um dashboard impede consultas e aceitação de seus convites antigos.

Rotas: `/shared` para aceitar convites e consultar dashboards, `/api/v1/sharing` para compartilhamento individual e `/api/workspaces` para membros e convites de espaços.

Testes: `tests/sharing.test.ts` e `tests/governance.test.ts` verificam isolamento, origem, sessão, destinatário, hash, uso único, expiração, revogação, herança e recorte salvo. `tests/e2e/sharing.spec.ts` verifica o ciclo completo com duas contas, desktop/celular, biblioteca e persistência da revogação após reiniciar.

Validação final: build de produção aprovado, 145 testes unitários/integrados aprovados, cenário de compartilhamento no navegador aprovado e regressões de expansão/onboarding aprovadas. Indicadores móveis verificados sem sobreposição; evidências em `clara-dashboard-invite.png`, `clara-shared-dashboard.png`, `clara-shared-mobile.png` e `clara-workspace-members.png` nesta pasta. Piloto reiniciado com AgentCore; saúde HTTP 200 e API de compartilhamento sem sessão HTTP 401.
