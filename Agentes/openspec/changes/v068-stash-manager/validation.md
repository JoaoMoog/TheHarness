# SpeedCode 0.6.8 — validação

2026-10-05. Repositório/perfil do usuário não receberam stash, apply, drop ou
instalação. Testes de mutação usam fixtures temporárias com Git real.

## Testes e limites

- Final: 58 Rust passaram, zero falhas, 8 integrações opt-in ignoradas; 61 JS
  passaram, zero falhas. Nenhuma inferência ou login automático.
- Git real: core.autocrlf=true, 1.000 dependências não ignoradas preservadas,
  arquivo rastreado ignorado/secret preservados, novos, nome com colchetes,
  staged rename/delete, arquivo vazio, apply mantendo stash e drop de SHA antigo
  sem excluir o stash mais recente. Índice oculto e rename de ignorado bloqueados
  antes da mutação, com índice/arquivos preservados.
- 201 alterações bloqueiam criação; stash externo com 2.001 arquivos bloqueia
  expansão; diff acima de 512 Ki caracteres bloqueia visualização, sem remover
  stash. Erros não repetem mutações. JS valida demanda, uma leitura, liberação,
  root switch, resposta tardia, lista inválida/volumosa e erro sem retry.
- Uma rodada Rust concorrente com compilação release excedeu o prazo de 20 s do
  teste de dois PowerShells. Repetição sequencial e rodada final passaram sem
  mudar esse teste/prazo; não se elevou nenhum teto para obter aprovação.
- Vite compilado; warning pré-existente do chunk principal ~4,50 MB permanece.
  git diff --check passou. Nenhuma nova dependência, watcher ou timer.

## Janela e desempenho

Release 0.6.8 em perfil .validation/v068-profile, fixture v068-stash-fixture,
janela 1440×932. Dois stashes nomeados; 150 arquivos rastreados em um stash,
1.000 dependências não ignoradas no disco. Abrir pelo nome da branch no painel
e rodapé funcionou. Painel não contém seções extras. Nenhum arquivo do stash
aparece até clicar. Paginação 1/2 e 2/2 funcionou, diff de endpoint-54.ts exibiu
54 → 55 sem aplicar alterações. Fechar diff removeu a aba/breadcrumb. Escape
fechou modal; reabrir manteve stashes fechados. Apply/drop são exercitados pelos
testes backend em fixtures, não por clicks destrutivos na GUI.

Medição com modal aberto, stash expandido e primeira página (100 nomes) visível,
após startup e inspeção. Kernel de automação desconectado antes da amostra;
estado confirmado depois. Nenhuma desativação de acessibilidade/GPU, minimização
ou build/inferência durante a amostra. Windows, 8 processadores lógicos.

| Duração | CPU média da máquina | WS pico | Privado pico | Crescimento WS | Gate |
| --- | --- | --- | --- | --- | --- |
| 32,72 s | 0,054% | 427,98 MiB | 305,86 MiB | 0,11 MiB | PASS |

Inclui app + descendentes WebView2. Gates mantidos: ≤2% CPU, ≤900 MiB WS,
≤128 MiB crescimento. Working sets compartilham páginas. Não é uma comparação
causal com release anterior nem promessa de CPU/RAM fixa, economia de tokens,
desempenho por horas ou superioridade ao VS Code. A instalação aberta do usuário
(PID 11848 nesta validação) não foi encerrada/atualizada. Somente a janela
isolada foi fechada; stashes e working tree da fixture permaneceram intactos.

## Distribuição

Frontend final embutido em Rust release; pacote portátil e instalador 0.6.8
gerados via scripts existentes. Build/dist/EXEs/DLLs/perfis/fixtures continuam
ignorados no Git. NSIS/lógica de instalação intactos; suíte de instalação não
repetida. Setup permanece sem assinatura própria e não foi executado no perfil
do usuário. Use o novo Setup com o app fechado para atualizar.
