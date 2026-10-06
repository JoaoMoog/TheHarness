# Especificação

As cotas e seus limites são normativos em docs/PERFORMANCE.md.

- Abrir arquivo novo acima da cota MUST informar recusa; MUST NOT fechar ou
  descartar outra aba. Reload externo acima da cota preserva buffer e sinaliza conflito.
- Dirty tracking MUST permitir undo para checkpoint salvo e salvar durante edição
  concorrente sem marcar edições posteriores como salvas.
- Diff MUST NOT criar widget/modelos no startup e MUST liberar ao fechar.
- Manutenção MUST ter no máximo um ciclo em execução; foco em paralelo coalesce
  uma atualização; ocultar suspende timer; ocioso usa menor frequência.
- Fila chat MUST preservar ordem e drenar em lotes; consumo final somente após
  backlog drenado. Limites visuais MUST explicar parcialidade e manter harness.
- MCP stdio/HTTP/SSE MUST limitar bytes antes de parse, incluindo HTTP sem
  Content-Length e linha stdio sem newline; excesso MUST falhar explicitamente.
- IPC MUST limitar contagem/bytes concorrentes antes de Value allocation. Cota
  excedida MUST retornar erro sem retry/mutação automática.
- Imagens MUST verificar superfície antes de entregar base64 ao renderer.
- Novo recurso MUST incluir orçamento/lifecycle/teste de excesso e evidência de
  medição, não uma garantia universal de consumo ou eficiência de modelo.
