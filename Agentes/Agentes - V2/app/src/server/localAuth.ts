import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { db } from './store';
import { HttpError } from './auth';
import type { Actor } from '@/core/types';

const derive = promisify(scrypt);
const inputSchema = z.object({ email: z.string().trim().email().max(200).transform(s => s.toLowerCase()), password: z.string().min(10).max(128), name: z.string().trim().min(2).max(80).optional() }).strict();
const attempts = new Map<string, number[]>();
const windowMs = 15 * 60000;
export const localEnabled = () => process.env.AUTH_MODE !== 'msal' && process.env.LOCAL_AUTH_ENABLED !== 'false';

export async function localActor(body: unknown, register = false): Promise<Actor> {
  if (!localEnabled()) throw new HttpError(403, 'Use o acesso Microsoft configurado pela organização.');
  const input = inputSchema.parse(body);
  for (const [key, values] of attempts) if (!values.some(t => t > Date.now() - windowMs)) attempts.delete(key);
  const recent = (attempts.get(input.email) || []).filter(t => t > Date.now() - windowMs);
  if (recent.length >= 10 || attempts.size >= 1000) throw new HttpError(429, 'Aguarde quinze minutos antes de tentar entrar novamente.');
  attempts.set(input.email, [...recent, Date.now()]);
  db().exec('CREATE TABLE IF NOT EXISTS local_accounts (email TEXT PRIMARY KEY, actor TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL)');
  const existing = db().prepare('SELECT * FROM local_accounts WHERE email=?').get(input.email);
  if (register) {
    if (!input.name) throw new HttpError(400, 'Informe seu nome para criar a conta.');
    if (existing) throw new HttpError(409, 'Esse e-mail já possui uma conta. Use Entrar com conta local.');
    const salt = randomBytes(32).toString('hex');
    const hash = await derive(input.password, salt, 64) as Buffer;
    const actor: Actor = { id: crypto.randomUUID(), name: input.name, demo: false, auth: 'local', email: input.email };
    try { db().prepare('INSERT INTO local_accounts VALUES(?,?,?,?)').run(input.email, JSON.stringify(actor), salt, hash.toString('hex')); }
    catch { throw new HttpError(409, 'Esse e-mail já possui uma conta. Entre para continuar.'); }
    attempts.delete(input.email);
    return actor;
  }
  // Derive even for unknown accounts to avoid disclosing whether an e-mail is registered.
  const hash = await derive(input.password, String(existing?.salt || 'clara-unknown-account'), 64) as Buffer;
  if (!existing || !timingSafeEqual(hash, Buffer.from(String(existing.hash), 'hex'))) throw new HttpError(401, 'E-mail ou senha incorretos. Confira os dados e tente novamente.');
  attempts.delete(input.email);
  return JSON.parse(String(existing.actor));
}
