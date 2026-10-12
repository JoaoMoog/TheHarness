# Verificação do catálogo — concluída em 12/10/2026

Atualização de texto em 12/10/2026: Cobrar agora apresenta “Dados da cobrança”, “Descrição da cobrança” e “Valor da cobrança”. A confirmação, o cancelamento e os erros desse fluxo também usam cobrança. O fluxo Pagar mantém seus textos próprios. As capturas foram atualizadas.

- 118/118 mocks renderizados sem erro de JavaScript e sem valores `undefined` ou `NaN` na tela.
- Todas as rotas e janelas registradas nos módulos atuais possuem pelo menos um mock.
- Busca, link direto, restauração do estado e layout móvel verificados no navegador.
- Cadastro dentro do mock não altera a conta nem a credencial local; os exemplos mantêm dados e credenciais somente em memória.
- As 118 capturas estão em `capturas/` e os estados completos em `dados/`.
- 195 testes do projeto passaram; TypeScript e compilação Android passaram.
- Onboarding em tela cheia registrado nos mocks 115–118. Primeiro acesso, retorno após interrupção, conclusão, pular, revisão pela entrada/Ajuda, conta existente e preservação do link de cobrança foram verificados em release e validação.
- Foco, teclado, função de voltar usada pelo Android, rolagem a 320 px com texto ampliado e preservação da preferência após sair da conta foram verificados no navegador. Evidências em `../auditoria-2026-10-11/onboarding/`.
- Fluxo de cobrar novamente verificado nas versões release e validação: telefone, e-mail, CPF/CNPJ, edição, revisão e erros.
- Catálogo aberto no Android pelo menu Demo. APK de validação atualizado em `../Aval-validacao.apk`.
- O APK release não contém a página nem os módulos do catálogo.

`verificacao.json` registra a conferência de cada mock. `verificacao-artefatos.json` registra a galeria offline, seu filtro e a exportação do JSON padrão. Para repetir essa última conferência, execute `node --import tsx scripts/check-mock-artifacts.mjs`.

Os testes verificam a reprodução das telas e regras atuais. Os mocks não demonstram integrações reais nem substituem a validação de produto. O carregamento do assistente é um estado visual estático e não representa uma resposta recebida de um serviço externo.
