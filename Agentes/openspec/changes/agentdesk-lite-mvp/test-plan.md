# Plano de testes e validações

Cada caso registra versão, host, fixture, comando, resultado, logs permitidos e artefato de evidência. Testes destrutivos usam somente diretórios temporários isolados. Testes que precisam Windows real, binário ou TI são manuais e não passam silenciosamente em CI.

| ID | Tipo/prioridade | Given / When / Then resumido | Oráculo e fixture |
|---|---|---|---|
| TP-WS-01 | unitário P0 | path com case/Unicode/UNC/link; validar FileId | decisão de policy e nenhum escape de raiz |
| TP-WS-02 | integração P0 | abrir 12 repos, expandir um nó | sem varredura global; TreePage esperada |
| TP-WS-03 | integração P0 | repo ausente/não Git/detached/worktree | estado correto sem perder catálogo |
| TP-ED-01 | unitário P0 | UTF-8 BOM/sem BOM, CRLF/LF, emoji | bytes/metadados preservados |
| TP-ED-02 | integração P0 | buffer sujo e mudança externa | opções Compare/Reload/Keep sem overwrite |
| TP-ED-03 | unitário P0 | UTF-16, inválido, binário, 1KB/1MB/10MB/100MB | classificação/limite explícitos |
| TP-ED-04 | spike/manual P0 | componente candidato edita 10.000 linhas | G-EDITOR e perfil documentados |
| TP-ED-05 | integração P0 | disco cheio simulado, permissão, remoção, crash | erro/recovery e atomicidade esperados |
| TP-DF-01 | integração P0 | insert/delete/rename/binary/EOF/EOL | linhas, fonte e marcações iguais ao Git |
| TP-DF-02 | desempenho P1 | milhares de hunks/linhas longas/10MB | viewport virtualizado e limite |
| TP-DF-03 | integração P0 | alteração concorrente após cache | cache invalidado, sem mix de versão |
| TP-GT-01 | integração P0 | empty/untracked/staged/unstaged/Unicode/espaço | parser porcelain v2 NUL correto |
| TP-GT-02 | integração P0 | stage/unstage, rename/delete, CRLF | index/worktree e diff corretos |
| TP-GT-03 | integração P0 | hook falho, assinatura exigida, conflito | Git não é contornado e erro é acionável |
| TP-GT-04 | integração P0 | bare local push/pull, LFS/submodule se disponível, interrupção | sem rede externa; resultado/abort seguros |
| TP-TM-01 | spike Windows P0 | fake ANSI/interativo/resize/UTF-8 | input, VT, dimensão e foco corretos |
| TP-TM-02 | integração P0 | subprocesso, stderr, volume alto, OSC/link | limites e política de escapes/clipboard |
| TP-TM-03 | integração P0 | Ctrl+C, EOF, travamento, fechamento | exit/lifecycle e ausência de handles órfãos suportados |
| TP-AG-01 | segurança P0 | CLI ausente, PATH spoof, cwd inválido | nenhum processo iniciado |
| TP-AG-02 | integração P0 | queue, término com/sem texto, notificações | estados independentes e sinal confiável |
| TP-AG-03 | E2E P0 | fechar com processo ativo | fluxo de escolha e cleanup suportado |
| TP-AG-04 | manual autorizado P0 | CLI real instalada/documentada | TTY/cwd/encerramento observados, sem token |
| TP-RS-01 | unitário P1 | múltiplos eventos/status repetidos | coalescing, prioridade, backpressure |
| TP-RS-02 | E2E P1 | 0/1/3/5 fakes e pressão global | bloqueia novo início sem matar ativo |
| TP-RS-03 | integração P0 | IDE mais filhos | CPU/RAM/handles em séries separadas |
| TP-ST-01 | unitário P0 | schema anterior e campo inválido | migração/rejeição/backup corretos |
| TP-ST-02 | integração P0 | settings truncado/corrupção | recovery sem execução de conteúdo |
| TP-SC-01 | segurança P0 | exe/link/path traversal/TOCTOU | bloqueio e auditoria mínima |
| TP-SC-02 | segurança P0 | argv especial, config maliciosa, hook | sem injection ou execução inesperada |
| TP-SC-03 | segurança P0 | log com token fictício | logs opt-in/limite/redaction de melhor esforço |
| TP-SC-04 | fuzz/property P1 | paths e parsing Git/terminal aleatórios | sem panic/escape de raiz |
| TP-SC-05 | manual/CI P0 | dependências fixadas | SBOM, licenças/CVE/hash por versão |
| TP-SC-06 | manual P0 | modo offline monitorado | sem socket do processo IDE |
| TP-UI-01 | E2E P0 | Ctrl+P/S/F/Tab, tabs e painéis | foco, loading/erro, UI não bloqueada |
| TP-UI-02 | E2E P0 | diff enquanto fake altera disco/Git atualiza | seleção e aviso de estado obsoleto |
| TP-UI-03 | manual P1 | DPI 100/150/200%, tela pequena, teclado | foco/a11y e layout aceitáveis |
| TP-PF-01 | benchmark P0 | A/B/C cold/warm, cinco repetições | protocolo e p50/p95 completos |
| TP-PF-02 | benchmark P1 | idle 10min, 100 open/close, 20 repos | memória/handles e regressão registrados |

## Qualidade e CI planejados

Após provisionamento aprovado e implementação existente, CI deve executar cargo fmt --check, cargo clippy com warnings proibidos salvo exceção documentada, cargo test, integrações Windows, build release, auditoria de dependências/licenças e verificação de artefato. A CI classifica e reporta separado: testes offline, Windows real, manual/CLI real e aprovação TI. Ela não presume login nem internet.

## Evidência e critérios

P0 falho bloqueia a fase correspondente. P1 pode exigir ADR/risco aceito. Todo teste guarda IDs de requisito, fixture e versão, mas nunca credencial, prompt ou código integral. Falsos ganhos por dados mockados, ajuste de threshold após falha ou coleta misturando filhos e IDE invalidam a evidência.
