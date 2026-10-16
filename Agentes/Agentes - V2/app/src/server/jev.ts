import { APIError, APITimeoutError, APIUserAbortError, TypeSafeClient, noul } from '@typesafe-ai/sdk';
import { z } from 'zod';

export function createJevClient() {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error('Preencha TYPESAFE_API_KEY em app/.env.local.');
  return new TypeSafeClient({
    apiKey,
    baseURL: 'https://api.typesafe.ai',
    defaultModel: process.env.TYPESAFE_DEFAULT_MODEL?.trim() || 'jev-latest',
    timeout: 10000,
    retry: { maxRetries: 1 },
    logLevel: 'off',
  });
}

const connectionResponse = z.object({
  model: z.string().min(1),
  answers: z.object({ urgent: z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) }) }),
  usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }),
});

/** Sends only a fixed example, never application data. Requires a configured API key. */
export async function checkJevConnection() {
  const response = await createJevClient().systemOne({
    state: { message: 'Preciso de ajuda agora; o prazo termina em dez minutos.' },
    questions: { urgent: noul('A mensagem em `message` expressa urgência?') },
  }, { signal: AbortSignal.timeout(25000) });
  const parsed = connectionResponse.safeParse(response);
  if (!parsed.success) throw new Error('Jev devolveu uma resposta inválida para o teste de conexão.');
  return parsed.data;
}

/** Keep provider response bodies and credentials out of user-facing errors. */
export function jevErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    if (error.status === 401) return 'Chave TypeSafe inválida. Confira TYPESAFE_API_KEY em app/.env.local.';
    if (error.status === 403) return 'A conta TypeSafe não tem acesso a este recurso. Confira as permissões da chave.';
    if (error.status === 429) return 'Limite da API TypeSafe atingido. Aguarde e tente novamente.';
    if (error.status === 404) return 'Modelo TypeSafe indisponível. Confira TYPESAFE_DEFAULT_MODEL.';
    return `A API TypeSafe respondeu com HTTP ${error.status}. Tente novamente ou confira sua conta.`;
  }
  if (error instanceof APITimeoutError || error instanceof APIUserAbortError) return 'Jev demorou mais do que o esperado. Tente novamente.';
  if (!process.env.TYPESAFE_API_KEY?.trim()) return 'Preencha TYPESAFE_API_KEY em app/.env.local e execute o teste novamente.';
  return 'Não foi possível confirmar a conexão com Jev. Confira a conexão, o modelo e a configuração TypeSafe.';
}
