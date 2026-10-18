/** Shared by form controls and server schemas. Lengths use HTML/JS string units. */
export const inputLimits = {
  name: 80,
  title: 120,
  search: 120,
  email: 200,
  password: 128,
  prompt: 4000,
  comment: 2000,
  inviteLink: 2000,
  inviteCode: 100,
} as const;

export function parseWorkspaceInvite(value: string): string {
  const message = 'Cole um código de convite válido ou o link completo recebido.';
  if (value.length > inputLimits.inviteLink) throw new Error('O link deve ter no máximo 2.000 caracteres.');
  let code = value.trim();
  if (/^https?:\/\//i.test(code)) {
    try { code = new URL(code).searchParams.get('workspaceInvite') || ''; }
    catch { throw new Error(message); }
  }
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(code)) throw new Error(message);
  return code;
}
