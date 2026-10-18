# CLARA Studio — execução e integrações

A aplicação em `/` usa o backend e contratos versionados. O protótipo visual original continua em `design/clara-sap-studio`; a aplicação anterior está preservada em `/classic`. Não é uma reprodução completa de todos os recursos do SAP Analytics Cloud.

Resultados e limites da validação estão em [CLARA-VERIFICACAO.md](CLARA-VERIFICACAO.md).

## Experimentar sem configuração

Requer Node.js 24 e dependências instaladas. Na pasta `app`, execute `npm ci` na primeira instalação e `npm run studio`. No Windows também pode usar `iniciar-studio.cmd` na raiz. Acesse **http://127.0.0.1:3000** e escolha **Começar demonstração**. Não exige SAP, Microsoft, AWS nem banco externo.

Cada entrada demonstrativa cria uma identidade e um espaço isolados. Para sair e entrar novamente na mesma conta enquanto o servidor estiver ativo, use **Usar conta local → Criar conta local**. Sessões duram até oito horas. Neste modo, reiniciar o processo apaga contas, sessões, equipes e análises. Dados SQLite anteriores não são apagados pelo iniciador Studio.

## Implementado

- Dashboard com filtros, oito formas de visualização, edição, prévia de alterações do assistente, aplicar/desfazer, salvamento, duplicação, favoritos, versões e restauração.
- Biblioteca pesquisável, exploração paginada, exportação CSV do recorte agregado e apresentação com impressão/PDF do navegador.
- Planejamento com versões de orçamento; cenários de redução em Tecnologia; projeção ilustrativa pela média, identificada na interface. Nenhum desses recursos altera o SAP.
- Medida calculada com três fórmulas permitidas e prévia: saldo, desvio e execução. A configuração é salva no espaço; não é um editor arbitrário de fórmulas ou um modelo SAC importado.
- Comentários por dashboard, espaços de equipe, convites, papéis administrador/editor/leitor, revogação e auditoria no servidor. Links compartilhados exigem sessão e associação ao espaço.
- Conversa privada por usuário e espaço. Assistente demonstrativo determinístico e adaptador opcional Bedrock com saída estruturada validada. O demonstrativo atende exemplos do fluxo financeiro; compreensão ampla depende do provedor configurado.
- Tratamento de indisponibilidade, fonte pausada, validação, conflito de revisão e repetição idempotente de comandos. O formulário permanece aberto em falhas ao salvar.
- Rascunhos de planejamento, cenários e medidas sobrevivem à atualização do servidor e à reautenticação na mesma página, separados por conta/espaço. Recarga da página e saída explícita descartam rascunhos não salvos.

## Docker

Com o Docker Engine funcionando, execute na raiz:

```sh
docker compose config --quiet
docker compose up --build
```

Acesse **http://localhost:3000** — essa é a origem configurada no Compose. O serviço é exposto apenas na máquina local. A imagem usa build em etapas, saída Next standalone, usuário sem privilégios, raiz somente leitura, `/tmp` temporário e healthcheck. Não monta banco ou pasta de dados. Parar/recriar o processo perde os dados do modo em memória.

Dockerfile e Compose estão preparados; a construção e execução da imagem ainda precisam ser verificadas com um Docker Engine disponível. Nesta máquina o Engine não respondeu durante a verificação. A compilação Next de produção foi verificada separadamente.

## Kubernetes

A base em `deploy/kubernetes/base` contém Namespace, ConfigMap, Deployment e Service, com Kustomize. Usa uma réplica, estratégia Recreate, probes, limites de recursos, usuário não root e volume temporário apenas em `/tmp`.

```sh
kubectl kustomize deploy/kubernetes/base
```

A renderização pode ser conferida sem publicar. Depois de escolher/configurar o cluster, carregar a imagem `clara-studio:local` nesse cluster ou definir uma imagem de registry via overlay. Só então aplicar:

```sh
kubectl apply -k deploy/kubernetes/base
kubectl -n clara rollout status deployment/clara
kubectl -n clara port-forward service/clara 3000:3000
```

Com o port-forward, acessar http://localhost:3000. A base não cria Ingress, TLS, credenciais, PVC ou recursos de cloud. Publicação no cluster não foi executada. Não aumentar réplicas: estado, sessões, cache e controle de taxa são locais ao processo.

## Pendências de configuração e homologação

| Integração | Preparado | O que falta depois |
|---|---|---|
| SAP | Adaptador de leitura JSON/OData e mapeamento validado | Endpoint, credencial, rede, recorte, campos, granularidade e regras de acesso da organização; homologar com dados reais |
| SSO | Login Microsoft no navegador e validação de token na API | Tenant, registros SPA/API, escopos, retorno e política de acesso |
| IA | Adaptador Bedrock e contrato de proposta | Região, modelo autorizado e identidade AWS; validar qualidade dos pedidos reais |
| Persistência | Contrato do repositório, transação, revisão e idempotência | Escolher e implementar armazenamento compartilhado, sessões, migrações, retenção, backup/restauração; testar concorrência entre réplicas |
| Infraestrutura | Dockerfile, Compose, base Kubernetes, probes | Docker Engine, cluster, registry, imagem, domínio/TLS, segredos, recursos e observabilidade do ambiente |

