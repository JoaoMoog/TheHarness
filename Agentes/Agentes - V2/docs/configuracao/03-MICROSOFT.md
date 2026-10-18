# Microsoft Entra ID / Active Directory

## O que configurar

A CLARA usa Microsoft Entra ID (antigo Azure AD), OAuth 2.0 Authorization Code com PKCE no navegador e validação do access token na API. Um AD local pode fornecer as identidades por sincronização/federação com Entra; a aplicação não consulta LDAP nem recebe senhas do AD.

Crie dois registros no tenant: **CLARA SPA** (navegador) e **CLARA API** (recurso protegido). Os IDs são configurações públicas; não são secrets. Uma SPA não deve armazenar client secret. [Tipos de aplicação Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/v2-app-types).

## 1. Registro da API

No Microsoft Entra admin center, abra **App registrations → New registration**:

1. Nome: `CLARA API`.
2. Tipos de conta: contas deste diretório organizacional, salvo necessidade corporativa diferente.
3. Anote **Application (client) ID** e **Directory (tenant) ID**.
4. Em **Expose an API**, use uma Application ID URI como `api://<API_CLIENT_ID>`.
5. Adicione o escopo delegado `access_as_user`. Configure consentimento e descrição conforme a política da organização.
6. No manifesto, configure a versão de access token da API como **2** (`api.requestedAccessTokenVersion: 2`). O servidor valida issuer `https://login.microsoftonline.com/<TENANT>/v2.0`.

Configure no ambiente:

```dotenv
AUTH_MODE=msal
LOCAL_AUTH_ENABLED=false
MSAL_TENANT_ID=<Directory tenant ID>
MSAL_API_CLIENT_ID=<Application client ID da API>
MSAL_API_SCOPE=access_as_user
```

[Como expor um escopo de API](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis).

## 2. Registro da SPA

1. Crie `CLARA SPA` no mesmo tenant.
2. Em **Authentication → Add a platform**, selecione **Single-page application**.
3. Registre a URL de redirecionamento exata usada pelo navegador: origem de `PUBLIC_APP_URL`. No piloto, `http://localhost:3000` e `http://127.0.0.1:3000` são origens diferentes; registre a que será usada.
4. Em **API permissions → My APIs**, selecione `CLARA API` e a permissão delegada `access_as_user`.
5. Conceda consentimento administrativo se exigido pela organização.
6. Não habilite implicit grant como substituto de PKCE. Não crie uma senha de aplicativo para a SPA.

```dotenv
MSAL_SPA_CLIENT_ID=<Application client ID da SPA>
MSAL_SPA_SCOPE=api://<API_CLIENT_ID>/access_as_user
PUBLIC_APP_URL=https://clara.suaempresa.com
```

[Configuração de permissões entre SPA e API](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis).

## 3. Grupo de administradores da plataforma

Crie um grupo de segurança chamado `CLARA-Administradores-Plataforma`. Nome não autoriza acesso: copie o **Object ID do grupo** para `CLARA_PLATFORM_ADMIN_GROUP_IDS`.

O membro solicitado para o piloto é `jpmoog@hotmail.com`. Se a conta for externa ao tenant, ela precisa existir como usuário convidado no diretório e concluir o ingresso. A autorização da CLARA usa o grupo no token assinado; não compara o e-mail a uma lista privilegiada.

No registro da **API**, configure group claims para que os IDs dos grupos de segurança constem no **access token** emitido para a CLARA. Se usar “Groups assigned to the application”, atribua os grupos à Enterprise Application correspondente e confira as exigências de licença do tenant.

```dotenv
CLARA_PLATFORM_ADMIN_GROUP_IDS=<Object ID do grupo>
```

Podem ser usados vários IDs separados por vírgula. O mesmo conjunto controla os menus de créditos e indicadores executivos. Grupos vazios, token expirado, tenant diferente, sessão local/demo ou group overage não liberam acesso. A implementação não consulta Microsoft Graph para resolver overage; restrinja os grupos emitidos ou adapte esse fluxo antes de usar usuários com excesso de grupos. [Grupos e overage](https://learn.microsoft.com/en-us/entra/identity-platform/custom-rbac-for-developers).

Adicionar ou remover membros do grupo exige nova autenticação para atualizar as claims. Os privilégios administrativos da plataforma exigem claims ainda válidas. Para revogação imediata de outras sessões, revogue as sessões da aplicação pelo procedimento operacional, além da alteração no diretório.

## 4. Permissões dentro da CLARA

São camadas distintas:

| Camada | Origem | Efeito |
|---|---|---|
| Entrada na plataforma | Entra, tenant e scope | Autenticar e criar sessão |
| Créditos e indicadores executivos | Grupo Entra permitido | Administrar limites e consultar utilização |
| Espaço | Membro com papel leitor/editor/admin | Acessar fontes e dashboards do espaço |
| Dashboard individual | Convite aceito e acesso específico | Consultar o dashboard compartilhado |
| Modelos SAP | `SAP_SAC_WORKSPACE_MODELS` | Restringir quais modelos um espaço pode consultar |

Ser administrador de um espaço não concede acesso aos créditos de toda a plataforma. Participar do grupo da plataforma também não substitui automaticamente as permissões de um workspace.

## 5. Validar

1. Reinicie a aplicação após preencher as variáveis.
2. Entre com Microsoft e verifique nome e tenant corretos.
3. Teste uma conta que está no grupo e outra fora dele.
4. Confirme que fora do grupo os endpoints restritos retornam `403`, mesmo chamados manualmente.
5. Teste isolamento entre espaços e aceite de convites com conta Microsoft correspondente.

O servidor verifica assinatura pelo JWKS Microsoft, issuer, audience, tenant e scope. Não aceite ID token no lugar do access token da API nem desabilite essa validação para contornar um erro de login.

## Problemas comuns

| Sintoma | Conferir |
|---|---|
| Redirect URI mismatch | URL registrada e origem usada no navegador, incluindo porta e protocolo |
| Consent required | Permissão delegada da API e consentimento do administrador |
| Token inválido | Audience da API, tenant e versão 2 do access token |
| Login funciona, menus restritos não aparecem | Object ID do grupo, claim no access token da API, expiração e novo login |
| Grupo existe, mas autorização é negada | Claim overage, grupo atribuído à aplicação errada ou ID incorreto |
