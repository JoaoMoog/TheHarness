# Validação — Windows x64, 2026-10-03

## Executado

- `npm run build`: Vite production concluído; aviso de bundle Monaco grande já existente.
- `npm test`: 2 testes passaram, escolhas de conflitos diff3 e extração/validação de URL serverReadyAction.
- `scripts/build.ps1 -Action test -IncludeIgnored`: 9 testes passaram, incluindo SDK .NET 10.0.401.
- Git em temporários: locais/remotas/tracking, proteção de branch não mesclada, stash com arquivos novos/visualização/aplicação/remoção, Pull de bare remote divergente com conflito e abort; resolução textual e commit final de merge.
- PowerShell/ConPTY: duas sessões independentes; resize e encerramento.
- .NET: launch.json JSONC + task process dotnet build; DLL iniciada em ConPTY; endpoint respondeu HTTP; Stop encerrou processo e liberou porta. Exercita coreclr, não todas as combinações de configurações.
- JSONC: comentários/trailing comma, escaping de aspas, hash de configuração, variáveis não suportadas, overrides Windows e launchSettings/env.
- UI da distribuição: PNG 256×256 aberto na aba com informações/zoom; HTML com JS e imagem relativa abriu em janela do aplicativo; página mostrou `IPC: undefined`; branches locais/remotas e painel Run renderizaram.
- Release portable 0.3.0: EXE, libunwind.dll, WebView2Loader.dll, README e LEIA-ME em dist/AgentDeskLite. Inicialização confirmada depois da inclusão do loader.

## Correções encontradas pela validação

- Não propagar --literal-pathspecs a git stash: stash gera seus próprios pathspecs :(literal); herdar o switch impedia a limpeza de arquivos novos.
- Preservar tabs vazios no formato for-each-ref: trim removeria a última branch sem upstream.
- Build/package precisam distribuir WebView2Loader.dll além do runtime MinGW. Testes devem copiar os runtimes antes de iniciar o binário de teste.
- Abort de merge pode restaurar CRLF conforme configuração Git; teste compara texto normalizado.

## Limites de evidência

Não executamos as APIs particulares do usuário nem validamos todos os launch.json possíveis. Sem DAP/attach/breakpoints, IISExpress, compounds, tarefas background/extensão ou promessa de paridade VS Code. HTML file:// tem restrições de origem normais; fetch/módulos podem precisar de HTTP. Sem benchmark novo de CPU/RAM. Nenhum push/pull/stash aplicado nos repos pessoais do usuário; testes remotos usam bare repo local temporário.
