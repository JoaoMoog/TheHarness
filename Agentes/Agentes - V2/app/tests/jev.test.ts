import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkJevConnection, jevErrorMessage } from '../src/server/jev';

const originalKey = process.env.TYPESAFE_API_KEY;
const originalModel = process.env.TYPESAFE_DEFAULT_MODEL;
beforeEach(() => {
  process.env.TYPESAFE_API_KEY = 'test-key-never-real';
  delete process.env.TYPESAFE_DEFAULT_MODEL;
});
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.TYPESAFE_DEFAULT_MODEL;
  else process.env.TYPESAFE_DEFAULT_MODEL = originalModel;
});

test('Jev sem chave não faz chamadas e orienta a configuração', async () => {
  process.env.TYPESAFE_API_KEY = '   ';
  const transport = mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected network'); });
  await assert.rejects(checkJevConnection(), /TYPESAFE_API_KEY.*app\/\.env.local/);
  assert.equal(transport.mock.callCount(), 0);
});

test('teste Jev autentica no servidor e envia somente o exemplo fixo', async () => {
  process.env.TYPESAFE_DEFAULT_MODEL = 'jev-test-model';
  const transport = mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), 'https://api.typesafe.ai/v1/systemone');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key-never-real');
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.model, 'jev-test-model');
    assert.deepEqual(Object.keys(payload.state), ['message']);
    assert.equal(payload.questions.urgent.type, 'noul');
    return Response.json({ model: 'jev-test-model', answers: { urgent: { type: 'noul', noul: 0.98 } }, usage: { input_tokens: 30, output_tokens: 5 } });
  });
  const response = await checkJevConnection();
  assert.equal(response.model, 'jev-test-model');
  assert.equal(response.answers.urgent.noul, 0.98);
  assert.equal(transport.mock.callCount(), 1);
});

test('chave recusada não cai em demonstração nem expõe o corpo do erro', async () => {
  const transport = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'private sentinel test-key-never-real' }, { status: 401 }));
  await assert.rejects(checkJevConnection(), error => {
    const message = jevErrorMessage(error);
    assert.match(message, /Chave TypeSafe inválida/);
    assert.doesNotMatch(message, /sentinel|test-key-never-real/);
    return true;
  });
  assert.equal(transport.mock.callCount(), 1);
});

test('resposta HTTP bem sucedida mas inválida não confirma conexão', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ model: 'jev-test', answers: { urgent: { type: 'noul', noul: 2 } }, usage: { input_tokens: 30, output_tokens: 5 } }));
  await assert.rejects(checkJevConnection(), /resposta inválida/);
});
