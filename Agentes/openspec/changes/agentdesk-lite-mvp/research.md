# Pesquisa e inventário local

Data da verificação: 2026-09-22. Escopo: diretório atual e comandos locais, sem rede, instalação, agentes externos ou repositórios corporativos.

## Inventário observado

| Item | Evidência local | Estado/limitação |
|---|---|---|
| Diretório | somente .codex-remote-attachments no inventário inicial; sem AGENTS.md e sem projeto OpenSpec | diretório novo; anexos não foram usados como dependência do produto |
| OpenSpec | openspec --version e openspec --help retornaram comando não reconhecido; where.exe não localizou | AUSENTE NO PATH; change não validada pela ferramenta |
| Rust | rustc 1.98.1 (48a229cea 2026-09-01); cargo 1.98.1 (797e8a9bc 2026-08-05) | disponível; avisou que não pôde canonicalizar C:\Users\juanc |
| Git | git version 2.55.0.windows.5; executáveis em Program Files e runtime do Codex | disponível; recursos específicos ainda devem ser validados em fixture |
| Copilot CLI | copilot --version e where.exe não localizaram | AUSENTE NO PATH |
| Kiro CLI | kiro --version e where.exe não localizaram | AUSENTE NO PATH |
| Slint | nenhum executável slint/slint-viewer localizado | não indica que a crate não possa ser provisionada; API não foi verificada |
| Windows | registro: ProductName Windows 10 Pro, DisplayVersion 25H2, build 26200.9457 | divergente do Windows 11 alegado; não usar como conclusão do host alvo |
| CPU | registro: Intel Core i7-4790, 4 cores lógicos/geração incompatível com a alegada | divergente do i7 de 9ª geração do alvo |
| RAM/modelo | consulta CIM negada | não verificado; não registrar estimativa |
| Armazenamento | unidade C: NTFS, aproximadamente 383 GiB livres na sessão | não comprova tipo/modelo de SSD do Dell |
| Política PowerShell | MachinePolicy/UserPolicy/Process/CurrentUser Undefined; LocalMachine RemoteSigned | não comprova política corporativa, EDR, proxy ou execução de binários |

Comandos efetivamente executados: Get-ChildItem -Force; Test-Path/Get-Content de AGENTS.md; Get-Command e where.exe para ferramentas; --version/--help disponíveis; consultas CIM e a registro; Get-PSDrive; Get-ExecutionPolicy. As consultas CIM para OS, CPU, computador e discos retornaram Acesso negado. Nenhum comando examinou tokens, arquivos de configuração de ferramentas ou credenciais.

## Hipóteses críticas e plano de evidência

| Hipótese | Decisão provisória | Evidência atual | Spike/ação necessária | Critério | Fallback |
|---|---|---|---|---|---|
| Slint suporta a base visual no Windows | manter como hipótese | nenhuma documentação local disponível | G-EDITOR, após autorizar dependências/documentação | requisitos de edição e virtualização atendidos | componente nativo aprovado ou redução de escopo |
| Slint fornece editor de código/terminal | não assumir | nenhuma evidência; não há binário local | avaliar API e bibliotecas separadas | integração funcional e acessível | não implementar editor/renderizador próprio sem ADR |
| Tree-sitter vale o custo | somente sob demanda | versões/licenças não verificadas | benchmark de gramáticas e arquivos grandes | orçamento explícito de CPU/RAM | realce simples por lexer ou sem realce inicial |
| ConPTY resolve terminal | somente transporte de pseudoconsole | API e biblioteca não verificadas nesta rodada | G-TERMINAL com processo fake | input/resize/UTF-8/cleanup corretos | simplificar terminal/rever stack |
| Git porcelain v2 -z é contrato suficiente | provável, não validado aqui | Git instalado; documentação externa pendente | G-GIT com fixture local | parsing NUL correto em casos especiais | corrigir adaptador, não cair para texto humano |
| CLIs podem ser iniciadas programaticamente | desconhecida | executáveis não localizados | teste manual autorizado com binários/documentação oficiais | TTY/cwd/encerramento observados | terminal interativo sem orquestração |
| Job Objects controlam a árvore toda | não assumir | nenhuma evidência | spike Windows com processos filhos | limites/escape documentados | lifecycle limitado e alertas |

## Pesquisa externa pendente

Sem acesso de rede autorizado, nenhuma afirmação de API, licença, vulnerabilidade ou compatibilidade foi confirmada externamente. Antes de qualquer implementação devem ser registradas fontes e datas para:

- documentação da versão exata de Slint: entrada de texto, seleção, scroll, foco, DPI, acessibilidade, layout, temas e modelo de renderização;
- alternativas de editor/renderizador de terminal, respectivas licenças, manutenção e compatibilidade Windows;
- documentação Win32/ConPTY e biblioteca Rust selecionada;
- documentação Git para status porcelain v2 -z, diff, paths, hooks, worktrees, LFS e assinatura;
- documentação oficial e caminho permitido de Copilot CLI/Kiro CLI;
- APIs Windows para processos, Job Objects, métricas, handles e regras de distribuição;
- SBOM, licenças e vulnerabilidades das versões exatas aprovadas.

## Open questions

- O Dell alvo é o host de referência para os spikes? Qual modelo de CPU, RAM, SSD e política de execução devem constar da ficha de benchmark?
- Qual versão/canal de OpenSpec é aprovado e onde está seu executável?
- Quais caminhos absolutos e versões de Copilot CLI/Kiro CLI estão autorizados, e quais comportamentos interativos foram documentados?
- Há componente de editor/terminal previamente aprovado por TI e quais licenças são aceitas?

Até essas respostas, todas as decisões de stack são reversíveis e nenhuma métrica de desempenho pode ser atribuída ao computador alvo.
