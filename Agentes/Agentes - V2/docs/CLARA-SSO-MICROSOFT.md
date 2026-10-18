# Microsoft SSO da CLARA

O piloto aceita apenas identidades do **Diretório Padrão** escolhido. A autenticação usa Microsoft Entra, MSAL e Authorization Code com PKCE. Não exige segredo de cliente no aplicativo ou navegador.

## Registro configurado

| Campo | Valor |
|---|---|
| Aplicativo | CLARA — Piloto local |
| Tenant | `96aa1766-b2fe-4e57-b1b2-1b632544fc9f` |
| Client ID / API ID | `016ff30e-1bd9-4632-87df-9e3b851c9f5b` |
| Tipo de conta | Apenas este diretório |
| API | `api://016ff30e-1bd9-4632-87df-9e3b851c9f5b` |
| Escopo delegado | `access_as_user`, consentimento de administrador |
| Versão do access token | 2 |
| Redirecionamentos SPA | `http://127.0.0.1:3000/auth-redirect.html` e `http://localhost:3000/auth-redirect.html` |

O registro solicita somente o escopo da própria CLARA. Não solicita leitura de e-mails, arquivos ou administração do Microsoft 365. O consentimento administrativo foi concluído pelo usuário no portal. Após uma falha inicial na verificação MFA, o usuário confirmou em 18/10/2026: **“Consegui entrar na CLARA”**. Essa é uma validação manual do login real; os testes automatizados usam autenticação local em ambientes isolados. A inspeção da aba autenticada pelo agente não foi autorizada pelo navegador.

## Configuração local

O arquivo `app/.env.pilot.local` já foi configurado nesta máquina. Para reproduzir em outro ambiente:

```dotenv
AUTH_MODE=msal
LOCAL_AUTH_ENABLED=false
MSAL_TENANT_ID=96aa1766-b2fe-4e57-b1b2-1b632544fc9f
MSAL_SPA_CLIENT_ID=016ff30e-1bd9-4632-87df-9e3b851c9f5b
MSAL_API_CLIENT_ID=016ff30e-1bd9-4632-87df-9e3b851c9f5b
MSAL_API_SCOPE=access_as_user
MSAL_SPA_SCOPE=api://016ff30e-1bd9-4632-87df-9e3b851c9f5b/access_as_user
```

No diretório `app`, execute `npm.cmd run pilot` (desenvolvimento) ou `npm.cmd run build` seguido de `npm.cmd run pilot:start` (produção). Abra http://127.0.0.1:3000, clique **Entrar com Microsoft** e conclua a verificação da conta na janela Microsoft. O primeiro acesso apresenta o onboarding e depois abre Início.

O servidor valida assinatura, emissor, tenant, audiência e escopo do token. O acesso às análises continua limitado à participação do usuário em cada espaço. Sessões antigas de senha local ou demonstração não são aceitas no modo Microsoft. Dados de contas locais antigas permanecem armazenados, mas não são automaticamente associados à identidade Microsoft.

## Se o Microsoft Authenticator não receber a solicitação

A mensagem “We couldn't send a request to your mobile device at this time” ocorre na Microsoft antes de retornar à CLARA. Na página Microsoft, use **Entrar de outra maneira** se houver outro método já cadastrado. Abra o Authenticator e confira conexão e notificações. Se nenhuma alternativa estiver disponível, o administrador do diretório deverá ajudar a recuperar o método de autenticação. Não desative MFA para contornar o problema.

Não envie senha, códigos, tokens ou chaves pelo chat. A CLARA não precisa desses dados para concluir sua configuração.

Referências: [registro de aplicativo](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app), [expor uma API](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis), [solução de problemas do Authenticator](https://support.microsoft.com/en-us/authenticator/troubleshoot-problems-with-microsoft-authenticator).
