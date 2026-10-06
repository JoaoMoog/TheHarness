# Terminal — requisitos normativos

## Requisitos

- TM-01 MUST permanecer bloqueado por G-TERMINAL até um spike Windows real demonstrar ConPTY e renderizador compatíveis.
- TM-02 MUST suportar terminal interativo com input, output, UTF-8, ANSI/VT, resize, foco, copiar texto, scrollback limitado, Ctrl+C, EOF e exit code.
- TM-03 MUST limitar output de alta taxa, memória de scrollback e escape sequences maliciosas.
- TM-04 MUST tratar OSC 52, hyperlinks e clipboard por política segura; terminal não interpreta sequência recebida como privilégio da IDE.
- TM-05 MUST limpar pseudoconsole, handles, pipes e processo nos cenários suportados e reportar falha de cleanup.
- TM-06 MUST ter múltiplas abas; no máximo cinco sessões abertas por padrão.

## Cenários

### TM-S01 — stdin e resize

Given processo fake interativo executado por ConPTY
When o usuário envia texto, redimensiona e usa Ctrl+C
Then o processo recebe input/tamanho/sinal esperado
And o renderer continua UTF-8 e responsivo.

### TM-S02 — output hostil

Given processo fake emitindo ANSI, OSC e output intenso
When o limite de scrollback e taxa é atingido
Then a sessão permanece utilizável ou informa descarte limitado
And clipboard ou ação privilegiada não é acionado sem política explícita.

### TM-S03 — encerramento

Given terminal ativo com processo e pipes
When a sessão é encerrada conforme fluxo confirmado
Then handles e pseudoconsole são liberados
And exit code/estado final ficam visíveis.
