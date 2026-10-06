# Workspace local

## Requisitos

- WS-L1 MUST carregar um catálogo local de diretórios e persistir cadastros sem copiar/apagar conteúdo.
- WS-L2 MUST permitir adicionar por caminho ou seletor nativo e alternar entre entradas reais.
- WS-L3 MUST listar somente o diretório solicitado, sem varredura recursiva na abertura.
- WS-L4 MUST impedir navegação fora da raiz canônica e omitir symlinks.
- WS-L5 MUST bloquear navegação para outro arquivo/repositório enquanto o buffer estiver sujo.
- WS-L6 MUST exibir erros de caminho/permissão em vez de linhas demonstrativas.

## Cenários

### Catálogo local
Given uma pasta acessível
When o usuário a adiciona
Then ela aparece no catálogo e permanece após reiniciar
And nenhum conteúdo é copiado, apagado ou indexado recursivamente.

### Exploração
Given um repositório selecionado
When o usuário abre um diretório
Then somente seus filhos diretos são listados
And links simbólicos não são atravessados.
