# TheHarness

Uma configuração de agentes para **GitHub Copilot e Kiro** que vive em **um
repositório** e vale para **todos os outros**. Você clona ao lado dos seus projetos, roda o
bootstrap, e cada repositório passa a ter os mesmos agentes, skills, regras e
guardrails — sem copiar arquivo e sem sujar o git de ninguém.

Duas leituras do mesmo ciclo:

- **Para aprender do zero**, treze cenas com uma pergunta cada: [ciclo-passo-a-passo.html](ciclo-passo-a-passo.html) — abra o arquivo direto no navegador, ou veja [publicado](https://claude.ai/code/artifact/7624f992-367b-49b5-806a-5cd00ec04ab0).
- **Para consultar**, os diagramas por inteiro: [Ciclos de Desenvolvimento](https://claude.ai/code/artifact/b98e7796-a8fc-49c1-9dd5-8df74d6703de).

## Começar

```bash
git clone https://github.com/voce/TheHarness.git
cd TheHarness
./bootstrap.sh
```

No Windows: `.\bootstrap.ps1`. Sem admin. Requisito único: Node 18 ou mais novo.

## O que o bootstrap faz

Ele é um script fino. Toda a lógica está em `bin/harness.mjs`; o bootstrap só
encadeia quatro passos:

| passo | comando | o que acontece |
|---|---|---|
| 0 | checa o Node | Para com uma mensagem clara se não houver Node 18+ |
| 1 | `harness scan ..` | Percorre a pasta que contém o harness, até dois níveis, e anota cada repositório git, a stack e a ferramenta detectadas em `harness.config.json` |
| 2 | `harness link --all` | Instala em cada repositório encontrado |
| 3 | `harness doctor` | Confere que tudo ficou no lugar |

Para apontar outras pastas: `./bootstrap.sh /caminho/a /caminho/b`.

**O que o passo 2 escreve em cada repositório**, e só isso:

- **Links de diretório** para `.github/instructions`, `skills`, `prompts`,
  `agents`, `chatmodes`, `hooks`, `tools` e `rubrics`, apontando para a fonte
  dentro do harness. No Windows são junctions, que não exigem elevação e
  atravessam volumes. Editar uma skill no harness vale na hora em todo repo.
- **Três cópias com hash**: `.github/copilot-instructions.md`, `AGENTS.md` e
  `.mcp.json`. Cópia porque link de arquivo único no Windows exigiria admin;
  hash para o `doctor` acusar se alguém editar a cópia.
- **Uma entrada em `.git/info/exclude`**, que é o ignore local do git e nunca é
  commitado. Por isso `git status` fica limpo e o time não vê nada.
- **Um `pre-commit`** que roda os guardrails. Se já existir um hook de outra
  ferramenta, o harness não sobrescreve: avisa e segue.

Nada é sobrescrito. Se o repositório já tem um `AGENTS.md` próprio ou um
`.github/instructions` real, aquele item é recusado e o resto é instalado.

**Para desfazer tudo:** `node bin/harness.mjs unlink --all`. Guiado pelo lock,
deixa cada repositório byte-idêntico ao que era, incluindo os diretórios que a
instalação criou e ninguém mais usa.

## Copilot e Kiro

O `scan` olha o repositório e decide: `.github/` presente vira alvo `copilot`,
`.kiro/` vira `kiro`, os dois viram os dois. `--target=kiro` força.

O princípio é o mesmo nos dois: **linkar o conteúdo real, gerar só o que muda
de formato**. No Kiro o conteúdo é linkado em `.kiro/harness/`, e o que se
gera são arquivos finos de steering, um por instruction e um por skill, com
uma linha `#[[file:...]]` apontando para o original. Editar uma skill no
harness continua valendo na hora, sem regerar nada.

| | Copilot | Kiro |
|---|---|---|
| conteúdo | `.github/` | `.kiro/harness/` |
| instruções | `applyTo` no frontmatter | steering com `inclusion: fileMatch` |
| skills | lidas por relevância | steering `inclusion: manual`, uma por skill |
| hooks | `core/hooks/harness.json` | `.kiro/hooks/harness.json`, gerado |
| MCP | `.mcp.json` | `.kiro/settings/mcp.json` |
| specs | `specs/NNN-slug/spec.md`, `plan.md` | `.kiro/specs/NNN-slug/requirements.md`, `design.md` |

Os arquivos gerados entram no lock com hash, então o `doctor` acusa se alguém
editar um deles à mão ou se a fonte tiver mudado desde a última instalação.

**Duas lacunas reais, documentadas e não contornadas.** O Kiro não tem
equivalente para `SubagentStart`, `SubagentStop` e `PreCompact`. Num repo só de
Kiro, a telemetria de sub-agente, a validação do envelope de handoff e o
resgate antes da compactação não rodam. O `doctor` avisa. Mapear esses eventos
para outros próximos seria pior: um guardrail que dispara na hora errada é pior
que um que todo mundo sabe que falta.

Em compensação o Kiro tem `PostTaskExecution`, que fecha exatamente uma tarefa
de spec. O coletor do dream roda ali também.

## Dreaming

Uma sessão termina e leva junto tudo o que aprendeu. A próxima começa do mesmo
lugar e faz o mesmo desvio. O ciclo abaixo é o que corta isso, e ele acontece
**entre** sessões, sem custo de sessão extra e sem daemon.

| quando | quem | o que faz |
|---|---|---|
| a sessão fecha | `dream-collect`, em Node | Lê os `session.md` fechados e grava o que é mecanicamente observável em `.harness/dream-pending.json` |
| a sessão seguinte abre | `session-context` | Injeta o material e o contrato de extração, e apaga o pendente |
| durante esse turno | a skill `dreaming` | Escreve candidatos em `_dreams.md` |
| quando você quiser | `harness dream` | Lista, promove ou descarta |

O coletor não roda modelo nenhum e sai calado quando nada fechou desde a última
passada. Ele repara em coisas que só aparecem olhando várias sessões: a mesma
fase escalando, uma fase rodando duas vezes, trilhas promovidas do mesmo ponto,
requisitos que ficaram sem teste, um critério de rubrica sempre no fundo.

**Candidato não é memória.** A extração escreve em `_dreams.md`. Só uma pessoa
move para `_decisions.md`, com `harness dream --promote=<id>`. A separação é o
ponto: um erro de extração em `_dreams.md` é uma sugestão que ninguém aceita, e
o mesmo erro em `_decisions.md` é uma regra que toda sessão futura herda.

Duas regras decidem quase tudo: **um padrão precisa de duas sessões**, e todo
candidato cita as sessões em que se apoia. O `doctor` reprova o que não citar,
e o `--promote` recusa. Descartar exige `--why`, senão o mesmo candidato volta
no mês que vem.

```bash
node bin/harness.mjs dream <repo>
node bin/harness.mjs dream <repo> --promote=D-007
node bin/harness.mjs dream <repo> --discard=D-009 --why="uma sessão só"
```

## No dia a dia

Trabalho de vários passos começa com `/feature` ou `@orchestrator`. Ele escolhe
uma **trilha** — quais das seis etapas o pedido realmente precisa — e para para
você confirmar antes de começar.

| trilha | etapas | teto |
|---|---|---|
| `patch` | implement → review → deliver | 115k |
| `incident` | implement → review → deliver, mais runbook e um `fix` de follow-up | 115k |
| `fix` | specify → implement → review → deliver | 145k |
| `spike` | specify → plan | 80k |
| `refactor` | plan → tasks → implement → review → deliver | 190k |
| `feature` | as seis | 220k |

Entre cada etapa aparece um botão. Você lê o artefato e confirma. O estado da
sessão fica em `specs/NNN-slug/session.md` — ou `.kiro/specs/NNN-slug/session.md`
num repo de Kiro — commitado, então dá para fechar o editor e retomar com
`/resume`. O início da sessão diz qual é o layout, para ninguém ter que adivinhar.

Para abrir um pull request de um branch pronto, sem sessão: `/deliver` ou
`@azure-devops`.

## Verificação proporcional e WARN

Três regras cortam o custo das etapas de `fix` e `patch` sem tirar verificação
do caminho. Elas vivem em `core/instructions/token-economy.instructions.md`,
carregada em todo turno, e nos contratos do `implementer`, do `reviewer` e do
`orchestrator`.

- **Um resultado vale até a árvore mudar.** O `implementer` registra o que
  rodou e em qual estado da árvore (`node .github/tools/verify/tree-state.mjs`,
  uma linha determinística). Dentro do loop de verificação só o check que
  falhou roda de novo; a suíte completa roda uma vez, na árvore final. O
  `reviewer` roda a dele uma vez, porque revisão independente é o contrato; a
  pontuação da rubrica, o deliver e os retries reaproveitam o registro. Uma nova
  rodada precisa de uma falha nova, um finding aberto ou um risco não checado.
- **Problema preexistente é WARN, não correção.** A revisão aponta o que a
  mudança introduziu ou alterou. O que já existia no arquivo tocado vira uma
  linha `WARN local - problema - melhoria sugerida`, gravada em `session.md`,
  levada ao corpo do pull request, e nunca bloqueia um gate nem abre outra
  rodada. Antes de apontar falta de tratamento de erro, o revisor olha o que a
  aplicação já tem: um controller atrás de um exception filter global não é
  finding.
- **Duas rodadas de revisão.** `request-changes` manda ao `implementer` só os
  blockers e majors, e a re-revisão lê só o delta e confirma cada finding. Um
  finding ainda aberto na segunda rodada escala: o problema está antes da
  correção.

O hook `burn-detect` conta releituras por caminho e zera o contador quando o
conteúdo muda: reler um arquivo recém-editado não avisa; reler três vezes um
arquivo que não mudou, avisa.

## Cross TK

Quando um servidor MCP chamado `cross-tk` (qualquer grafia) está conectado, os
agentes preferem as ferramentas dele para ler, buscar e resumir, descobrindo o
que ele oferece pelas descrições das ferramentas. O harness não presume nomes
nem assinaturas. O início da sessão diz se há um configurado no repositório
(`.mcp.json`, `.vscode/mcp.json` ou `.kiro/settings/mcp.json`); se não há, o
agente diz isso uma vez e segue com as ferramentas nativas, sem tentar de novo.

Para habilitar em todos os repositórios, preencha a entrada `cross-tk` em
`core/mcp.json` com o comando real e mova-a para `servers`. O `doctor` recusa
um servidor habilitado enquanto houver `TODO` no comando, nos argumentos, no
dono ou na versão.

## Comandos

| comando | faz |
|---|---|
| `harness scan <pasta> [--depth=N]` | Descobre repositórios e detecta a stack |
| `harness link --all` | Instala em todos |
| `harness link <repo> --force` | Reinstala um, sobrescrevendo edições locais |
| `harness vendor <repo>` | Instala como cópias commitáveis, para times que preferem assim |
| `harness unlink --all` | Remove tudo |
| `harness doctor` | Contratos, grafo de delegação, alcance, drift |
| `harness budget` | Custo do contexto por tier |
| `harness cost` | Custo por resultado entregue, por trilha e agente |
| `harness improve` | Lê a telemetria e aponta o que mudar no harness |
| `harness dream <repo>` | Lista os candidatos; `--promote`, `--discard --why`, `--collect` |
| `harness eval` | Evals estruturais; `--emit` e `--check` para as comportamentais |
| `harness new agent\|skill\|instruction <nome>` | Scaffold com todas as seções obrigatórias |

Execute com `node bin/harness.mjs <comando>`.

## O que vai dentro

```
core/                  propagado para todo repositório
  copilot-instructions.md   sempre carregado, teto de 2 KB
  AGENTS.md                 o contrato de agentes e sessões
  instructions/  18         regras por tipo de arquivo
  skills/        37         procedimentos, por relevância
  agents/         8         orchestrator, 4 de fase, reviewer, security, azure-devops
  prompts/        9         /feature, /resume, /deliver e os loops
  rubrics/        3         a régua de cada etapa que julga
  hooks/          8 eventos guardrails de runtime, de pre-commit e o coletor do dream
  tools/                    scripts determinísticos: ado/, spec/ e verify/
loops/                 os três loops e os orçamentos
templates/             spec, plan, tasks, session, runbook, postmortem, ADR, decisions, dreams
```

O conteúdo de `core/` está em inglês de propósito: custa cerca de 25% menos
tokens que português, e é cobrado a cada turno.

## O que o doctor cobra

Toda skill com cinco seções e todo agente com seis. Todo sub-agente existe e
quem delega tem a ferramenta para isso. Toda skill é alcançável por algum
agente, toda rubrica tem um juiz, toda trilha é conhecida por quem escolhe
trilhas. O tier quente cabe em 2 KB. Nenhuma trilha entrega sem revisão. Roda no
CI a cada push.

## Guardrails

Os mesmos scripts rodam como hooks do VS Code durante a sessão e como
`pre-commit` no git. Eles leem o índice (não a árvore de trabalho) e cobrem os
formatos reais de credencial: `.env`, YAML sem aspas, tfvars, Secret do
Kubernetes, `Default` de CloudFormation. Um `.env` também não pode ser **lido**
para dentro do contexto.

Dois níveis de resposta. Um **arquivo** que nunca deve entrar no histórico
(`.env`, chave privada, `tfstate`, kubeconfig) é recusado pelo `policy-gate`,
que falha fechado quando o git não responde. Um **valor** com cara de
credencial dentro de um arquivo comum gera aviso, não bloqueio: o
`secret-block` deixa o commit seguir, imprime o achado com o valor redigido e
grava uma linha em `.harness/secrets.log` no repositório, fora do git. O aviso
diz o que o bloqueio não dizia: o valor que chegou ao histórico está
comprometido e precisa ser rotacionado, remover a linha não resolve. Falso
positivo documentado leva o comentário `harness:allow-secret` na linha.

```bash
npm run selftest          # 72 casos de guardrail, em repositórios descartáveis
npm run selftest:dream    # 27 casos de consolidação, com sessões sintéticas
npm run selftest:spec     # 19 casos de rastreabilidade, nos dois layouts
```

Os guardrails recebem o evento por STDIN no VS Code e no Kiro. O modo vem do
`env` no primeiro e de `--hook-mode=kiro` no argv no segundo, porque o schema de
hook do Kiro não tem campo `env`. O self-test confere caso a caso que a decisão
sai igual pelas duas portas.

## Estender para a sua stack

```bash
node bin/harness.mjs new agent aws-infra --internal
node bin/harness.mjs new skill cloudformation-changeset
```

O esqueleto sai com as seções obrigatórias. O `doctor` recusa enquanto o texto
de exemplo não for substituído — de propósito. Para entrar na sessão, some o
nome à lista de sub-agentes do `orchestrator`.

## Licença

MIT.
