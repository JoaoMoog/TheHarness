# Validação SpeedCode 0.6.6

2026-10-05. Implementação conforme spec.md, sem alteração nas cores/backend Git.

- JS: 59 passaram, zero falhas. Expansão padrão em cada nível, escolhas durante
  redraw/status, expandir/recolher tudo, estados independentes, root switch,
  serialização, cancelamento, erro sem retry, liberação de cache e limites.
- Rust: 53 passaram, 8 opt-in ignorados, zero falhas. Nenhuma inferência/login,
  comando remoto ou mutação nos repositórios do usuário durante esta validação.
- Frontend e Rust release 0.6.6 compilados. Alerta existente de chunk principal
  ~4,50 MB permanece; nenhum timer, watcher ou dependência adicional.
- git diff --check passou. Dist/EXEs/DLLs, build e perfis continuam ignorados.

## GUI real isolada

Skill computer-use, janela 1440×932, perfil .validation/v066-profile e fixture
.validation/v065-tree. Abrir Git carregou a pasta nova scoped e exibiu de imediato
src → pages → events → details → index.ts sem cliques nos ancestrais.
Recolher tudo fechou a árvore; Atualizar Git manteve a decisão. Expandir tudo
recarregou o grupo e restaurou todos os níveis. Botões acessíveis junto ao
stage-all e à lixeira; nenhuma ação de stage/discard/commit/push executada.

Perfil .validation/v066-large-profile, fixture .validation/v061-large com
42 mil dependências e 2.100 arquivos novos: node_modules/ignored.log ausentes
do Git; pasta new-files carregada automaticamente. Projeção de 2.000 caminhos,
200 linhas incluindo pastas por página, 11 páginas; aviso parcial e ações globais
bloqueadas. Não se aumentaram limites para a expansão padrão.

## Desempenho app + WebView2

Windows, 8 CPUs lógicos; mesma resolução, sem CLI/MCP/inferência/editor aberto.
Gate: CPU média máquina ≤2%, WS ≤900 MiB, crescimento ≤128 MiB. Amostras curtas
não provam ausência de leak por horas, superioridade ao VS Code, economia de
tokens ou CPU/RAM fixa. Working sets podem compartilhar páginas.

| Cenário | Duração | CPU média | WS pico | Privado pico | Crescimento WS | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 0.6.6 pequeno, inspeção UIA conectada | 32,47 s | 1,630% | 398,79 MiB | 332,80 MiB | −0,27 MiB | PASS |
| 0.6.6 grande expandido, inspeção UIA conectada | 32,34 s | 3,128% | 435,95 MiB | 321,67 MiB | −8,32 MiB | FAIL CPU |
| 0.6.6 grande recolhido, inspeção UIA conectada | 32,59 s | 2,098% | 432,57 MiB | 356,79 MiB | −10,36 MiB | FAIL CPU |
| 0.6.5 grande expandido, inspeção UIA conectada | 32,29 s | 3,085% | 435,90 MiB | 314,09 MiB | −6,94 MiB | FAIL CPU |
| 0.6.5 grande expandido, inspeção desconectada | 32,51 s | 0,084% | 458,63 MiB | 347,47 MiB | −1,41 MiB | PASS |
| 0.6.6 grande expandido, inspeção desconectada | 32,69 s | 0,227% | 429,89 MiB | 321,99 MiB | −6,44 MiB | PASS |
| 0.6.6 grande expandido, repouso após aquecimento, inspeção desconectada | 32,54 s | 0,018% | 420,07 MiB | 365,12 MiB | −0,03 MiB | PASS |

Inspeção Windows UI Automation ativa contaminava o repouso: kernel de automação
encerrado/resetado antes das duas últimas amostras, sem fechar/minimizar o app
ou mudar seu estado. GPU/acessibilidade e demais recursos da aplicação não
foram desabilitados. Amostras instrumentadas mantidas acima, não ocultadas.
O gate final respeitou o orçamento. Pequenas diferenças entre versões incluem
startup/cadência de manutenção: não estabelecem melhora/regressão causal.

## Distribuição

FileVersion 0.6.6 verificado. EXE SHA256:
A9A136C9ACB299A8CB25B38B6D1DE094770018F06F765BA0CEBD45842D8F4DDA.
Pacote portátil dist/SpeedCode-0.6.6 e instalador
dist/installer/SpeedCode-0.6.6-Setup.exe gerados com o mesmo release.
Sem mudança no NSIS: suíte de instalação não repetida; instalador continua sem
assinatura própria. Nenhuma instalação/atualização automática no perfil real.
Somente instâncias isoladas desta validação foram encerradas; arquivos das
fixtures permaneceram intactos. Relatório final incluído no pacote distribuído.
