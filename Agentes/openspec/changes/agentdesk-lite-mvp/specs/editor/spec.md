# Editor — requisitos normativos

## Requisitos

- ED-01 MUST abrir, editar, salvar, selecionar, copiar/colar, desfazer/refazer, buscar/substituir e ir para linha em arquivo suportado.
- ED-02 MUST exibir abas, estado sujo, gutter, scroll, indentação configurável e encoding/EOL detectados.
- ED-03 MUST preservar bytes/encoding/EOL, inclusive UTF-8 com ou sem BOM e CRLF/LF; conversão silenciosa é proibida.
- ED-04 MUST tratar binário como não editável e UTF-16/encoding desconhecido com aviso/modo explícito.
- ED-05 MUST usar limite explícito para arquivo grande, sem truncar conteúdo; modo limitado ou readonly é aceitável.
- ED-06 MUST usar salvamento seguro, tratar falha de disco/permissão/remoção e preservar atributos relevantes quando possível.
- ED-07 MUST detectar mudança externa. Buffer sujo em conflito oferece Comparar, Recarregar e Manter buffer; não sobrescreve silenciosamente.
- ED-08 MUST manter conteúdo de buffer, DiskSnapshot, index e HEAD separados.
- ED-09 SHOULD fornecer realce sob demanda para linguagens alvo somente após decisão de custo/licença.

## Cenários

### ED-S01 — preservação CRLF e BOM

Given arquivo UTF-8 com BOM e CRLF
When o usuário muda uma linha e salva
Then o arquivo continua com BOM e CRLF
And a operação reporta erro em vez de converter silenciosamente se não puder preservar.

### ED-S02 — conflito com agente

Given buffer sujo aberto e um processo externo altera o arquivo em disco
When a alteração externa é confirmada
Then a UI mostra Comparar, Recarregar e Manter buffer
And nenhum conteúdo é descartado ou salvo automaticamente.

### ED-S03 — arquivo binário

Given bytes classificados como binários
When o usuário os abre
Then o editor usa modo não editável
And Save não fica disponível.
