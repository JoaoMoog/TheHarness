# Validação 0.6.1 — 2026-10-04

Pacote final: `dist/AgentDeskLite-0.6.1/AgentDeskLite.exe`, versão Windows 0.6.1,
41.807.360 bytes. SHA256 `4E5FF57809807A63B8053CBD5F50EC2FFCA351B1365EA882A9EF6F2692EDCA07`.
Inclui WebView2Loader.dll, libunwind.dll e `formatters/ruff.exe` + licença. Build final
foi aberta no perfil normal, sem alterar os repositórios do usuário. Mudança final
na fronteira de rename foi retestada (3 testes SCM passaram; benchmark grande opt-in).

## Executado
- `npm run test`: 33 testes passaram (incluindo TS/TSX/JSON idempotência e erro sintático).
- `scripts/build.ps1 -Action test`: 43 testes Rust passaram, 8 opt-in ignorados; novo teste de bulk SCM confirma que stage/unstage não inclui nem remove dependências/ignorados. Testes Git reais continuam cobrindo rename, branches, remoto local, stash e merge.
- `scripts/build.ps1 -Action test -TestFilter large_fixture_projection_benchmark -IncludeIgnored -ShowOutput`: passou. Fixture isolada contém 42.000 arquivos node_modules (sem regra node_modules no gitignore), 2.100 arquivos novos e amostras. Nenhum repositório pessoal foi alterado.
- `npm run build` e release Rust concluídos. Vite avisa chunk principal de ~4,485 MB; não é erro. Workers semânticos TS/JSON/HTML/CSS não aparecem no bundle; `typescript-*.js` é parser Prettier sob demanda, não TypeScript language-service worker.

## Comparação SCM offline, mesma fixture
Coleta antiga (untracked all): 44.105 caminhos, 1.922.663 bytes de stdout, 788 ms.
Nova projeção: 6 entradas, 624 bytes JSON, 452 ms. Tempos são uma amostra, não p95;
stdout/JSON têm formatos diferentes, portanto não usar relação como economia de bytes/tokens.
Expansão de pasta: 2.000 registros, parcial explícito; 200 linhas por página. Lotes parciais recusados.

## Interface Windows real
Controle de aplicativos via skill computer-use, perfil separado `.validation/v061-profile`, fixture própria.
- Shift+Alt+F formatou TypeScript em worker e mostrou buffer dirty; menu direito exibiu Formatar documento e Comentar/descomentar.
- Comentar por menu e descomentar com Ctrl+/ alteraram a linha TS corretamente.
- Ruff incluído no pacote formatou Python; dotnet SDK instalado formatou C# via pasta temporária.
- Leituras posteriores dos arquivos em disco confirmaram que permaneceram originais. Nenhuma alteração foi salva automaticamente.
- Git exibiu 6 entradas sem node_modules/ignored.log. Pasta new-files expandiu com aviso parcial e paginação 1/10.
- Janela de validação foi encerrada para substituir o pacote final; não eram sessões do usuário. Não foram executados prompts pagos, login, push, deploy ou descarte em repositório pessoal.

## Memória/CPU: árvore, não só o EXE Rust
`measure-process-tree.ps1` inclui app e descendentes WebView2; working sets podem compartilhar páginas.
Corrigida resolução de overload Math.Max no script para não arredondar CPU fracionária para inteiro.
- Após formatação TS: pico working set 474,37 MiB; privado 290,83 MiB (5 s, 7 processos).
- Ao expandir 2.100 alterações: working set 499,84 MiB; privado 358,37 MiB (5 s).
- Durante formatação C# sob demanda: pico working set 628,10 MiB; retornou a ~487 MiB após saída do SDK (10/7 processos).
- Três buffers, após formatadores encerrarem: working set 478,18–478,88 MiB; privado 298,65–299,53 MiB (11,32 s, 7 processos). CPU acumulada entre amostras: ~1,70 s em ~10,03 s observados, sem inferência; não é percentual total do computador.
- Build final no perfil normal, projeto planny_director, sem buffers/chat/terminais ativos: working set 451,58–452,42 MiB; privado 335,51–336,41 MiB (5,85 s, 7 processos); ~0,36 s CPU acumulados em ~4,55 s entre amostras. Não foram editados arquivos desse projeto.

Não é benchmark A/B da aplicação completa contra VS Code. Não comprova estabilidade por horas, custo com múltiplos CLIs/MCP, economia de tokens ou CPU zero em repouso. O screenshot de 2,7 GB do usuário não tem condições equivalentes às medições acima. A causa da explosão de linhas foi eliminada e seu custo limitado; continuar medindo cenários reais de uso longo.

## Limites intencionais
Git acima de 2.000 caminhos mostra lista parcial; lotes até 200 arquivos, sem modificar ignore/índice oculto automaticamente. Explorador tem limite visual; Ctrl+P abre caminho digitado. Refresh normal 10 s, hash 60 s/foco; metadata sozinha pode atrasar alterações que preservem tamanho/mtime. C# precisa SDK. Configs executáveis não são carregadas. Perfil leve sem IntelliSense/análise de tipos contínua. Comentários em markup JSX podem exigir `{/* … */}` manual; não é uma transformação AST de JSX.
