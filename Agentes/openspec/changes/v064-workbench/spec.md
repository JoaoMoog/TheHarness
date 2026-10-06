# SpeedCode 0.6.4 — pastas Git, fechamento de terminal e Swagger

## Escopo

Agrupar alterações por diretório sem consultar novamente o disco; oferecer um
botão × acessível em cada aba de terminal; disponibilizar Swagger na API exemplo.
Não alterar as cores gerais, semântica do Git, perfis/credenciais ou projetos externos.

## Critérios

- Preparados e alterações têm agrupamento e expansão independentes. Arquivos da
  raiz permanecem diretamente visíveis; diretórios exibem nome/caminho e quantidade.
  Pastas começam recolhidas. Cada grupo representa o diretório pai dos arquivos.
- Clique na pasta expande/recolhe. Arquivos exibem nome curto, tooltip com caminho
  completo, ações individuais intactas, clique para diff e duplo clique para
  arquivo/explorador. Renames, conflitos e pastas novas mantêm os dados originais.
- Agrupar somente entradas retornadas pelo Git. Preservar filtros, limite de
  2.000 caminhos, bloqueio de ações globais em resultado parcial e 200 linhas por
  página, incluindo cabeçalhos de pasta. Nenhuma varredura, timer ou watcher novo.
  Estado de expansão limitado às pastas presentes, reiniciado ao trocar escopo.
- × é um botão separado do seletor de aba, acessível por teclado. Processo ativo
  exige confirmação; cancelar preserva tudo. Fechar executa terminal_close antes
  de descartar xterm/DOM; falha preserva a sessão. Fechamentos duplicados são
  bloqueados, resize pendente cancelado e poll tardio não escreve no terminal fechado.
- API exemplo .NET 10: Swashbuckle 10.2.3, Swagger apenas em Development, UI e
  especificação com endpoints / e /health. Ambos launch.json usam %s/swagger,
  caminhos relativos a workspaceFolder e nenhum caminho pessoal.

## Validação

Testes JS de agrupamento/paginação e lifecycle do terminal; suíte Rust; teste
opt-in real .NET nas configurações independente/raiz; builds frontend/release,
pacote portátil e instalador. Conferência visual em perfil isolado, sem executar
comandos através de automação de UI. Amostras incluem descendentes WebView2;
não equivalem a garantia universal ou teste por horas. Não interromper instâncias
ou APIs já abertas pelo usuário, nem fazer commit/push/deploy.
