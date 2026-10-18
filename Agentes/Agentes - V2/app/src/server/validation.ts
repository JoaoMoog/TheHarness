import type { z } from 'zod';

const labels: Record<string, string> = {
  name: 'Nome', title: 'Título', chartTitle: 'Título do gráfico', email: 'E-mail',
  password: 'Senha', search: 'Busca', prompt: 'Mensagem', text: 'Comentário',
  code: 'Código do convite', reason: 'Justificativa', amount: 'Quantidade',
  limit: 'Limite de grupos', dateFrom: 'Data inicial', dateTo: 'Data final',
};

/** Return a useful message without echoing submitted data or internal field paths. */
export function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Confira os campos preenchidos.';
  const label = labels[String(issue.path.at(-1))] || 'Campo';
  if (issue.code === 'too_big' && issue.origin === 'string') return `${label}: use no máximo ${issue.maximum} caracteres.`;
  if (issue.code === 'too_small' && issue.origin === 'string') return Number(issue.minimum) === 1 ? `${label}: preencha este campo.` : `${label}: use pelo menos ${issue.minimum} caracteres.`;
  if (issue.code === 'too_big' && issue.origin === 'number') return `${label}: o valor máximo é ${issue.maximum}.`;
  if (issue.code === 'too_small' && issue.origin === 'number') return `${label}: o valor mínimo é ${issue.minimum}.`;
  if (issue.code === 'invalid_format' && issue.format === 'email') return 'Informe um e-mail válido.';
  if (issue.code === 'invalid_type' && issue.expected === 'int') return `${label}: informe um número inteiro.`;
  return `${label}: confira o valor informado.`;
}
