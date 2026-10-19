import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseEnv} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadSettings, pilotSettings} from '../scripts/pilot-env.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'clara-env-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  writeFileSync(join(root, '.env.local'), 'AUTH_MODE=demo\nAWS_REGION=local-region\n');
  writeFileSync(join(root, '.env.dev'), 'PORT=3101\nAUTH_MODE=local\n');
  writeFileSync(join(root, '.env.uat'), 'AUTH_MODE=msal\nAWS_REGION=uat-region\n');
  return root;
}

test('Ambiente selecionado fica isolado do local e respeita variáveis do processo', t => {
  const root = fixture(t);
  const env = loadSettings(root, '.env.local', {CLARA_ENV_FILE: '.env.uat', AWS_REGION: 'process-region'});
  assert.equal(env.AUTH_MODE, 'msal');
  assert.equal(env.AWS_REGION, 'process-region');
});

test('Arquivo explicitamente selecionado ausente causa erro, sem fallback para demo', t => {
  const root = fixture(t);
  assert.throws(() => loadSettings(root, '.env.local', {CLARA_ENV_FILE: '.env.prod'}), /\.env\.prod/);
});

test('Piloto usa dev por padrão e aceita seleção explícita', t => {
  const root = fixture(t);
  const env = pilotSettings(root, {});
  assert.equal(env.PORT, '3101');
  assert.equal(env.AUTH_MODE, 'local');
  assert.equal(env.LOCAL_AUTH_ENABLED, 'true');
  assert.equal(pilotSettings(root, {CLARA_ENV_FILE: '.env.uat'}).AUTH_MODE, 'msal');
});

test('Piloto preenche URL e mapeamento sintéticos quando o perfil tem campos vazios', t => {
  const root = fixture(t);
  writeFileSync(join(root, '.env.dev'), 'SAP_READ_URL=\nSAP_STUDIO_MAPPING=\nFINANCIAL_TEST_PORT=4020\n');
  const env = pilotSettings(root, {});
  assert.equal(env.SAP_READ_URL, 'http://127.0.0.1:4020/odata/FinancialFacts');
  assert.equal(JSON.parse(env.SAP_STUDIO_MAPPING).id, 'DocumentId');
});

test('Perfis versionados têm o mesmo inventário e armazenamento separado', () => {
  let keys;
  for (const name of ['dev', 'uat', 'prod']) {
    const env = parseEnv(readFileSync(new URL(`../.env.${name}`, import.meta.url), 'utf8'));
    const current = Object.keys(env).sort();
    if (keys) assert.deepEqual(current, keys);
    keys = current;
    assert.equal(env.PROMETEU_DATA_DIR, `.data/${name}`);
    if (name !== 'dev') {
      assert.equal(env.AUTH_MODE, 'msal');
      assert.equal(env.LOCAL_AUTH_ENABLED, 'false');
      assert.equal(env.CLARA_SECRETS_REQUIRED, 'true');
    }
  }
});

test('Iniciador encaminha perfil, argumentos e código de saída ao processo Next', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'node_modules/next/dist/bin'), {recursive: true});
  for (const name of ['next-env.mjs', 'pilot-env.mjs']) {
    copyFileSync(new URL(`../scripts/${name}`, import.meta.url), join(root, 'scripts', name));
  }
  writeFileSync(join(root, 'node_modules/next/dist/bin/next'),
    'console.log(JSON.stringify({args:process.argv.slice(2),auth:process.env.AUTH_MODE,region:process.env.AWS_REGION}));process.exitCode=7;');
  const environment = {...process.env, CLARA_ENV_FILE: '.env.uat', AWS_REGION: 'process-region'};
  delete environment.AUTH_MODE;
  const result = spawnSync(process.execPath, [join(root, 'scripts/next-env.mjs'), 'build'], {env: environment, encoding: 'utf8'});
  assert.equal(result.status, 7, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {args:['build'], auth:'msal', region:'process-region'});
});
