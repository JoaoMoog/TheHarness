# Onboarding do Aval — 12/10/2026

Apresentação em tela cheia, com os componentes e tokens atuais, antes de cadastro ou pagamento no primeiro acesso. Quatro etapas: proposta do Aval, cobrar, pagar e acompanhar até concluir. Todas deixam claro que os pagamentos e ações da outra parte são simulados. Os textos descrevem os fluxos existentes: destinatário primeiro em Cobrar, revisão antes de pagar, entrega por valor único ou marcos, prazo de sete dias e bloqueio de liberação por disputa.

## Comportamento

- “Continuar”, “Voltar”, “Pular” e “Começar a usar”, sem avanço automático.
- Concluir ou pular grava uma preferência local distinta das credenciais e dos dados da conta, com chaves separadas para release e validação. Sair da conta, colocar em segundo plano e reiniciar não apagam a preferência. Sem conclusão, reabrir começa na primeira etapa.
- Contas já cadastradas no aparelho não recebem a apresentação automaticamente após esta atualização. Podem abri-la por “Conhecer o Aval” na entrada ou Menu → Ajuda → Conhecer o Aval.
- Revisar a apresentação mantém a rota e os dados atuais. Um link recebido continua aberto após concluir ou pular.
- Voltar do Android e Esc voltam uma etapa; na primeira etapa dispensam a apresentação. O foco fica no modal, cada etapa anuncia o título e ao fechar retorna ao controle de origem. O conteúdo rola sem esconder as ações inferiores.
- Mocks 115–118 guardam cada etapa. São isolados da preferência do usuário. Os demais mocks não recebem a apresentação por cima da tela.

## Verificação

`node --import tsx scripts/check-onboarding.mjs` verifica em release e validação a experiência inicial, retomada incompleta, navegação, conclusão, preferência persistente, revisão, link recebido, cadastro/saída local, conta existente, foco/teclado, função de voltar e tela estreita com texto ampliado. `verificacao.json` registra os resultados; as capturas registram o aspecto visual.

`src/prototype/onboarding.test.ts` verifica a preferência independente, fronteiras das etapas, isolamento de ambientes/mocks e funcionamento em memória quando o armazenamento da preferência está bloqueado. A revisão com TalkBack em aparelho físico permanece uma validação manual adicional; não foi executada nesta sessão.

Os APKs release e validação foram recompilados e instalados no emulador sem apagar os dados existentes. Os módulos e estilos embarcados foram comparados por SHA-256 com a saída de build; o release continua sem o catálogo de mocks. No Android, `android-inicial.xml`, `android-cobrar.xml`, `android-voltar.xml` e `android-dispensado.xml` registram a primeira apresentação, avanço para cobrar, retorno com o botão do sistema e dispensa. As capturas visuais são do navegador; a janela Android usa proteção de captura.

`android-reaberto.xml` confirma que a apresentação não se repetiu após encerrar o processo e abrir novamente. `android-rever.xml` confirma a revisão pelo botão da entrada; a apresentação ficou aberta no emulador para revisão do usuário.