As variáveis estão documentadas em `app/.env.studio.example`. São instruções para uma etapa futura; valores reais não foram preenchidos. A persistência distribuída exige implementação do adaptador e migração dos serviços existentes, não apenas uma URL de banco. O contrato atual do repositório é síncrono; um driver remoto assíncrono também exigirá propagar `async/await` nos consumidores. O comportamento de domínio e os contratos HTTP podem ser preservados.

## Contratos

Contrato completo do Studio: `app/contracts/studio.openapi.json`, também servido em `/api/v1/studio/openapi`. Fonte: `app/src/studio/contracts.ts` e `app/src/studio/openapi.ts`. Regenerar com `npm run contracts:studio`.

As chamadas usam cookie HttpOnly `prometeu-session`. O cabeçalho `x-clara-workspace` seleciona um espaço autorizado; omitido, usa o pessoal. Todo POST exige `Origin` igual a `PUBLIC_APP_URL`. Credenciais SAP/AWS nunca são enviadas ao navegador. Erros Studio seguem `{ "error": { "code", "message", "requestId" } }`.

| Método e caminho, após `/api/v1/studio` | Uso |
|---|---|
| GET `/config` | Configuração pública sem segredos |
| POST `/session` | Sessão demonstrativa isolada; desativada em `AUTH_MODE=msal` |
| GET `/bootstrap` | Identidade, espaço, permissões, estado e conversa privada |
| GET `/catalog` | Campos, empresas, centros, competências, limites e semântica |
| POST `/query` | Agregações e registros paginados por filtro |
| POST `/assistant` | Proposta validada; não executa nem salva o dashboard |
| POST `/scenario` | Resultado de simulação e projeção ilustrativa |
| POST `/commands` | Mutação autorizada com revisão e `operationId` UUID |

Um comando recebe `{ revision, operationId, command }`. Em conflito retorna 409; recarregar o estado antes de reenviar. Repetir exatamente o mesmo pedido com o mesmo UUID não duplica a operação. Últimos 50 recibos por espaço são retidos; uma repetição retorna o resultado original. Armazenamento definitivo deverá garantir atomicidade e deduplicação entre processos.

Os serviços de identidade e equipe preservados usam `/api`, com erros legados `{ error: string }`:

| Método e caminho | Corpo / propósito |
|---|---|
| POST `/api/auth/register` | `{mode:"local", name, email, password}` |
| POST `/api/auth/login` | `{mode:"local", email, password}` ou `{mode:"msal", accessToken}` |
| POST `/api/auth/logout` | `{}`; revoga sessão |
| GET / POST `/api/workspaces` | Lista espaços / cria com `{name}` |
| POST `/api/workspaces/join` | `{code}`; aceita convite |
| GET `/api/workspaces/{id}` | Governança do espaço |
| POST `/api/workspaces/{id}/invites` | `{role:"reader"|"editor"|"admin"}` |
| DELETE `/api/workspaces/{id}/invites/{inviteId}` | Revoga convite |
| POST / DELETE `/api/workspaces/{id}/members/{memberId}` | Altera `{role}` / remove membro |
| GET `/api/workspaces/{id}/audit` | Auditoria autorizada |
| GET `/api/workspaces/{id}/operations` | Diagnóstico operacional autorizado |
| GET `/api/health` e `/api/health/ready` | Vida do processo e disponibilidade do armazenamento local; não homologam SAP/IA |

## Contrato de dados SAP

O adaptador aceita coleção JSON, OData `value` ou `d.results`, com colunas simples. Apenas GET; paginação permanece na mesma origem e coleção. Limites: 20 mil registros, 8 MB, 25 páginas, 30 segundos. Cache de consulta por espaço: 30 segundos. Salvar cenário/planejamento exige snapshot recente, de até cinco minutos.

Mapear os nomes originais das propriedades SAP para:

```json
{
  "id": "DocumentId",
  "center": "CostCenter",
  "company": "Company",
  "date": "PostingDate",
  "actual": "ActualAmount",
  "budget": "BudgetAmount",
  "currency": "Currency"
}
```

Identificador único; data de competência válida `AAAA-MM-DD`; moeda BRL; medidas finitas. Valores obrigatórios ausentes, moeda diferente e identificadores duplicados são recusados. Pode usar `fixedCurrency:"BRL"` em vez de `currency` somente quando a origem já garantir BRL. O orçamento precisa ser aditivo na granularidade dos registros: não repetir um orçamento mensal em cada lançamento. A CLARA não deduplica regras contábeis nem converte moedas implicitamente.

Planejamento atual usa Tecnologia, Operações, Comercial e Administrativo; cenário reduz Tecnologia na base completa. Outros centros aparecem em consultas/gráficos, mas ampliar planejamento/cenários exige estender esse modelo. O endpoint técnico é único por ambiente; implementar autorização/recorte por empresa na origem ou no adaptador antes de atender públicos com acesso SAP distinto. Os papéis da CLARA protegem espaços e ações; não substituem as autorizações do SAP.

## Referências

- [SAP Analytics Cloud](https://www.sap.com/products/data-cloud/cloud-analytics.html): referência de experiência analítica, planejamento e análise preditiva.
- [Docker Compose](https://docs.docker.com/compose/gettingstarted/): execução e configuração dos serviços.
- [Kustomize no Kubernetes](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/): bases e customizações declarativas.
