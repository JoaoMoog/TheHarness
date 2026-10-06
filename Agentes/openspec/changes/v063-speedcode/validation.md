# Validação 0.6.3 — SpeedCode

Checkout/GitHub renomeados para SpeedCode; id e privacidade do repo preservados.
Nenhum commit/push/deploy no repositório principal nesta entrega; commits apenas
na fixture artificial de teste. CSS de cores não alterado;
SVG/PNG/ICO gerados na paleta original. Perfil legado reutilizado, sem cópia.

## Testes e build

- JS: 43 testes passaram, incluindo paths inseguros, cotas e cancelamento de
  revelação/diff tardio. Rust: 53 passaram/8 opt-in ignorados (IA/.NET/benchmark).
- Corrigido o marcador do teste PTY após a troca da marca; reteste completo passou.
  Dois PowerShell reais testados. Nenhuma inferência paga ou pedido remoto de IA.
- Benchmark Git opt-in adicional passou na fixture local: 44.105 registros /
  1.922.663 bytes / 185 ms na projeção nativa original; projeção limitada 6
  registros / 624 bytes / 149 ms. Dado sintético, não benchmark de qualidade LLM.
- Frontend Vite e Rust release compilados; alerta de chunk Vite ~4,49 MB permanece
  pré-existente (não aumentamos o limite do alerta).
- Pacote: dist/SpeedCode-0.6.3/SpeedCode.exe, 41.809.920 bytes,
  SHA256 00D8060D741221D52A3D20865FE644200A4CEE137E817D5C05E317593B5C4F2A.
  FileVersion 0.6.3/ProductName SpeedCode verificados. DLLs e Ruff/licença incluídos.
- CSS idêntico ao HEAD por hash; cinco cores do SVG exatamente iguais ao original.
  Ícone gerado em 16/32/48/64/128/256px, PNG256 e ICO, inspecionado visualmente.
- Git origin SpeedCode.git e ls-remote HEAD ca4713073178b88c69f4af9d69e6c61585ad24a8.
  Build/target/node_modules/perfis de teste continuam ignorados. Fonte não enviada.

## GUI real (skill computer-use)

Perfil .validation/v063-profile e repo artificial .validation/v063-navigation,
Windows x64, janela 1440×900, nenhum terminal/agente iniciado. Comprovados:
clique simples → diff; duplo clique → buffer + src/features expandido/arquivo
selecionado; marcador não salvo sobrevive à volta ao Git/duplo clique; conteúdo
do disco e índice sem mudança. Ctrl+Z removeu apenas o marcador do teste.
Rename abriu renamed.ts, não old-name.ts; deleted.ts permaneceu ausente, erro
legível e pasta exibida, sem restaurar conteúdo. Não editamos repos pessoais.

## Amostras de processos (não garantia para horas)

App + descendentes WebView2, 8 CPUs lógicos, mesma fixture artificial/diff de três
linhas, janela visível 1440×900, sem CLI/MCP/build/browser/inferência durante amostra.
Primeira amostra SpeedCode: 32,76 s, CPU média máquina 1,657%, pico working set
479,89 MiB, privado 647,59 MiB, crescimento WS −18,38 MiB.
Baseline 0.6.2 visível, mesmo diff: 32,35 s, CPU 1,715%, WS 412,14 MiB,
privado 357,52 MiB, crescimento −1,50 MiB. CPU similar; memória variou e esta
primeira comparação não prova redução de RAM nem ausência de regressão por horas.
Uma amostra preliminar da baseline foi descartada da comparação por janela oculta.

Repetição SpeedCode após estabilização: 32,53 s, CPU 1,303%, WS 411,37 MiB,
privado 347,82 MiB, crescimento −0,71 MiB; orçamento respeitado e semelhante à
baseline nesta amostra. A memória inicial variou, por isso não afirmamos redução
causal decorrente da mudança de marca. Botão Mostrar arquivo também testado:
abre editor e expande/revela src/features, sem salvar ou alterar o Git.
Metas existentes (CPU≤2%, WS≤900 MiB, crescimento≤128 MiB) não ampliadas.
O cenário pequeno não substitui gate de fixture grande ou soak test. Evidência
histórica 0.6.2 permanece no diretório próprio; CPU foreground/diff não passou
consistentemente naquela versão. Não declaramos performance aprovada universalmente,
economia de tokens/créditos, aumento de inteligência ou superioridade ao VS Code.

Gate adicional com fixture grande .validation/v061-large (42.000 dependências,
2.100 arquivos novos e amostras, 44.105 registros Git originais), novo perfil
.validation/v063-large-profile, diff sample.ts ativo, 1440×900, sem inferência:
scripts/check-performance.ps1 -Seconds 30 passou SEM alterar tetos.
32,45 s / 8 CPUs: CPU 1,517%, working set 411,91 MiB, privado 315,48 MiB,
crescimento WS +0,43 MiB. Git exibia apenas 6 entradas elegíveis/grupos;
node_modules/ignorados não apareceram no controle de versão. Nenhum erro de 8 MiB.
JTK reconciliou a raiz após a mudança: cobertura completa de arquivos elegíveis,
generation 1791168122349-72b1d35bb6334d5c, sem warnings.

Windows/GUI, saída de teste e hash verificados nesta execução. Janelas de teste
fechadas sem edições pendentes. Perfis e fixtures locais ignorados mantidos para
reprodução, sem adicionar arquivos gerados ao Git. Não houve soak por horas,
comparação VS Code ou inferência real do Copilot nesta validação de rebranding.
