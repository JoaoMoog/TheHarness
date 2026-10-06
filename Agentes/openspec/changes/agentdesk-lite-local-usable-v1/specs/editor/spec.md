# Editor local

## Requisitos

- ED-L1 MUST abrir somente arquivo UTF-8/UTF-8 BOM até 2 MiB nesta fatia.
- ED-L2 MUST recusar sem escrever arquivos maiores ou com encoding inválido.
- ED-L3 MUST permitir edição e salvar no caminho aberto, preservando BOM e EOL LF/CRLF detectados.
- ED-L4 MUST indicar buffer sujo e bloquear navegação destrutiva.
- ED-L5 MUST comparar metadados do disco antes de salvar e recusar sobrescrita automática se detectou alteração externa.
- ED-L6 MUST revalidar o arquivo dentro da raiz antes de leitura/gravação.

## Cenário

Given arquivo UTF-8 aberto sem alterações externas
When o usuário edita e salva
Then o arquivo em disco recebe o texto e mantém BOM/EOL suportados.
