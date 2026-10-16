import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readWork, writeWork, type WorkSession } from '../src/ui/workSession';

const entries = new Map<string, string>();
const storage = {
  getItem: (key: string) => entries.get(key) ?? null,
  setItem: (key: string, value: string) => { entries.set(key, value); },
  removeItem: (key: string) => { entries.delete(key); },
};
Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true });
const work = (owner: string): WorkSession => ({ version: 1, owner, sourceId: 'source', sourceRevision: 1,
  prompt: 'Pergunta privada', lastPrompt: '', plan: null, assistantOpen: true });

test('retomada rejeita outra conta, versão desconhecida e dados corrompidos', () => {
  entries.set('clara:work:other', JSON.stringify(work('original')));
  assert.equal(readWork('other'), null);
  entries.set('clara:work:future', JSON.stringify({ ...work('future'), version: 2 }));
  assert.equal(readWork('future'), null);
  entries.set('clara:work:broken', '{');
  assert.equal(readWork('broken'), null);
  writeWork('other', work('original'));
  assert.equal(readWork('other'), null);
});

test('limpar trabalho remove a retomada sem afetar outra conta', () => {
  writeWork('first', work('first')); writeWork('second', work('second'));
  writeWork('first', null);
  assert.equal(readWork('first'), null);
  assert.equal(entries.has('clara:work:first'), false);
  assert.equal(readWork('second')?.prompt, 'Pergunta privada');
});

test('falha de armazenamento mantém o texto mais recente durante a navegação', () => {
  writeWork('quota', work('quota'));
  const original = storage.setItem;
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  try {
    writeWork('quota', { ...work('quota'), prompt: 'Texto mais recente' });
    assert.equal(readWork('quota')?.prompt, 'Texto mais recente');
  } finally { storage.setItem = original; writeWork('quota', null); }
});
