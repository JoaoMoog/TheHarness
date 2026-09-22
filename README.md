# TheHarness

Harness portátil para **GitHub Copilot no VS Code** e **Kiro IDE 1.x**.
A tarefa termina com alterações locais verificadas. Preparar o índice, fazer
commit, push, abrir PR e publicar são ações manuais.

## Execução proporcional

| Caminho | Quando | Execução |
|---|---|---|
| Direto | Objetivo claro, alteração localizada e teste direcionado, incluindo regressão nova | Agente atual; sem sessão documental, subagentes ou aprovação de fase |
| Estruturado | Vários componentes, contratos públicos ou requisitos significativos | plan → implement → review → done |
| Sensível | Auth, autorização, pagamentos, criptografia, dados de produção ou operação destrutiva | Confirmação específica antes do escopo sensível; autorização existente vale |

O planejamento estruturado produz requisitos, desenho e tarefas em uma execução,
com uma aprovação antes da implementação. Revisão independente ao final, no máximo
duas rodadas de correção restritas aos achados. Quantidade de arquivos é um sinal,
não uma regra exclusiva. As trilhas patch/fix/refactor/feature/incident/spike
continuam disponíveis quando há sessão; uma correção simples não precisa delas.

Nenhum fluxo publica automaticamente. A antiga fase delivery, agente Azure DevOps,
comandos de PR/commit/comentários/pipelines e rubrica de PR foram removidos.
Sessões antigas em delivery retomam review/verificação; o histórico permanece.
Só marcar done após evidência atual. Spike termina com uma resposta documentada,
sem alegar validação de código.

## Instalação e atualização manual

Requer Node.js 18+ e Git; desenvolvimento/CI usam Node 22. Não é necessário instalar
Playwright para instalar o harness em outro projeto.

Crie um checkout isolado antes de editar a fonte: links propagam mudanças imediatamente.
Na pasta da fonte, use:

~~~sh
node bin/harness.mjs scan ../projetos
node bin/harness.mjs link nome-do-piloto --target=copilot
node bin/harness.mjs link nome-do-piloto --target=kiro
node bin/harness.mjs doctor
~~~

Cada --target substitui a seleção nessa instalação. Para os dois, use
--target=copilot,kiro. Grave também targets no harness.config.json para manter
a seleção nas próximas atualizações. Exemplo:

~~~json
{
  "version": 1,
  "roots": ["../projetos"],
  "defaults": { "mode": "link", "gitHooks": true },
  "repos": {
    "piloto": {
      "path": "../projetos/piloto",
      "stacks": ["node-ts"],
      "targets": ["copilot", "kiro"]
    }
  }
}
~~~

- link: junctions no Windows, links simbólicos no Linux; adaptadores são gerados.
- vendor: cópias versionáveis, com filtro das instruções de stack.
- Reexecute link ou vendor para atualizar somente o piloto.
- unlink nome-do-piloto remove apenas conteúdo gerenciado e intacto.
- Atualização e remoção comparam hashes e destinos dos links. Arquivos externos,
  personalizados e conflitos são preservados e reportados. Não há substituição
  destrutiva por --force. Resolva cada conflito no diff e reinstale.
- Hooks Git também são protegidos por hash. Um hook legado sem registro de hash
  é preservado como conflito, inclusive quando contém o marcador do harness.
- Guarde harness.lock.json: ele registra a propriedade dos arquivos. Se perdido,
  arquivos existentes são tratados como externos, mesmo com conteúdo idêntico.
- Ao mudar de fonte isolada, leve a configuração e o lock da instalação anterior
  para que a atualização reconheça arquivos antigos. Não apague personalizações.
- Instalações antigas com arquivos de entrega intactos são limpas pela atualização.
  Uma cópia personalizada é preservada como conflito; remova-a manualmente após
  revisar seu conteúdo antes de retomar o agente.

O CI permanece para validar seus futuros commits/PRs; o agente não o aciona.

## Formatos por cliente

