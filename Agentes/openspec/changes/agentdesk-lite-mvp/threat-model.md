# Modelo de ameaças

Status: rascunho; não declara sandbox ou conformidade corporativa.

## Ativos e fronteiras

| Ativo | Propriedade a preservar | Fronteiras de confiança |
|---|---|---|
| código e alterações locais | integridade, disponibilidade, confidencialidade | repositório, links, editor, agente e Git |
| buffer/configuração | não perder edição nem executar conteúdo | filesystem, settings, crash/recovery |
| credenciais existentes | não copiar, registrar ou expor | Git/CLI/OS externos ao produto |
| processo do usuário | não executar binário/comando inesperado | PATH, executable, args, cwd, hooks, DLL |
| terminal/UI | não receber ação privilegiada por output | ANSI/OSC, clipboard, hyperlink, foco |
| recursos da máquina | disponibilidade sem concluir controle total | filhos, Job Objects, EDR, políticas |
| evidência de suporte | utilidade sem vazamento | log, métrica, crash report local |

Atacantes incluem conteúdo de repositório malicioso, arquivo/configuração adulterado, binário com nome esperado, processo de agente comprometido, usuário enganado por UI, dependência comprometida e usuário sem permissão suficiente. Processos filhos executam com permissões do usuário; isso não é sandbox.

## Ameaças, mitigação e risco residual

| ID | Vetor | Mitigações planejadas | Teste | Residual |
|---|---|---|---|---|
| TH-01 | injection por argv/shell | argv estruturado, sem shell padrão, allowlist de exe/cwd | TP-SC-01,02 | argumentos do programa legítimo ainda podem ser perigosos |
| TH-02 | traversal/UNC/link | FileId relativo, raiz validada, política de junction/symlink, revalidação antes de Save | TP-WS-01,TP-SC-01 | TOCTOU não desaparece totalmente |
| TH-03 | spoof/PATH/DLL | caminho absoluto aprovado, sem busca PATH, cadeia de build revisada | TP-AG-01,TP-SC-05 | aprovação de binário/DLL depende de TI |
| TH-04 | hook Git malicioso | não ocultar hook, mostrar contexto mínimo, usuário controla execução Git | TP-GT-03 | hook roda com permissões usuais do usuário |
| TH-05 | agente fora do repo | cwd explícito, política de caminhos, aviso de limite | TP-AG-01,TP-WS-03 | CLI pode acessar o que o usuário pode |
| TH-06 | logs com segredo | desligado por padrão, tamanho/retenção/redaction best effort | TP-SC-03 | redaction não garante remoção total |
| TH-07 | ANSI/OSC/clipboard | renderer com política, bloquear/confirmar OSC 52 e links | TP-TM-02 | emulador pode ter bugs |
| TH-08 | config maliciosa | schema estrito, dados não executáveis, recovery | TP-ST-01,02,TP-SC-02 | corrupção pode exigir recuperação manual |
| TH-09 | perda/race de Save | snapshots separados, conflito explícito, escrita segura | TP-ED-02,05 | falha de hardware não é evitada |
| TH-10 | dependência comprometida | versões fixadas, SBOM, licença/CVE/hash, build aprovado | TP-SC-05 | CVEs futuros e cadeias externas |
| TH-11 | processos órfãos/escape | lifecycle, handles, Job Object somente se validado | TP-TM-03,TP-AG-03 | filhos podem escapar de Job |
| TH-12 | rede/telemetria indevida | sem cliente/serviço próprio, teste de socket do PID IDE | TP-SC-06 | filhos podem usar rede conforme política |
| TH-13 | abuso de recursos | buffer/cache/output/queue limitados, alertas | TP-RS-01,02,TP-TM-02 | usuário pode iniciar processos pesados |
| TH-14 | atualização/empacotamento | sem auto-update, assinatura se TI aprovar | TP-SC-05 | canal de distribuição depende de TI |

## Política de logs e privacidade

Por padrão: nenhum log persistente de sessão, prompt, código integral, token ou output completo. Em diagnóstico opt-in, registrar somente categorias, timestamp, IDs, versão, exit code e amostras que passem por limites/redaction. Usuário deve poder localizar e apagar logs conforme política corporativa; redaction é melhor esforço e não deve habilitar coleta de segredos.

## Critérios de aprovação de TI

Antes de código corporativo: versões e licenças aprovadas; SBOM/CVE revisados; cadeia de build e hash/assinatura aprovados; política de executáveis/caminhos definida; teste offline do PID IDE concluído; política de logs aceita; operação sem admin confirmada; riscos TH-01..TH-14 aceitos ou mitigados. A ausência de qualquer item é bloqueio de uso, não exceção silenciosa.
