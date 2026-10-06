# Validação — AgentDesk Lite 0.6.0

Data: 04/10/2026. Windows, Rust GNU com target `x86_64-pc-windows-gnullvm`,
LLVM-MinGW, Copilot CLI 1.0.91, SDK Rust 1.0.17-preview.3. Alterações anteriores
do checkout preservadas; sem commit/push/deploy e sem editar projetos pessoais.

## Resultados

- `npm test`: **31 passaram**, zero falhas. Seleção/snapshot confirmado sem gravação,
  notas/MCP/diagnóstico, cota compacta, popovers, sessão, Enter/Shift+Enter,
  Markdown, contexto e regressões do chat.
- `scripts/build.ps1 -Action test`: **37 passaram**, zero falhas, **7 ignorados**
  por exigirem execução opt-in/runtime/SDK .NET. Git e PowerShell usam fixtures reais.
  Um ensaio anterior com release compilando simultaneamente estourou os 20 s do
  teste ConPTY/PowerShell. O teste isolado e as suítes seguintes sem essa concorrência
  passaram; não alteramos nem enfraquecemos sua asserção/timeout.
- `installed_cli_supports_sdk_and_memory_fs --ignored --nocapture`: passou.
  Login existente, modelo disponível, sessão RAM real e modos Autopilot/Interactive
  confirmados. Nenhum prompt enviado.
- `installed_cli_context_diagnostics_without_inference --ignored --nocapture`:
  passou no fluxo de produção `chat_begin` + diagnóstico + busca local. CLI **1.0.91**,
  política **unavailable-native-fallback**, **zero ferramentas Rust** após atualização
  confirmada do catálogo; sessão mantida e índice manual reaproveitado. Nenhum prompt.
- `cargo fmt --check`: passou. `git diff --check`: passou; apenas avisos de LF/CRLF.
- `npm run build`: passou, 1.265 módulos; mantém aviso de chunk Monaco grande
  (~4,53 MB no chunk principal). Isso não foi escondido nem tratado como benchmark.
- `scripts/build.ps1 -Action build -Release`: passou. Pacote via
  `scripts/package.ps1 -SkipBuild -PackageName AgentDeskLite-0.6.0` passou.

## Busca offline reproduzível

`offline_retrieval_benchmark --nocapture`: fixture sintética de **150 arquivos**,
mesma consulta/índice; top hit esperado verificado. Última amostra:

| Medida | Fria | Quente |
|---|---:|---:|
| Tempo | 203 ms | 25 ms |
| Bytes lidos para reconciliação/indexação | 295.730 | 0 |
| Bytes relidos para verificar hits | — | 1.971 |

Uma amostra anterior retornou 507/53 ms, ilustrando variação do ambiente. O teste
não compara varredura nativa, CLI ou VS Code e não mede tokens faturados, CPU da
IA, qualidade das respostas ou economia financeira. As regressões também cobrem
relações controller/service/DTO/teste/instruções, prefixo, arquivo removido,
gitignore alterado, parse quebrado e hit modificado com tamanho/mtime preservados.
Arquivos não retornados cujo tamanho/mtime foram artificialmente preservados
podem continuar fora de uma consulta nova; busca não prova ausência e exige expansão.

## Conferência visual Windows

Skill computer-use aplicada no executável real, por screenshots/acessibilidade:

- Lixeira de Descartar tudo ao lado de Preparar todas no cabeçalho Alterações;
  não clicamos em nenhum comando de stage/descarte/commit/push/pull.
- Cartão GitHub Copilot: título em uma linha, percentual grande/barra, Atualizar,
  Gerenciar e Detalhes de uso recolhidos. Conferência identificou conflitos de CSS
  com toolbar/popover; corrigidos e revalidados no pacote final.
- Cota real retornada: Chat 6,7%, sugestões 0%, premium sem cota. O reset retornado
  já estava no passado; mostramos próximo reset não informado, sem inventar data.
- Painel de contexto/notas/diagnóstico/MCP observado, controles avançados recolhidos.
- Divisores do explorador e chat arrastados no pacote final; redimensionamento
  conferido visualmente, deixando espaço utilizável para o editor.
- Chat conectado automaticamente à conta já salva; nenhuma tela de autenticação
  automatizada, prompt enviado, anexo enviado ou conversa antiga limpa.
- Apenas a primeira janela vazia aberta por este teste foi fechada para reempacotar.
  O **pacote final 0.6.0 foi reaberto e deixado disponível**.

## Consumo de processos, não apenas Rust

`scripts/measure-process-tree.ps1 -ExePath dist/AgentDeskLite-0.6.0/AgentDeskLite.exe -Seconds 5`:

- Amostra inicial antes da conexão do chat: 7 processos, pico working set **457,62 MiB**,
  private bytes **310,86 MiB**, janela observada 5,96 s.
- Pacote final com chat conectado e cartão da cota aberto, sem inferência: 9 processos,
  pico working set **642 MiB**, private bytes **570,71 MiB**, janela 5,87 s.
  Deltas CPU observados nessa janela ociosa foram 0 s na precisão do relatório.

Inclui descendentes WebView2/CLI encontrados pelos PIDs, não conversas/processos de
outros apps. Working sets podem compartilhar páginas; soma não é RAM única.
Não houve benchmark de horas de uso, pico durante inferência/edição ou A/B VS Code.
Não afirmar que a aplicação inteira ocupa apenas os poucos MB do processo Rust.

## Artefato

`dist/AgentDeskLite-0.6.0/AgentDeskLite.exe`, FileVersion 0.6.0,
**49.328.640 bytes**, SHA256:

`020AB0211E6453F58309D64646EC3B94474800BC163552A94051D20A75459639`

Manter `WebView2Loader.dll` e `libunwind.dll` junto ao executável; WebView2 Runtime
precisa estar instalado. `dist/`, `target/`, `ui/dist/`, `ui/node_modules/` continuam
ignorados e não são arquivos versionados. O README descreve pré-requisitos/build.

## Limites e próximos experimentos

- **Neste PC, o modelo não recebe automaticamente trechos Rust**: checker do runtime
  indisponível. As ferramentas são retiradas antes de inferência para evitar
  definições/tentativas inúteis; nativas/MCPs continuam. Snapshots também falham
  fechados no envio; salvar/anexar pelo harness nativo é o fallback. Não bypass.
- Busca manual e pacote local operam; relações Tree-sitter são sintáticas,
  não resolução de DI, overloads/reflexão nem grafo completo de dependências.
- Limites de texto/AST/cache não são limite de RAM total do SQLite/WebView2/app.
- Notas/contexto não garantem lembrar cada detalhe após compactação automática.
- Uso agêntico end-to-end dos novos pacotes, edição por modelo e economia de créditos
  **não comprovados** nesta entrega. Nenhum benchmark pago automático executado.

Protocolo futuro A/B: mesmo commit/fixtures/prompts/modelo/esforço/MCPs/permissões,
sessões independentes e pelo menos cinco repetições por caso (endpoint/refactor/bug),
validar diff/contratos/testes antes de comparar chamadas, entrada sem cache/cache,
saída, AIU/cota, latência e árvore de processos. Contexto indispensável e reasoning
permanecem; comparar recall e falhas, não somente menor entrada. Compatibilidade
da política precisa ser confirmada antes do grupo com contexto Rust automático.
