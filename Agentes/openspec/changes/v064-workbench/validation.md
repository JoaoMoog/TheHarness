# Validação SpeedCode 0.6.4

2026-10-05, Windows x64. Implementação conforme spec.md deste diretório.

- JavaScript: 49 testes passaram, zero falhas; inclui 2.000 arquivos/4.000 linhas
  lógicas de agrupamento e limite de 200 linhas renderizadas por página, paths
  originais preservados, estados separados, fechamento/cancelamento/falha de terminal.
- Rust: 53 testes passaram, 8 opt-in ignorados, zero falhas.
- Opt-in .NET real: duas configurações passaram. Build, /, /health, Swagger UI,
  JSON OpenAPI, JS/CSS e encerramento com porta fechada, usando Launcher/ConPTY
  de produção. Cópias temporárias/portas livres; nenhuma API existente interrompida.
- Frontend compilou. Chunk principal ~4,49 MB permanece com alerta Vite existente;
  não foi aumentado o limiar do alerta. Agrupamento não adiciona scan, dependência,
  timer, watcher ou alteração nos tetos de desempenho. Expansões obsoletas podadas.

## GUI e desempenho

Perfil isolado .validation/v064-profile, janela 1440×932, sem CLI/MCP/inferência
ou edição ativa. Pela skill computer-use: pastas aparecem recolhidas com
contagem; docs expande mostrando nomes curtos, ações +/lixeira e paths completos
em tooltip, e recolhe novamente. Não foi executada nenhuma ação Git de escrita.
O fechamento de abas tem teste DOM/lifecycle e backend real; não foi feito clique
físico no × de uma API pelo teste GUI.

Depois foi selecionada a fixture .validation/v061-large: 42.000 dependências e
2.100 arquivos novos; painel continua com 6 entradas elegíveis/grupos, sem
node_modules, ignorados ou erro de saída Git. Diff sample.ts aberto, sem salvar.

Amostras da árvore do app + WebView2, 8 CPUs lógicos, sem ampliar tetos:

- Inicial, 15,80 s: CPU 2,040%, working set 196,75 MiB, privado 325,66 MiB,
  crescimento +25,54 MiB. Falhou a meta CPU≤2%; houve captura GUI durante amostra.
- Intermediária sem diff, 32,39 s: CPU 1,767%, WS 246,79 MiB, privado 305,30 MiB,
  crescimento −0,02 MiB. Gate passou; não usada como comparação entre versões.
- Fixture grande, diff ativo, 32,58 s: CPU 2,278%, WS 287,49 MiB, privado
  311,61 MiB, crescimento +3,85 MiB. Meta de CPU falhou; memória dentro das metas.
- Repetição no mesmo diff estabilizado, 32,46 s: CPU 1,727%, WS 289,04 MiB,
  privado 334,25 MiB, crescimento +0,12 MiB. Gate passou com os mesmos tetos.

CPU variou: não declaramos aprovação consistente, redução causal de CPU/RAM,
superioridade ao VS Code, ausência de vazamento por horas ou economia de tokens.
Agrupamento só ocorre ao renderizar status/expandir pasta e mantém limites;
nenhuma funcionalidade pesada adicional foi introduzida no caminho ocioso.

## Release e distribuição

- Frontend e release Rust 0.6.4 compilados. FileVersion 0.6.4/ProductName SpeedCode.
- EXE portátil: 41.843.200 bytes, SHA256
  56050AA6F30D36FB3DDBD6FA844EC680105430A635E43E3E1557683D67CB5991.
- Pacotes dist/SpeedCode e dist/SpeedCode-0.6.4 incluem duas DLLs, Ruff/licença e
  documentação. Instalador dist/installer/SpeedCode-0.6.4-Setup.exe, sem assinatura
  Authenticode própria; hash final verificado na saída de installer.ps1.
- Teste instalador: 88 checks passaram, zero falhas; instalação, lock,
  concorrência, upgrade, downgrade bloqueado, reparo, falha WebView2 simulada,
  desinstalação e preservação de dados. Cadastro real não alterado.
  Relatório local ignorado: .validation/installer-4f5b698f18d148ae9d80ed3c59640fe4/report.json.
- Git diff --check sem erros; EXEs/DLLs/builds/perfis de teste não rastreados,
  continuam ignorados. Nenhum commit/push/deploy ou inferência paga.
- Instância 0.6.3 e API que o usuário já executava permaneceram abertas. Para
  Swagger na porta habitual, é necessário parar/reiniciar a API com o novo exemplo.
