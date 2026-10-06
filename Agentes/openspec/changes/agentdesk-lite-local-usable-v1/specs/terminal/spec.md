# Windows PowerShell externo

## Requisitos

- TM-L1 MUST abrir o Windows PowerShell real em janela independente no repositório ativo.
- TM-L2 MUST permitir ao usuário iniciar CLIs e comandos interativos manualmente.
- TM-L3 MUST não executar comandos automaticamente nem simular saída/processos na IDE.
- TM-L4 MUST comunicar falha ao iniciar o executável.
- TM-L5 MUST informar que o terminal é externo e que cwd é a raiz ativa.

## Fora do escopo

Terminal embutido, PTY/ConPTY com renderer ANSI, scrollback da IDE, multiplexação e gerenciamento de processos de agentes.
