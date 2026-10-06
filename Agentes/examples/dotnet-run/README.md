# API .NET de exemplo

API mínima ASP.NET Core com Swagger UI (Swashbuckle 10.2.3). Requer .NET SDK 10; o primeiro build restaura o pacote NuGet pela internet.

- `GET /`: mensagem de confirmação.
- `GET /health`: JSON com `status: ok`.
- `/swagger`: interface para testar os endpoints com **Try it out → Execute**.
- `/swagger/v1/swagger.json`: documento OpenAPI. Swagger habilitado somente em `Development`.

## Rodar no SpeedCode

1. Abra a raiz do repositório **SpeedCode** como projeto.
2. Entre em **Executar .NET**, selecione **SpeedCode — API exemplo .NET 10**.
3. Escolha **Navegador do SpeedCode** para visualizar dentro da ferramenta.
4. Clique **Executar / F5**. A task faz o build e inicia a API.
5. O navegador abre `http://127.0.0.1:51879/swagger`. Expanda `GET /health`, clique em **Try it out** e **Execute**.
6. Use o **× na aba do terminal .NET** ou **Parar / Shift+F5** para encerrar. Para processo ativo, confirme o encerramento.

As configurações da raiz [launch.json](../../.vscode/launch.json) e
[tasks.json](../../.vscode/tasks.json) usam somente `${workspaceFolder}`.
Se a porta estiver ocupada, altere `ASPNETCORE_URLS` no launch.json.
O `openExternally` é compatível com VS Code; a escolha de navegador integrado
no SpeedCode substitui essa ação. O SpeedCode executa, mas não tem breakpoints/attach.

## Usar o JSON em outro projeto

Copie o conteúdo desta pasta para uma pasta independente fora deste checkout
(ou use um projeto cujo diretório seja a raiz do Git). Os arquivos
[.vscode/launch.json](.vscode/launch.json) e [.vscode/tasks.json](.vscode/tasks.json)
desta pasta são o exemplo genérico: ajuste `Api.csproj`, `Api.dll`, framework e porta.
Ao cadastrar uma subpasta de um repo Git, SpeedCode usa a raiz desse repo;
nesse caso, adapte os caminhos relativos como nos JSONs da raiz acima.

Pelo terminal, sem a IDE:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run --project examples/dotnet-run/Api.csproj --urls http://127.0.0.1:51879
```

Execute o comando na raiz do SpeedCode; Ctrl+C encerra. `bin/` e `obj/` são ignorados.
