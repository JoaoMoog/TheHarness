import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flushWork, forgetWork, hasUnsavedWork, loadDurableWork, queueWork } from '../src/ui/durableWork';
import { readWork, writeWork, type WorkSession } from '../src/ui/workSession';

const work = (owner: string, prompt: string): WorkSession => ({ version: 1, owner, sourceId: 'source', sourceRevision: 1, prompt, lastPrompt: '', plan: null, assistantOpen: true });

test('primeira leitura sem rede mantém rascunho e tenta salvar novamente com a revisão do servidor', async () => {
  const owner = 'offline-first'; const original = globalThis.fetch;
  let online = false; let writes = 0;
  globalThis.fetch = async (_url, options) => {
    if (!online) throw new TypeError('Sem conexão');
    if (options?.method === 'POST') {
      const input = JSON.parse(String(options.body));
      assert.equal(input.revision, 7); assert.equal(input.state.prompt, 'Texto novo'); writes++;
      return Response.json({ revision: 8, state: input.state });
    }
    return Response.json({ revision: 7, state: null });
  };
  try {
    writeWork(owner, work(owner, 'Texto anterior'));
    await assert.rejects(loadDurableWork(owner, owner, () => {}));
    queueWork(owner, work(owner, 'Texto novo'));
    assert.equal(await flushWork(owner), false);
    assert.equal(readWork(owner)?.prompt, 'Texto novo'); assert.equal(hasUnsavedWork(owner), true);
    online = true;
    assert.equal(await flushWork(owner), true); assert.equal(writes, 1); assert.equal(hasUnsavedWork(owner), false);
  } finally { await forgetWork(owner); globalThis.fetch = original; }
});

test('recuperação da conexão não sobrescreve outro rascunho desconhecido da conta', async () => {
  const owner = 'offline-conflict'; const original = globalThis.fetch;
  let online = false; let writes = 0; const notices: string[] = [];
  globalThis.fetch = async (_url, options) => {
    if (!online) throw new TypeError('Sem conexão');
    if (options?.method === 'POST') { writes++; throw new Error('Não deveria gravar'); }
    return Response.json({ revision: 4, state: work(owner, 'Texto de outra aba') });
  };
  try {
    await assert.rejects(loadDurableWork(owner, owner, message => notices.push(message)));
    queueWork(owner, work(owner, 'Texto desta aba')); online = true;
    assert.equal(await flushWork(owner), false); assert.equal(writes, 0);
    assert.equal(readWork(owner)?.prompt, 'Texto desta aba'); assert.equal(hasUnsavedWork(owner), true);
    assert.match(notices.at(-1)!, /outro rascunho salvo/);
  } finally { await forgetWork(owner); globalThis.fetch = original; }
});
