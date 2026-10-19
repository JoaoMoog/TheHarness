# Microsoft SSO

Configure tenant, registros SPA/API, escopos e grupos do destino conforme o [guia Microsoft Entra](configuracao/03-MICROSOFT.md).

Os campos `MSAL_*` e `CLARA_PLATFORM_ADMIN_GROUP_IDS` estão nos quatro arquivos de ambiente em `app/`. Não há conta pessoal pré-autorizada. A autorização administrativa depende dos IDs de grupos no token validado; e-mail não concede acesso.

Use `AUTH_MODE=msal` e `LOCAL_AUTH_ENABLED=false` nos ambientes corporativos. Cadastre a origem e `/auth-redirect.html` como retorno da SPA. O fluxo usa PKCE e não exige client secret Microsoft na aplicação.
