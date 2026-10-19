# Créditos e utilização da CLARA

Regra definida pelo usuário em 18/10/2026: 5 créditos por chamada concluída; cota padrão de 250 chamadas mensais, equivalentes a 1.250 créditos por pessoa.

## Regras

- Saldo único por identidade, compartilhado entre todos os espaços e pelas interfaces Studio e Classic.
- Cota renovada no dia 1º, à meia-noite de Brasília. Renovação conferida no servidor a cada acesso e consulta administrativa; não depende de cron. Créditos não usados e extras não acumulam.
- Cada resposta válida da IA consome 5 créditos, inclusive esclarecimentos. Geração de capa por IA também consome 5. Exportar, consultar, editar gráficos e gerar HTML pelos dados existentes não invocam o modelo e não consomem créditos.
- Reserva atômica antes da chamada, confirmação após resultado válido e devolução integral em erro/cancelamento. Saldo insuficiente retorna HTTP 402 antes de invocar o provedor. Duas chamadas simultâneas não podem gastar o mesmo saldo.
- Reservas abandonadas por interrupção são recuperadas após dez minutos. Uma chamada iniciada no mês anterior não desconta a cota renovada.
- Concessões extras exigem quantidade positiva, motivo e identificador idempotente. Histórico registra usuário beneficiado, administrador, data e motivo. Repetir a mesma solicitação não duplica créditos.

## Acesso

As áreas Créditos e Uso da plataforma exigem participação no grupo de segurança `CLARA-Administradores-Plataforma`, no Microsoft Entra ID. Configure os membros autorizados no diretório do destino.

O servidor compara IDs de grupos provenientes do access token validado por assinatura, issuer, tenant, audience e scope. Nome ou e-mail não concedem permissão. Administração de um espaço, conta local e demonstração não equivalem a administração da plataforma. As APIs verificam o grupo em todas as operações; ocultar menus é apenas uma parte da experiência.

Configure a emissão da claim `groups` **no registro da API da CLARA**, usando IDs de objeto de grupos de segurança. Claims com overage são recusadas para o acesso administrativo; não são seguidas URLs fornecidas pelo token. Em diretórios grandes, configure grupos atribuídos ao aplicativo, quando a licença permitir, ou implemente a consulta autorizada ao Graph antes de ativar esse cenário.

A autorização administrativa vale até a expiração do access token que originou a sessão. Alterações de associação exigem uma nova autenticação para obter claims atualizadas. Não há concessão automática por e-mail nem exceção local em produção.

Referências Microsoft: [claims de grupos](https://learn.microsoft.com/en-us/security/zero-trust/develop/configure-tokens-group-claims-app-roles), [access token e overage](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference).

## Configuração

```dotenv
CLARA_MONTHLY_CREDITS=1250
CLARA_AI_CREDIT_COST=5
CLARA_PLATFORM_ADMIN_GROUP_IDS=<ID do grupo de segurança>
```

Sem grupo configurado, nenhum usuário recebe acesso às áreas restritas. A configuração admite IDs separados por vírgula; esta implantação usa somente o grupo solicitado.

## Dados executivos

Indicadores: usuários ativos, tentativas e chamadas concluídas, créditos consumidos, falhas com devolução, bloqueios por saldo, tempo médio de resposta, dashboards criados, apresentações, unificações e importações. Filtro por período, série diária, utilização por pessoa e CSV.

Usuário ativo é uma pessoa que abriu a aplicação ou solicitou IA no período. Os relatórios consideram dias UTC e identificam isso na tela. O histórico começa na implantação deste sistema; não inventa utilização anterior. Não inclui textos de conversas, tokens de autenticação nem dados de planilhas.

## Persistência e API

SQLite: `credit_users`, `credit_ledger`, `ai_credit_requests`, `platform_events`, `platform_metadata`. As tabelas são criadas de forma aditiva, preservando dashboards e contas. O piloto permanece com uma instância e SQLite persistente.

| Rota | Permissão |
|---|---|
| GET `/api/v1/platform/me` | Saldo e capacidades da própria sessão |
| GET `/api/v1/platform/history` | Histórico próprio; outro usuário exige grupo |
| GET `/api/v1/platform/credits` | Grupo; busca e paginação |
| POST `/api/v1/platform/grants` | Grupo e origem validada |
| GET `/api/v1/platform/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` | Grupo; até 366 dias |

Nenhum endpoint aceita a identidade do solicitante ou sua associação a grupos a partir do corpo da requisição.

## Verificação

Versão validada em 18/10/2026: build de produção, 139 testes de servidor/componentes e três cenários de navegador (créditos, expansão do produto e onboarding). O cenário de créditos verifica bloqueio real por HTTP 402, concessão e histórico, isolamento dos menus, exportação CSV, tela móvel e persistência após reiniciar.

Preencha `CLARA_PLATFORM_ADMIN_GROUP_IDS` com o ID real do grupo do destino e configure a claim `groups` na API. Até isso ser feito, os menus administrativos permanecem bloqueados.

`tests/credits.test.ts` cobre débito, devolução, concorrência, limite, concessão idempotente, isolamento, renovação, chamadas atravessando o mês, recuperação após interrupção, autorização e indicadores. `tests/e2e/credits-platform.spec.ts` usa contas e claims sintéticas apenas em uma base descartável, sem criar porta de entrada especial no produto.
