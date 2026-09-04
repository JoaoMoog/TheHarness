# TheHarness

Uma configuração de agentes para GitHub Copilot que vive em **um repositório** e
vale para **todos os outros**. Você clona ao lado dos seus projetos, roda o
bootstrap, e cada repositório passa a ter os mesmos agentes, skills, regras e
guardrails — sem copiar arquivo e sem sujar o git de ninguém.

Como funciona por dentro, com diagramas: [Ciclos de Desenvolvimento](https://claude.ai/code/artifact/b98e7796-a8fc-49c1-9dd5-8df74d6703de).

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
| 1 | `harness scan ..` | Percorre a pasta que contém o harness, até dois níveis, e anota cada repositório git e a stack detectada em `harness.config.json` |
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
deixa cada repositório byte-idêntico ao que era.

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
sessão fica em `specs/NNN-slug/session.md`, commitado, então dá para fechar o
editor e retomar com `/resume`.

Para abrir um pull request de um branch pronto, sem sessão: `/deliver` ou
`@azure-devops`.

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
| `harness eval` | Evals estruturais; `--emit` e `--check` para as comportamentais |
| `harness new agent\|skill\|instruction <nome>` | Scaffold com todas as seções obrigatórias |

Execute com `node bin/harness.mjs <comando>`.

## O que vai dentro

```
core/                  propagado para todo repositório
  copilot-instructions.md   sempre carregado, teto de 2 KB
  AGENTS.md                 o contrato de agentes e sessões
  instructions/  17         regras por tipo de arquivo
  skills/        36         procedimentos, por relevância
  agents/         8         orchestrator, 4 de fase, reviewer, security, azure-devops
  prompts/        9         /feature, /resume, /deliver e os loops
  rubrics/        3         a régua de cada etapa que julga
  hooks/          8 eventos guardrails de runtime e de pre-commit
  tools/                    scripts determinísticos: ado/ e spec/
loops/                 os três loops e os orçamentos
templates/             spec, plan, tasks, session, runbook, postmortem, ADR
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
`pre-commit` no git. Eles leem o índice (não a árvore de trabalho), falham
fechado quando o git não responde, e cobrem os formatos reais de credencial:
`.env`, YAML sem aspas, tfvars, Secret do Kubernetes, `Default` de
CloudFormation. Um `.env` também não pode ser **lido** para dentro do contexto.

```bash
node core/hooks/scripts/selftest.mjs   # 36 casos, com repositórios descartáveis
```

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
