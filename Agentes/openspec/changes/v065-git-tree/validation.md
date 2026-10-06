# Validação SpeedCode 0.6.5

2026-10-05. Árvore Git e limpeza de abas/metadados conforme spec.md.
- JavaScript: 55 passaram, zero falhas. Hierarquia por nível, dados originais,
  cache serializado, resultado tardio ignorado, collapse liberando cache,
  limites de 16 grupos/2.000 registros/8.000 nós/16 níveis/200 linhas por página,
  pasta vazia recolhível, branches de expansão independentes e limpeza do editor.
- Rust: 53 passaram, 8 opt-in ignorados, zero falhas. Nenhuma mudança no backend.
- Frontend: build passou; alerta existente do chunk principal ~4,50 MB permanece.
  Nenhuma dependência, timer ou watcher novo. Atualizar Git explicitamente invalida
  snapshots das pastas novas, permitindo carregar novamente arquivos alterados.

## GUI real e processos

Skill computer-use, perfil .validation/v065-profile e repo artificial
.validation/v065-tree, janela 1440×932, sem CLI, MCP, inferência ou edição:

- Pasta nova src carregou scoped pelo Git e expandiu dentro do mesmo painel.
  Confirmados src → pages → events → details → index.ts, cada nível por clique,
  com nome curto, indentação, contagem e ações individuais nos arquivos.
- Clique no arquivo abriu diff. Fechar o diff removeu aba e caminho do cabeçalho,
  exibindo somente welcome e “Seu espaço de trabalho”.
- Duplo clique abriu o arquivo e revelou ancestrais no explorador. Clique no ×
  do buffer removeu aba e breadcrumb; nenhum nome residual no visualizador.
- Arquivo fonte da fixture permaneceu intacto; nenhuma ação stage/discard,
  commit/push/deploy, inferência ou alteração no perfil real.

Gate de repouso, árvore Git expandida, views fechadas, app + descendentes WebView2:
32,60 s / 8 CPUs lógicos; CPU média máquina 1,618%; pico working set 277,54 MiB;
privado 322,75 MiB; crescimento WS −1,62 MiB. PASS sem ampliar metas existentes
(CPU≤2%, WS≤900 MiB, crescimento≤128 MiB). Cenário pequeno; não é gate de fixture
grande, comparação causal com 0.6.4/VS Code, teste por horas ou garantia universal.
Limites em árvore adversarial de 2 mil paths profundos foram testados em JS,
não medidos por horas no WebView. Nenhuma economia de tokens foi inferida.

## Build e distribuição

- Frontend e Rust release 0.6.5 compilados; FileVersion verificado.
- EXE SHA256: 172DDA0193C15E5F5C11EF7F7C185E78E4F7FA8BDB3434B0F18B88087697D160.
- Portátil em dist/SpeedCode-0.6.5 e pacote dist/SpeedCode; duas DLLs, Ruff e docs.
  Instalador dist/installer/SpeedCode-0.6.5-Setup.exe gerado com versão correspondente.
  O instalador continua sem assinatura Authenticode própria. Sem mudanças no NSIS;
  a suíte de instalação não foi repetida nesta alteração da interface.
- git diff --check passou. Build, dist, EXEs/DLLs e perfis/fixtures seguem ignorados.
  Instância instalada 0.6.4 do usuário preservada; somente a janela isolada de
  teste foi encerrada. Nenhuma instalação automática na máquina do usuário.