| Recurso | Copilot / VS Code | Kiro IDE 1.x |
|---|---|---|
| Base | AGENTS.md + .github/copilot-instructions.md | AGENTS.md |
| Condicionais | .github/instructions | .kiro/steering, fileMatch |
| Skills | .github/skills | .kiro/skills nativas |
| Agentes | .github/agents/*.agent.md | .kiro/agents/*.json |
| MCP | .vscode/mcp.json, servers, variável env:VAR | .kiro/settings/mcp.json, mcpServers, variável VAR |
| Comandos | .github/prompts | .kiro/steering com inclusion: manual |
| Hooks | .github/hooks/harness.json | .kiro/hooks/harness.json, v1 |
| Ferramentas/templates | .github/tools, .github/templates | .kiro/harness/tools, .kiro/harness/templates |

Os adaptadores preservam timeout, convertem variáveis de ambiente e separam
catálogo de ferramentas por agente. Kiro inclui somente servidores explicitamente
declarados para cada agente; includeMcpJson e includePowers ficam desativados.
Cross TK é opcional, nunca instalado nem obrigatório. Habilite um servidor em
core/mcp.json e atualize manualmente o piloto para usá-lo nos agentes gerados.

Kiro não possui equivalentes de SubagentStart, SubagentStop e PreCompact nesta
matriz. doctor reporta a limitação por cliente, mesmo quando ambos estão instalados.
Um ask de ferramenta sensível no Kiro bloqueia e explica a confirmação necessária;
seu protocolo não oferece o mesmo permissionDecision do VS Code.
Hooks são guardrails de comandos reconhecidos, não uma sandbox universal.

Os formatos foram conferidos com documentação oficial em setembro de 2026.
Reconhecimento na interface, catálogo conectado e permissões devem ser confirmados
no editor real durante o piloto; CLIs não estão na matriz de compatibilidade.
Não se deve confundir um code.cmd do Cursor com VS Code.

## Contexto e custo

~~~sh
node bin/harness.mjs budget --json
node bin/harness.mjs budget --target=kiro --repo=C:/projetos/piloto --json
node bin/harness.mjs cost --repo=C:/projetos/piloto --json
node bin/harness.mjs improve
~~~

Teto: 2.000 tokens **estimados** de instruções permanentes por cliente.
O relatório inclui AGENTS.md, instruções globais, inclusões expandidas e o pior
caso com prompt de agente ativo. No Kiro, AGENTS.md explícito no recurso do agente
é contado novamente conservadoramente. Não há deduplicação artificial.
Catálogos de skills, ferramentas e contexto do projeto aparecem separadamente.
A estimativa usa caracteres por token, não o tokenizer de um provedor.

cost agrupa resultados explícitos: validated, failed, blocked, not-run ou unknown
(telemetria antiga sem resultado). Duração total exige início e resultado.
Tempos de ferramentas só aparecem quando o runtime os informa; hooks registram
duração por check. A soma do tempo dos agentes pode sobrepor a duração total.
Espera por aprovação e tokens reais permanecem null quando indisponíveis.
Contagem de chamadas e bytes são observações; não representam cobrança.
Um evento provider-usage com total tokens medidos deve vir de exportação do cliente,
nunca de uma estimativa do agente. approval-wait exige uma duração realmente medida.

## Evidência reutilizável

Nos exemplos abaixo, substitua .github por .kiro/harness no Kiro.

~~~sh
node .github/tools/verify/run.mjs --argv='["node","--test","tests/regression.test.mjs"]' --reuse
node .github/tools/verify/outcome.mjs --session=tarefa-001 --status=validated --records='[".harness/verification/IDENTIDADE.json"]'
~~~

PowerShell pode exigir a forma de passagem de aspas suportada pela sua versão.
A API JavaScript exportada de run.mjs aceita argv como array sem shell.
Para npm no Windows o runner resolve a entrada JS local, sem interpolar comandos.

O runner guarda comando, identidade SHA-256 de conteúdo/ambiente, duração, status
e log em .harness/verification. Arquivos de configuração rastreados, lockfiles,
arquivos não rastreados e envs de teste entram na identidade. Relatórios de sessão
e .harness ficam fora. Use --inputs para configuração ignorada adicional e
--environment para versão do browser/servidor/dados ou outros estados externos.
Nunca reutilize evidência de servidor remoto sem uma identidade verificável dele.

Somente uma evidência passed, estável e ainda compatível pode sustentar validated.
Escopo estruturado também requer --track=feature e --review=approve
(ou approve-with-comments) após revisão independente. Registre todos os checks
necessários. Falha/bloqueio exige --reason; comando que não executou nunca é passed.
A ferramenta verifica os registros; não decide sozinha quais testes cobrem o requisito.

Formatação é explícita e em lote, antes da validação:

~~~sh
node .github/hooks/scripts/format.mjs --files='["src/example.js"]' --argv='["node","node_modules/prettier/bin/prettier.cjs","--write"]'
~~~

Use o formatter real do projeto; o exemplo não instala pacotes.
O harness não chama git add e preserva conteúdo já preparado no índice.

## Playwright

A skill playwright-testing detecta configuração existente, reutiliza gerenciador
de pacotes, servidor e fixtures e valida o fluxo afetado. Quando falta Playwright,
inclui a configuração no plano antes de alterar dependências do projeto.
Playwright CLI é opcional para exploração; não há MCP de navegador permanente.

No próprio TheHarness:

~~~sh
npm ci
npx playwright install chromium
npm run test:e2e
npx playwright install firefox webkit
npm run test:e2e:full
~~~

Playwright Test está fixado em 1.63.0. O padrão é Chromium; full inclui Firefox
e WebKit. A suíte cobre os três guias: carregamento, navegação, teclado,
reprodução/pausa, limites das cenas, âncoras, links locais, viewport pequeno e
erros JavaScript. Screenshot nas falhas; trace na primeira repetição do CI.
O servidor aceita somente arquivos dos guias. Prometeu não faz parte da suíte.

## Validação e piloto

~~~sh
npm test
npm run selftest
npm run selftest:dream
npm run selftest:spec
npm run validate
npm run eval
node bin/harness.mjs eval --trace=trace-real.json
node evals/pilot.mjs docs/pilot-samples.json
~~~

Os testes automatizados exercitam instalação/atualização/remoção, preservação de
arquivos, adapters, cache, resultado explícito, índice Git e guardrails.
CI contém Windows e Linux; a validação local não substitui uma execução Linux.
Evals textuais continuam disponíveis via --emit e --check. --trace valida ações,
aprovações, artefatos e resultados observados, sem confundir resposta com execução.

[Protocolo do piloto](docs/pilot.md) define 36 execuções, em dois clientes,
com três tarefas e três repetições antes/depois. O comparador recusa amostras
incompletas ou não equivalentes. Sem dados reais, o resultado é pending.
Metas: menos 50% no tempo mediano, menos 40% em tokens medidos, critérios
funcionais e guardrails preservados. São metas experimentais, não promessas.

Coleta e consolidação de memória ocorrem somente por /dream ou
harness dream --collect. Nada roda automaticamente no encerramento comum.

## Referências

- [GitHub: instruções e skills](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)
- [VS Code: agentes](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [Kiro: skills](https://kiro.dev/docs/skills/) e [agentes](https://kiro.dev/docs/custom-agents/configuration-reference/)
- [Kiro: MCP](https://kiro.dev/docs/mcp/configuration/) e [hooks](https://kiro.dev/docs/hooks/)
- [Playwright: boas práticas](https://playwright.dev/docs/best-practices/) e [CLI](https://github.com/microsoft/playwright-cli)
- [Agentic DevOps Hub](https://agenticdevopsplatform.ai/pt-br/#start) e [Awesome Copilot](https://github.com/github/awesome-copilot)

Adoção seletiva: contexto progressivo, rotas por risco, teste reproduzível e
medição por resultado. Nenhum catálogo externo foi importado integralmente.
