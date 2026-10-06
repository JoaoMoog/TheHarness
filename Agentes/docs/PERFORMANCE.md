# Contrato de desempenho — 0.6.2

Mantido em 0.7.0/SpeedCode sem ampliar cotas. Troca/criação de branch não executa
mais um status global extra: o próprio git switch valida a segurança da operação.
Sem force/reset/auto-stash, com proteção contra sobrescrita de ignorados.
Modal mantém título fixo e agrupa Atualizar/Fechar à direita; somente conteúdo
rola. Sem timers, animações ou novas cotas. Branches/stashes ficam no modal
aberto pelo nome da branch. Extras Git não são consultados com modal fechado.
Stashes: 50 nomes/página, arquivos só ao clicar (até 2 mil nomes, 100/página),
um snapshot e uma leitura de metadados por vez. Fechar, recolher ou trocar projeto
libera dados e invalida respostas tardias. Diff de um arquivo sob clique mantém
as cotas existentes; sem patch completo automático. Leituras status/stash list/
stash show/cat-file têm deadline de 10 s; mutações nunca são interrompidas pelo
deadline de leitura. Stash create admite até 200 alterações visíveis e exclui
dependências/ignorados, sem varrer recursivamente o projeto no JavaScript.
Pastas Git usam somente a lista
de status já carregada, com cabeçalhos incluídos nas 200 linhas de cada página;
expansões obsoletas são liberadas. Árvore: até 8 mil nós/16 níveis; além disso,
caminhos são compactados, não descartados. Pastas novas: uma leitura Git por vez,
ao abrir o painel Git/Expandir tudo, até 16 leituras sequenciais por lote,
16 grupos carregados/2 mil caminhos projetados;
recolher libera os grupos. Mudança de projeto/status invalida resultados tardios.
Todos os níveis conhecidos abrem por padrão. Recolher tudo libera snapshots;
a escolha persiste durante refresh no mesmo projeto. Sem retry automático de
erros/limites. Lote suspende entre leituras quando o painel/janela fica oculto.
Nenhuma varredura do projeto ou timer adicional.
Worktrees de chat: preparação uma vez, sob demanda, fora da thread da janela.
Até 8 repos/20 mil arquivos rastreados/256 MiB por tarefa; 64 tarefas preservadas
por armazenamento, sem remoção automática para liberar espaço. Preflight dos
commits/instruções antes do checkout; hooks de checkout não executados. Mutações
Git não são repetidas/interrompidas automaticamente. Clearing libera contexto,
não apaga worktrees/branches; raízes editoriais persistem em RAM para permitir
salvar buffers abertos, sem entrar no catálogo compartilhado. Busca Rust mantém
6 mil arquivos/12 MiB/1,2 s agregados, respeita excludes de worktrees e poda
subárvores por pathPrefix. Não multiplica timers/watchers/runtime; mais janelas,
checkouts, CLIs e builds têm custo adicional, não ganho automático de CPU/tokens.
Navegação Git → arquivo lê apenas
ancestrais, sequencialmente, sob ação do usuário; máximo 16 diretórios expandidos.
Não adiciona timer, scanner, índice, animação ou cópia de documento por tecla.

Leveza e fluidez são critérios de aceitação, não uma promessa de CPU/RAM fixa.
Rust não torna Monaco, WebView2, um site, build .NET ou um CLI automaticamente leve.

## Proteções implementadas

| Área | Proteção |
| --- | --- |
| Arquivos | 24 abas; admissão de 32 MiB agregados de texto UTF-16/snapshot e data URLs; nunca evicta trabalho não salvo |
| Digitação | Dirty por checkpoint/undo em O(1); não copia documento/reconstrói abas por tecla |
| Editor grande | Acima de 512 Ki caracteres: texto simples; edição e salvar mantidos |
| Entrada do editor | Caminho textarea do Monaco em vez de EditContext/TSF; IME, atalhos e acessibilidade mantidos |
| Entrada do host | Sem captura de DeviceEvent/HID bruta que o app não usa; eventos normais da janela/WebView mantidos |
| Diff | Widget só ao abrir, descartado ao fechar; 512 Ki caracteres/10 mil linhas por lado; computação até 1 s |
| Explorador | 16 pastas expandidas, 8 mil registros em cache, 1 mil linhas visíveis; recolher libera cache |
| Git | Regras de ignore, node_modules excluído, grupos sob demanda, 2 mil registros/200 linhas por página; máximo 1 mil branches/500 stashes |
| Manutenção | Serial/coalescida; 10 s durante atividade, 30 s após 1 min ocioso; sem timer de manutenção quando documento oculto |
| Chat | Fila visual: 512 eventos/8 MiB JSON; lote até 1 MiB + envelope; texto visual limitado; não redesenha em poll vazio |
| Contexto | Redução somente de apresentação; sessão e contexto oficial Copilot preservados; limpeza é escolha do usuário |
| IPC | 32 pedidos; 8 MiB/pedido; 16 MiB de entrada pendente; permissões liberadas após resposta na janela |
| Terminal | 8 sessões; filas/saída limitadas com backpressure; 2 mil linhas de scrollback; resize coalescido; cursor sem animação |
| Imagens | Até 8 MiB e 8 megapixels, dimensões verificadas no Rust antes de exibir; SVG/GIF/animações precisam abertura externa |
| Browser | Até duas janelas de prévia; nenhuma ponte IPC em página não confiável |
| WebView2 | Ao perder foco, target Low; Normal ao voltar. Dica ao runtime, não cota de memória nem suspensão de agentes |
| MCP próprio | Mensagem stdio, JSON HTTP e evento SSE até 1 MiB **antes** de parse; timeout; erro explícito, sem retry iniciado pelo app |
| Formatação | Sob demanda, 512 KiB/30 s; worker encerra após resposta; Python/C# isolados |

