import { VALIDATION } from "./runtime.js";
import { credentialStorage } from "./mock-context.js";

const KEY = VALIDATION ? "aval-validation-auth-v1" : "aval-local-auth-v1";
const ITERATIONS = 210000;
let unlocked = false;
const encode = (bytes) => Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");
const decode = (hex) => new Uint8Array(hex.match(/../g).map((v) => parseInt(v, 16)));
export const hasLocalAccount = () => Boolean(credentialStorage.getItem(KEY));
export const locallyUnlocked = () => unlocked;
export const lockLocalAccount = () => { unlocked = false; };

async function derive(pin, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return encode(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256)));
}
export async function registerLocalAccount(pin) {
  if (hasLocalAccount()) throw new Error("Já existe uma conta neste aparelho. Entre com seu código.");
  if (!/^\d{6}$/.test(pin)) throw new Error("Use um código de acesso com 6 números.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt);
  credentialStorage.setItem(KEY, JSON.stringify({ salt: encode(salt), hash, iterations: ITERATIONS, failed: 0, retryAt: 0 }));
  unlocked = true;
}
export async function unlockLocalAccount(pin) {
  const raw = credentialStorage.getItem(KEY);
  if (!raw) throw new Error("Crie sua conta local para continuar.");
  const credential = JSON.parse(raw);
  if (credential.retryAt > Date.now()) throw new Error("Muitas tentativas. Aguarde 30 segundos e tente novamente.");
  const hash = await derive(pin, decode(credential.salt));
  let diff = hash.length ^ credential.hash.length;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ credential.hash.charCodeAt(i);
  if (diff) {
    credential.failed = (credential.failed ?? 0) + 1;
    if (credential.failed >= 5) { credential.retryAt = Date.now() + 30000; credential.failed = 0; }
    credentialStorage.setItem(KEY, JSON.stringify(credential));
    throw new Error("Código incorreto. Confira os 6 números e tente novamente.");
  }
  credential.failed = 0; credential.retryAt = 0;
  credentialStorage.setItem(KEY, JSON.stringify(credential));
  unlocked = true;
}
