# SpeedCode 0.6.9 — validação

2026-10-05. Nenhuma troca de branch, stash, force, reset, descarte ou instalação
no projeto/perfil do usuário. Mutações de Git usam fixtures isoladas.

## Testes

- 60 testes Rust passaram, zero falhas; 8 integrações opt-in ignoradas. Rodada
  sequencial, antes do release, sem inferência ou login automático.
- 62 testes JS passaram, zero falhas. Header testado com título separado de
  Atualizar/Fechar, rótulos acessíveis e callbacks independentes.
- Git real: stash + 1.000 dependências não ignoradas e Changes vazio não impedem
  criar/trocar. Staged, unstaged e novos compatíveis acompanham a troca sem
  alterar conteúdo/index/stashes. Colisões locais, untracked e ignored recusadas
  sem sobrescrita. Falha de switch -c não cria a branch. Remotas/tracking, merge,
  exclusão segura, stash apply/drop e cotas continuam cobertos pela suíte.
- Vite e Rust release compilados. Warning pré-existente do chunk principal
  ~4,50 MB permanece. Formatação JS/CSS/Rust aplicada; git diff --check passou.
- Removido status global extra antes da troca; sem novo scanner, timer,
  dependência, animação, auto-stash, force ou elevação de limites.

## Interface e desempenho

Inspeção da versão 0.6.9 via controle de aplicativos, perfil v069-profile e
fixture v068-stash-fixture em .validation. Janela 1440×932, dois stashes,
150 arquivos no stash de endpoints e 1.000 dependências locais não ignoradas.

- Atualizar/Fechar juntos no canto superior direito; título separado por borda.
  Rolagem só no corpo, header e ações permanecem visíveis.
- Criar feature/ui-smoke-v069 com checkbox de troca marcado funcionou na GUI.
  Clicar main voltou diretamente, sem a confirmação genérica de commit/stash.
- Expandir stash mostra 100 nomes na página 1/2 sob demanda. Rolagem verificada;
  nenhum arquivo de stash aberto/aplicado/removido nessa inspeção.
- Após fechar somente a janela isolada: main ativo, dois stashes originais,
  diff de working tree e index vazio; dependências preservadas. Branch de teste
  fica na fixture ignorada, não no repositório/projeto do usuário.

Medição depois da inicialização e inspeção, com modal aberto, stash expandido
na primeira página e corpo rolado. Kernel de automação desconectado antes da
amostra; estado confirmado depois. Sem minimizar janela, desativar GPU ou
acessibilidade, build ou inferência durante a amostra. Inclui host + descendentes
WebView2, Windows, 8 processadores lógicos.

| Duração | CPU média da máquina | WS pico | Privado pico | Crescimento WS | Gate |
| --- | --- | --- | --- | --- | --- |
| 32,54 s | 0,114% | 398,93 MiB | 305,19 MiB | -0,55 MiB | PASS |

Gates mantidos: ≤2% CPU, ≤900 MiB WS e ≤128 MiB crescimento. Working sets
compartilham páginas; não é memória única. Não prova desempenho por horas,
paridade completa/superioridade ao VS Code ou economia de créditos/tokens.

## Distribuição

Frontend final embutido em Rust release; pacote portátil e Setup 0.6.9 gerados
pelos scripts existentes. NSIS/lógica de instalação não alterados e suíte de
instalação não repetida. Setup não executado no perfil do usuário; permanece
sem assinatura própria, sujeito a avisos/bloqueios SmartScreen/corporativos.
EXEs/DLLs/dist/target/ui-dist/perfis/fixtures continuam ignorados no Git.
Use o novo Setup com SpeedCode fechado para atualizar. Release 0.6.8 preservado.
