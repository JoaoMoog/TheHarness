# Proposta: AgentDesk Lite MVP

Status: RASCUNHO — requer aprovação.

## Problema e motivação

O fluxo alvo usa múltiplos repositórios e sessões de agentes. VS Code, extensões, servidores de linguagem, builds, watchers e terminais concorrem por recursos. O produto proposto é uma aplicação Windows local, pequena e auditável, focada em acompanhar processos de agentes já autorizados, revisar alterações Git, fazer edições pontuais e executar operações Git explícitas.

Ele não é um substituto geral de VS Code, não controla serviços de IA e não promete que agentes, Git ou suas redes operem offline. A meta é reduzir trabalho desnecessário da própria IDE sem reduzir a correção de edição/Git nem contornar políticas corporativas.

## Objetivos do MVP

- Catálogo local de pelo menos 12 repositórios, carregado sem varredura global.
- Editor confiável para arquivos de texto suportados, com preservação explícita de encoding e EOL.
- Status Git, diff inline e lado a lado, stage/unstage por arquivo e operações Git explícitas.
- Terminal interativo por sessão, sujeito ao gate ConPTY; sessões de CLIs oficiais quando elas estiverem instaladas e autorizadas.
- UI responsiva sem bloquear a thread gráfica em I/O, Git, parsing ou processos.
- Zero telemetria e nenhum serviço/rede iniciado pelo processo da IDE; nenhuma credencial persistida.
- Medição separada da IDE e dos processos filhos, com resultados documentados na máquina alvo.

## Não objetivos

- Electron, Chromium, webview, servidor HTTP local, marketplace, extensões, sync/cloud ou atualizador.
- Cliente próprio de LLM, chat próprio, orquestração autônoma, prompt automático ou armazenamento de cópias integrais de código.
- LSP sempre ativo, IntelliSense completo, debugger, indexação semântica global e IDE remota.
- Sandbox de segurança, bypass de proxy/EDR/firewall, gestão de credenciais ou garantias sobre conexões de processos filhos.
- Stage por hunk antes de um spike comprová-lo robusto.

## Escopo funcional

| Área | Incluído no MVP | Condição |
|---|---|---|
| Workspace | catálogo, rótulo, grupos opcionais, árvore lazy, detecção de raiz Git | sem seguir links indiscriminadamente |
| Editor | abrir, editar, salvar seguro, tabs, undo/redo, busca, ir à linha, gutter e conflitos externos | gate de componente editável |
| Diff | inline/lado a lado, estados index/worktree/HEAD, linhas e contexto | virtualização e limite de tamanho |
| Git | status porcelain v2 NUL, diff, stage/unstage por arquivo, commit, push/pull confirmados | Git CLI estruturado |
| Terminal/agentes | ConPTY, ANSI/VT, input, resize, scrollback limitado e lifecycle | gate de terminal real |
| Segurança | validação de caminho/executável, dados mínimos, logs opt-in e threat model | sem alegar sandbox |
| Recursos | fila, limites, métricas e benchmarks | metas somente após baseline |

## Invariantes de segurança e dados

1. O produto nunca trata buffer, disco, index e HEAD como a mesma versão.
2. O produto não salva tokens, prompts, código integral ou output integral por padrão.
3. Todo executável, diretório de trabalho e argumento de processo é validado e explícito; não há shell intermediário por padrão.
4. Git usa argumentos estruturados, separador de caminhos e protocolos de máquina, nunca parsing de texto humano localizado.
5. Sem confirmação explícita não há push/pull, troca de branch com mudanças, encerramento de processo ou operação destrutiva.
6. A UI não bloqueia esperando disco, Git, terminal ou parser.

## Gates de viabilidade

| Gate | Spike mínimo planejado | Sucesso mensurável | Fallback se falhar |
|---|---|---|---|
| G-EDITOR | protótipo isolado de componente Slint | edição Unicode, seleção, clipboard, undo/redo, scroll, gutter e diff de 10.000 linhas sem widget por linha | aprovar componente nativo alternativo ou reduzir MVP; não escrever editor do zero |
| G-TERMINAL | programa fake via ConPTY no Windows alvo | stdin interativo, UTF-8, ANSI/VT, resize, Ctrl+C, EOF e shutdown sem leak de handles | terminal somente de saída ou revisar stack com aprovação |
| G-GIT | fixtures temporárias + bare remoto local | porcelain v2 -z e diffs distinguem index/worktree/HEAD com nomes Unicode | corrigir adaptador; não fazer parsing humano |
| G-REPOS | catálogo de 12 repositórios sintéticos | nenhum scan/watch recursivo no carregamento inicial; seleção continua responsiva | reduzir escopo de observação e perfilar |
| G-RESOURCES | cenário repetível no Dell alvo | métricas de CPU, RAM, handles e p95 registradas, separando filhos | ajustar orçamento/escopo; não anunciar ganho |
| G-DISTRIB | build Windows corporativo pré-aprovisionado | build e execução local sem admin e sem rede própria | alinhar TI/empacotamento antes de produto |

Nenhum gate é aprovado por mock visual ou por uma única execução.

## Decisões provisórias

- ADR-001 mantém Rust como núcleo e Slint apenas como hipótese, condicionada a G-EDITOR.
- ADR-002 usa Git CLI estruturado e não uma biblioteca Git para operações do MVP.
- ADR-003 estabelece ConPTY como hipótese de transporte, não como renderizador de terminal.
- ADR-004 estabelece configuração local mínima, escrita atômica e logs desligados por padrão.

## Critérios de aceite do MVP

O aceite exige evidência para AC-01 a AC-10 em traceability.md: uso local sem VS Code/rede da IDE; 12 repositórios lazy; edição sem conversão silenciosa; diffs corretos; terminais funcionais quando as CLIs forem autorizadas; UI responsiva e métricas separadas; Git em fixture local; ausência de telemetria/rede própria; testes críticos sem perda/processos órfãos nos cenários suportados; e benchmark no Dell alvo, inclusive resultados negativos.

## Dependências e bloqueios atuais

- B-01: OpenSpec não está disponível no PATH; a estrutura ainda não foi validada pela versão aprovada.
- B-02: não há documentação Slint, OpenSpec, Copilot CLI ou Kiro CLI disponível localmente nesta rodada.
- B-03: o host observado não corresponde de forma verificável ao Dell/CPU descrito; ele não pode ser baseline de performance.
- B-04: políticas corporativas, licenças, CVEs, binários autorizados e requisitos de distribuição ainda não foram verificados.

## Decisão solicitada

Após revisão, aprovar ou ajustar esta proposta e autorizar somente os spikes G-EDITOR, G-TERMINAL e G-GIT em ambiente isolado. A implementação de produto permanece explicitamente bloqueada.
