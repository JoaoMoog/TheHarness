# Target `claude` (Claude Code) — design

Data: 2026-09-05. Fase 1 de uma entrega faseada: **Claude Code agora, Codex CLI
depois**, em spec própria. Motivo do faseamento: o formato do Claude Code está
documentado com precisão e é o ambiente em que esta própria sessão roda; o do
Codex CLI tem pontas reais em aberto (schema exato de hooks, sintaxe TOML
multi-linha, restrição de "projeto confiável") que merecem seu próprio ciclo de
verificação em vez de herdar suposições daqui.

## Contexto

O harness hoje tem dois targets, `copilot` e `kiro`, definidos em
[targets.mjs](../../../src/lib/targets.mjs). Cada um linka o conteúdo real de
`core/` e gera só o que muda de formato — ver `kiro-gen.mjs` para o precedente
(steering + hooks). Este documento estende o mesmo padrão para o Claude Code,
que os usuários já rodam tanto no terminal quanto na extensão do VS Code.

Fontes usadas pra confirmar formato (não é suposição):
[Claude Code .claude dir](https://code.claude.com/docs/en/claude-directory) ·
[hooks 2026](https://thepromptshelf.dev/blog/claude-code-hooks-complete-reference-2026/) ·
[AGENTS.md vs CLAUDE.md](https://agyn.io/blog/claude-md-agents-md-compatibility).

## Escopo desta fase

Dentro: target `claude` completo — detecção, superfícies, dois geradores
novos, ajuste de `doctor`/`install`/`unlink` pra suportar geração parcial de
arquivo, README, testes. Um pequeno fix cross-cutting (seção "Gap pré-existente
corrigido aqui") que também beneficia `copilot`/`kiro`.

Fora: target `codex` (spec própria, fase 2). Mudar o schema que `copilot`/
`kiro` já escrevem em `.mcp.json`/`.kiro/settings/mcp.json` hoje.

## Target `claude`

```js
claude: {
  id: 'claude',
  label: 'Claude Code',
  detect: '.claude',
  dirSurfaces: [
    // Claude Code lê SKILL.md neste formato nativamente — link direto, sem
    // geração, como o harness já faz para o Copilot.
    { source: 'core/skills', target: '.claude/skills' },
    // Sem equivalente nativo de carregamento por glob (ver "Gaps").
    // Ficam aqui só para referência por path a partir de agents/skills.
    { source: 'core/instructions', target: '.agents/instructions' },
    { source: 'core/rubrics', target: '.agents/rubrics' },
    { source: 'core/tools', target: '.agents/tools' },
  ],
  fileSurfaces: [
    { source: 'core/AGENTS.md', target: 'AGENTS.md' },
  ],
  generators: ['agents', 'commands', 'settings-hooks', 'mcp', 'claude-md'],
  unmappedEvents: [],
  unmappedSurfaces: ['core/instructions'],
  prunable: ['.claude', '.harness'],
  hooksAt: '.claude/harness/hooks', // scripts linkados aqui para os comandos gerados apontarem
  specs: { dir: 'specs', layout: 'harness' },
},
```

Note que `core/tools`, `core/rubrics` e `core/instructions` (para o Claude)
deixam de viver só sob o prefixo de um target (`.github/tools`,
`.kiro/harness/tools`) e passam a ter **um** lugar adicional, compartilhado,
`.agents/`, usado por qualquer target ativo. Isso não é exclusivo do Claude —
é o fix da próxima seção. **Não é `.harness/`**: esse nome já é usado pelo
harness para estado de runtime que os hooks escrevem (`telemetry.jsonl`,
`dream-pending.json`, `sessions.jsonl` — ver `RUNTIME_DIRS` em
[paths.mjs](../../../src/lib/paths.mjs:26)), nunca commitado e sem relação com
conteúdo linkado. `.agents/` é livre no repositório hoje, e por coincidência é
também o path nativo que o Codex CLI já usa para skills de projeto
(`.agents/skills`) — um alinhamento de graça para a fase 2.

## Gap pré-existente corrigido aqui

Nove arquivos em `core/` chamam ferramentas por um path que assume o Copilot
(`grep -rn '\.github/tools\|\.github/skills' core/ templates/` encontra todos):

- `core/agents/azure-devops.agent.md:29,39`
- `core/agents/implementer.agent.md:33`
- `core/skills/codebase-inventory/SKILL.md:43` (`.github/skills/...`)
- `core/skills/ado-pull-request/SKILL.md:52`
- `core/skills/ado-pipeline/SKILL.md:48,51`
- `core/skills/ado-comment/SKILL.md:48`
- `core/skills/traceability/SKILL.md:50`
- `core/prompts/deliver.prompt.md:9,17`
- `templates/spec.md:60`

(`core/hooks/scripts/selftest.mjs:227-233` também contém `.github/tools/ado/...`,
mas só como exemplo de comando passado a `ado-gate.mjs`, que casa por nome de
arquivo — `pipeline-run.mjs`, `pr-create.mjs` — não por prefixo. Não precisa
mudar.)

Isso já está errado hoje num repositório só-Kiro (o path real lá é
`.kiro/harness/tools/...`), e ficaria errado de novo em `.claude/`. Como esses
arquivos são **linkados**, não gerados, o mesmo texto é lido por todo target —
não dá para ter um path por target dentro do mesmo arquivo.

Fix: os nove passam a referenciar `.agents/tools/...` e
`.agents/skills/codebase-inventory/scripts/inventory.mjs`, e `core/tools` /
`core/rubrics` / `core/skills` ganham uma superfície **adicional,
compartilhada por todos os targets** (`.agents/tools`, `.agents/rubrics`,
`.agents/skills`), linkada uma vez, ao lado — não em vez — do que cada target
já linka no seu próprio prefixo nativo. `copilot` e `kiro` passam a receber
esse link extra também (redundante com `.github/tools`/`.kiro/harness/tools`,
mas inofensivo: é outro link para o mesmo conteúdo, sem risco de drift) — sem
mudar nada do que já funciona, só corrigindo os paths que já estavam quebrados
fora do Copilot.

**Achado adicional, também bloqueante**: `core/hooks/scripts/lib/io.mjs:18`
tem `const STDIN_MODES = new Set(['vscode', 'kiro'])`. Um hook do Claude
rodaria com `HARNESS_HOOK_MODE=claude`, que não está nesse conjunto —
`hookMode()` voltaria `null` e todo guardrail se comportaria como git hook
(sem ler stdin), um no-op silencioso sob o Claude. Fix: adicionar `'claude'`
ao `STDIN_MODES`.

## Gaps documentados (não contornados)

| gap | por quê | como aparece |
|---|---|---|
| `core/instructions` sem auto-load | Claude Code não tem conceito de regra por glob (`applyTo`/`fileMatch`); só CLAUDE.md, skills, agents, commands, hooks | `doctor` avisa via `unmappedSurfaces`, novo companheiro de `unmappedEvents` |

Eventos: os 8 do harness existem todos no Claude Code 2026 (inclusive
`SubagentStart`, adicionado recentemente) — `unmappedEvents: []`, diferente do
Kiro.

## Gerador `src/lib/claude-gen.mjs`

Mesmo espírito de `kiro-gen.mjs`: funções puras `{path, content}`, usadas tanto
pela instalação quanto pelo `doctor` para checar drift.

### `agents` — `core/agents/*.agent.md` → `.claude/agents/<nome>.md`

O corpo (tudo depois do front matter) passa **inalterado** — os seis
seções já servem de system prompt sem tradução. Só o front matter muda:

```
name: <nome do arquivo>
description: <passthrough>
tools: <TOOL_MAP aplicado, join por vírgula>
model: <primeiro nome da lista que bater num alias conhecido, senão omitido>
```

`TOOL_MAP` (nomes vistos nos 8 agents atuais):

| Copilot | Claude Code |
|---|---|
| `codebase` | `Read, Grep, Glob` |
| `search` | `Grep` |
| `usages` | `Grep` |
| `changes` | `Bash` |
| `runCommands` | `Bash` |
| `editFiles` | `Edit, Write` |
| `agent` | `Task` |
| `problems` | *(sem equivalente — descartado)* |

Um nome fora do mapa é descartado e reportado pelo `doctor`, nunca aproximado
— mesma regra dos eventos sem mapa do Kiro: um agente com a ferramenta errada
é pior que um sem ferramenta nenhuma.

`model`: a fonte tem uma lista (`[Claude Sonnet 4.5, GPT-5.2]`, pensada pro
seletor de modelo do VS Code). O gerador varre a lista e usa o primeiro nome
que casar com um alias do Claude Code (`sonnet`, `opus`, `haiku`); se nenhum
casar, omite o campo — o agente roda no modelo padrão da sessão em vez de
herdar um alias inventado.

### `commands` — `core/prompts/*.prompt.md` → `.claude/commands/<nome>.md`

Cada prompt tem exatamente um placeholder `${input:<nome>}` no corpo. O
gerador troca por `$ARGUMENTS` e usa `<nome>` como `argument-hint` no front
matter gerado (`description` passa direto; `mode` não tem equivalente e é
descartado — não há gap funcional, `mode: ask` só reduzia auto-invocação de
tool no Copilot Chat).

### `settings-hooks` — `core/hooks/harness.json` → chave `hooks` de `.claude/settings.json`

O shape já bate (`{matcher?, type: "command", command, timeout}` por evento),
então é principalmente reescrita de path: `.github/hooks/scripts/` vira
`.claude/harness/hooks/scripts/`, e o env passa a ser
`HARNESS_HOOK_MODE=claude`.

**`.claude/settings.json` não é dono exclusivo do harness.** Repositórios que
já usam Claude Code plausivelmente já têm esse arquivo com `permissions`,
`model` e outras chaves pessoais. Em vez do padrão "arquivo inteiro, recusa se
já existir" usado em `AGENTS.md`/`copilot-instructions.md`, aqui é um merge
restrito:

1. Lê o `.claude/settings.json` existente (`{}` se não existir; se o JSON for
   inválido, recusa este item inteiro e avisa — falha fechado, não tenta
   consertar o arquivo de outra pessoa).
2. Toda entrada de hook que o harness escreve tem `command` começando com
   `node .claude/harness/hooks/scripts/` — uma marca reconhecível.
3. Para cada evento gerado: remove do array existente as entradas que já
   carregam essa marca (a geração anterior do harness) e acrescenta as
   recém-geradas. Entradas de outra origem, e qualquer chave fora de `hooks`,
   nunca são tocadas.
4. Grava de volta. O lock guarda um **hash só da fatia marcada como do
   harness** (não do arquivo inteiro), num bucket novo `entry.mergedFiles`.

`doctor` compara essa fatia (entradas marcadas, por evento) com o que
`claudeHooks()` geraria agora — igual ao `checkGenerated` do Kiro, mas
recortado, não no arquivo inteiro.

`harness unlink` remove só as entradas marcadas. Se o arquivo não existia
antes da instalação (rastreado como hoje se rastreia `createdDirs`, aqui
`createdFiles`), e fica vazio (`{}`) depois de tirar as entradas do harness, o
arquivo é apagado; se já existia antes, nunca é apagado, só volta a não ter as
entradas do harness.

### `mcp` — `core/mcp.json` → `.mcp.json`

Diferente de `copilot`/`kiro`, que copiam `core/mcp.json` cru (schema
`servers`/`disabled`, que é o formato que o VS Code já lê), o Claude Code
espera a chave `mcpServers`. O gerador: para cada entrada em `servers` (nunca
em `disabled`), copia `command`/`args`/`env`/`url` e descarta os campos que só
existem para o humano decidir (`owner`, `trust`, `scope`, `version`).

**Conflito com `copilot`/`kiro` no mesmo repositório**: os dois schemas não
cabem no mesmo `.mcp.json`. Política: primeiro target a instalar escreve o
arquivo; o segundo pula esse item e `doctor` reporta nominalmente o gap
(`"<repo>: .mcp.json já pertence a <target>, <outro-target> ficou sem
servidores MCP"`), mesma filosofia de "nada é sobrescrito, o item é recusado"
já usada em todo canto do install. Um repositório que só usa um dos dois
targets — o caso mais comum, e o caso do usuário que pediu esta feature — nunca
vê esse aviso.

### `claude-md` — `CLAUDE.md`

Claude Code não lê `AGENTS.md` nativamente (nem como fallback — confirmado,
não é suposição). Gera um `CLAUDE.md` de uma linha, no mesmo espírito das
steering files do Kiro — inclui em vez de duplicar:

```
<!-- Generated by the harness. Edit AGENTS.md, not this file. -->
@AGENTS.md
```

Mesma regra de conflito dos outros arquivos que o harness é dono: se
`CLAUDE.md` já existe e não é uma cópia do harness, recusa e segue.

## Refactors necessários fora do gerador

`installGenerated` em [install.mjs](../../../src/commands/install.mjs:168) e
`checkGenerated` em [doctor.mjs](../../../src/commands/doctor.mjs:96) hoje
importam `generatedFiles` só de `kiro-gen.mjs`, direto — funciona porque só
existe um target com gerador. Com dois, isso precisa despachar por target. O
despacho não pode viver em `targets.mjs`: `kiro-gen.mjs` já importa `TARGETS`
de lá, então `targets.mjs` importar de volta `claude-gen.mjs`/`kiro-gen.mjs`
seria um ciclo. Em vez disso, um módulo novo, que depende dos três e não é
importado por nenhum deles:

```js
// src/lib/generators.mjs
import * as kiroGen from './kiro-gen.mjs';
import * as claudeGen from './claude-gen.mjs';

const GENERATOR_MODULES = { kiro: kiroGen, claude: claudeGen };

export function generatedFilesFor(targetIds) {
  const files = new Map();
  for (const id of targetIds) {
    for (const file of (GENERATOR_MODULES[id]?.generatedFiles() ?? [])) files.set(file.path, file);
  }
  return [...files.values()];
}
```

`install.mjs`/`doctor.mjs` passam a importar `generatedFilesFor` daqui em vez
de `generatedFiles` de `kiro-gen.mjs` direto, iterando os targets ativos do
repositório e mesclando por path (mesma regra de dedupe que `mergedSurfaces`
já usa pros links).

`unmappedSurfaces(ids)`: mesma forma de `unmappedEvents(ids)` em
[targets.mjs](../../../src/lib/targets.mjs:130) — interseção entre os targets
ativos, porque um segundo target que cobre a superfície fecha o gap.
`checkTargetGaps` no doctor ganha uma segunda chamada de aviso.

## Testes

- Unitários para as funções puras de `claude-gen.mjs`: `TOOL_MAP` (todas as 8
  combinações reais dos agents atuais, mais um nome desconhecido → descartado
  e reportado), reescrita de `${input:x}` → `$ARGUMENTS`, reescrita de path
  nos hooks, transformação `servers` → `mcpServers`.
- `npm run selftest`: casos novos comparando a decisão do hook via
  `.claude/settings.json` (`HARNESS_HOOK_MODE=claude`) com a mesma decisão via
  `.github/hooks/harness.json` — paridade, mesmo padrão que já existe entre
  VS Code e Kiro.
- Caso dedicado para o merge de `.claude/settings.json`: instala sobre um
  arquivo pré-existente com uma chave alheia (`{"model": "opus"}`) e uma
  entrada de hook alheia no mesmo evento; confere que as duas sobrevivem à
  instalação e à reinstalação, e que só a fatia do harness muda.
- `harness doctor --self`: os três arquivos do "gap pré-existente" (seção
  acima) não devem mais conter `.github/` depois do fix.

## README

Nova seção "## Claude Code", no molde de "## Copilot e Kiro"; a tabela de
comparação ganha uma terceira coluna. Menção ao gap de `core/instructions` e à
política de conflito de `.mcp.json` quando dois targets coexistem.

## Riscos / a confirmar durante a implementação

- Nomes exatos de ferramenta do Claude Code (`Read`, `Grep`, `Glob`, `Edit`,
  `Write`, `Bash`, `Task`) — alta confiança, mas checar contra a versão
  instalada antes de fechar o `TOOL_MAP`.
- Aliases de `model` aceitos (`sonnet`/`opus`/`haiku`) podem mudar de nome
  entre versões — se um alias não for reconhecido, o campo é omitido, nunca
  inventado.
