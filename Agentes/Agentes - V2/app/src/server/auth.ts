import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { Actor } from '@/core/types';
import { db } from './store';
import { BRAND } from '@/core/brand';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const demoEnabled = () => process.env.AUTH_MODE !== 'msal';
export function requireActor(req: NextRequest): Actor {
  const raw = req.cookies.get('prometeu-session')?.value;
  if (!raw) throw new HttpError(401, 'Entre para continuar.');
  const hash = createHash('sha256').update(raw).digest('hex');
  const session = db().prepare('SELECT actor FROM sessions WHERE token=? AND expires>?').get(hash, Date.now());
  if (!session) throw new HttpError(401, 'Sua sessão terminou. Entre novamente.');
  return JSON.parse(String(session.actor));
}
export function session(actor: Actor) {
  const token = randomBytes(32).toString('hex');
  db().prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db().prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'), JSON.stringify(actor), Date.now() + 8 * 3600000);
  return token;
}
export function revoke(req: NextRequest) {
  const token = req.cookies.get('prometeu-session')?.value;
  if (token) db().prepare('DELETE FROM sessions WHERE token=?').run(createHash('sha256').update(token).digest('hex'));
}
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const expected = process.env.PUBLIC_APP_URL ? new URL(process.env.PUBLIC_APP_URL).origin
    : new URL(`${req.nextUrl.protocol}//${req.headers.get('host') || req.nextUrl.host}`).origin;
  if (origin !== expected) throw new HttpError(403, 'Não foi possível confirmar a origem da solicitação. Reabra o aplicativo e tente novamente.');
}
export async function microsoftActor(accessToken: string): Promise<Actor> {
  const tenant = process.env.MSAL_TENANT_ID;
  const audience = process.env.MSAL_API_CLIENT_ID;
  const scope = process.env.MSAL_API_SCOPE || 'access_as_user';
  if (!tenant || !audience || !/^[\da-f-]{36}$/i.test(tenant)) throw new HttpError(503, 'O acesso Microsoft ainda não foi configurado.');
  const keys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`));
  let payload;
  try { ({ payload } = await jwtVerify(accessToken, keys, { issuer: `https://login.microsoftonline.com/${tenant}/v2.0`, audience })); }
  catch { throw new HttpError(401, 'O acesso Microsoft não pôde ser validado. Entre novamente.'); }
  if (!payload.sub || payload.tid !== tenant || !String(payload.scp || '').split(' ').includes(scope)) throw new HttpError(403, `Sua conta não tem permissão para acessar a ${BRAND.name}.`);
  return { id: createHash('sha256').update(`${tenant}:${payload.oid || payload.sub}`).digest('hex'), name: String(payload.name || 'Usuário Microsoft'), demo: false, auth: 'msal' };
}
