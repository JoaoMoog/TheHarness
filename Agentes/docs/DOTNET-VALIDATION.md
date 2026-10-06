# Validação do executor .NET

Data: 2026-10-05. Ambiente: Windows x64, .NET SDK 10.0.401.

## Resultado

O teste real `real_dotnet_launch_build_serve_and_stop` passou nas duas formas documentadas:

1. API em pasta independente, usando os JSONs de `examples/dotnet-run/.vscode/`.
2. Repositório SpeedCode aberto, usando os JSONs de `.vscode/` na raiz.

Em cada caso, o teste carrega o catálogo pelo `Launcher`, prepara a configuração e executa o script no `Terminals`/ConPTY de produção, os mesmos componentes usados por Play/F5. Não substitui `dotnet` por um mock.

- A `preLaunchTask` faz o build real da API.
- O processo inicia e informa `Now listening on:`.
- `GET /` retorna `SpeedCode .NET launch validation OK`.
- `GET /health` retorna `{"status":"ok","application":"SpeedCode Example"}`.
- Swagger UI, JSON OpenAPI e assets JavaScript/CSS respondem com sucesso; a especificação contém `/` e `/health`.
- `serverReadyAction.uriFormat` aponta para `%s/swagger`, com detecção da URL coberta por teste JavaScript.
- O encerramento pelo terminal de produção fecha o processo; a porta deixa de aceitar conexões.

O teste escolhe portas livres e usa cópias temporárias dos arquivos de exemplo. Não altera projetos do usuário, credenciais ou sessões abertas. A API com Swagger compilou nessas cópias temporárias; a API que já estava aberta no checkout não foi interrompida.

A validação atual de suítes e empacotamento está em [v0.6.4](../openspec/changes/v064-workbench/validation.md). O teste real .NET acima foi executado separadamente e passou nas duas configurações.

## Reproduzir

Com o frontend já compilado, o ambiente Rust preparado e SDK 10 instalado, na raiz:

```powershell
.\scripts\build.ps1 -Action test -TestFilter real_dotnet_launch_build_serve_and_stop -IncludeIgnored -ShowOutput
dotnet build examples/dotnet-run/Api.csproj --nologo
```

O teste real é opt-in por executar compilação e processos externos. `bin/`, `obj/`, executáveis e builds estão no `.gitignore` e não são rastreados pelo Git.

## Limites do que foi validado

Foi validado o caminho de execução do backend, build, respostas HTTP e parada, não o clique físico em F5 nem a abertura automática da janela de navegador. O `serverReadyAction` foi carregado corretamente, e a detecção de URL é coberta pela suíte JavaScript. Para conferir a experiência visual, siga o [exemplo](../examples/dotnet-run/README.md).

O recurso executa aplicações; não implementa breakpoints, inspeção de variáveis ou attach. Os exemplos usam `${workspaceFolder}` e não contêm caminhos pessoais. Outras APIs podem exigir SDK, variáveis, credenciais ou tasks diferentes; não se presume que todo `launch.json` do VS Code seja compatível.