32 MiB não é o working set total: modelos Monaco, histórico undo, decoder, GPU,
WebView2 e processos filhos têm overhead. Textos crescidos por digitação não são
apagados para manter uma cota. Limites recusam novas cargas e preservam arquivos.
Uma prévia HTML pode executar JavaScript pesado; fechar a prévia ou usar navegador
externo isola o uso, mas não reduz o custo do site. CLIs/MCPs externos não possuem
cota de CPU/RAM do Windows nesta versão. Builds/formatadores têm picos legítimos.
MCPs herdados internos do CLI e o transporte interno do SDK não passam pelo
limitador de MCP gerenciado pela ferramenta. Não há promessa de controle total
do consumo de qualquer programa que o usuário execute no terminal.

## Gate reproduzível de repouso

Abra release em perfil isolado com fixture grande, sem CLI/chat em inferência,
prévia HTML ou formatação ativa. Espere terminar inicialização. Meça a árvore:

Conclua e desconecte a instrumentação de inspeção/automação antes da amostra,
mantendo o mesmo estado/foreground. Na validação 0.6.6, o cliente UI Automation
ativo aumentou CPU do WebView2 inclusive no release anterior; nenhum recurso de
acessibilidade/GPU do app foi desabilitado. Registre também amostras contaminadas,
sem tratá-las como consumo de repouso não instrumentado.

```powershell
.\scripts\check-performance.ps1 -ExePath '.\dist\SpeedCode-0.7.0\SpeedCode.exe' -Seconds 30
```

Metas desse cenário: CPU média normalizada pela quantidade de processadores
lógicos ≤2%, working set agregado ≤900 MiB, crescimento ≤128 MiB durante amostra.
São gates de regressão com margem, não uso típico prometido. Script não fecha
processos, não altera Windows nem limpa sessões. Working sets compartilham páginas.
Para comparação entre versões, use mesma fixture, estado, resolução, duração e
hardware; inclua WebView2, não apenas o host Rust. Uso por horas necessita soak
test; uma amostra de segundos não prova ausência de leak ou superioridade ao VS Code.

## Diagnóstico sem funcionalidades da IDE

O exemplo isolado abaixo cria uma janela mínima, sem editor/Git/chat/scripts/IPC.
Não usa o perfil do usuário nem inicia agentes. Feche-o normalmente após medir.
Uma pasta temporária por PID guarda apenas o perfil de teste do WebView2.

```powershell
.\scripts\build.ps1 -Action build -Release -Example webview-idle
# Execute o EXE; aguarde startup antes de medir. --native-only retira também WebView2.
# --raw-events ativa a captura bruta anterior somente para comparação do probe.
.\target\x86_64-pc-windows-gnullvm\release\examples\webview-idle.exe
.\scripts\check-performance.ps1 -ExePath '.\target\x86_64-pc-windows-gnullvm\release\examples\webview-idle.exe' -Seconds 30
```

É um instrumento de isolamento, não substituto do gate da aplicação completa.
Não desabilitamos GPU ou acessibilidade para fabricar uma medição menor, e não
suspendemos/recarregamos a WebView principal com uma sessão ativa. Isso preserva
trabalho e segue a orientação de [desempenho WebView2 da Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance).

## Para qualquer melhoria futura

Defina orçamento, liberação de recursos, comportamento ao atingir limite e teste
adversarial antes de adicionar o recurso. Não aumente limites para esconder um
problema. Nunca substitua evidência por "é Rust, então é leve".
