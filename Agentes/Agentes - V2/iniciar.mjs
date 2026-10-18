import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const app = join(directory, 'app');
const options = process.argv.slice(2);
const valid = options.every(option => ['--preparar', '--producao'].includes(option) || /^--porta=\d+$/.test(option));
const portOption = options.find(option => option.startsWith('--porta='));
const port = Number(portOption ? portOption.slice(8) : process.env.PORT || 3000);

function stop(message) { console.error(`\n${message}`); process.exit(1); }
if (!valid || (options.includes('--preparar') && options.includes('--producao'))) {
  stop('Use: node iniciar.mjs [--preparar | --producao] [--porta=3000]');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) stop('Escolha uma porta entre 1 e 65535.');
if (Number(process.versions.node.split('.')[0]) !== 24) {
  stop(`Node ${process.versions.node} encontrado. Instale Node.js 24 LTS em https://nodejs.org e abra novamente o terminal.`);
}
if (!existsSync(join(app, 'package-lock.json'))) stop('Não encontrei app/package-lock.json. Extraia o ZIP inteiro antes de iniciar.');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function runNpm(args) {
  // Windows needs cmd.exe for npm.cmd. Arguments here are fixed, never user input.
  const result = spawnSync(npm, args, {
    cwd: app, stdio: 'inherit', shell: process.platform === 'win32',
    env: { ...process.env, npm_config_cache: join(app, '.local', 'npm-cache') },
  });
  if (result.error) stop(`Não foi possível executar npm. Confira sua instalação do Node.js. ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);
}

const environment = join(app, '.env.local');
if (!existsSync(environment)) {
  copyFileSync(join(app, '.env.example'), environment);
  console.log('Configuração inicial criada: app/.env.local (modo demonstração).');
}

const fingerprint = createHash('sha256')
  .update(readFileSync(join(app, 'package.json')))
  .update(readFileSync(join(app, 'package-lock.json')))
  .update(`${process.versions.node}/${process.platform}/${process.arch}`)
  .digest('hex');
const stateDirectory = join(app, '.local');
const stateFile = join(stateDirectory, 'installation.json');
let previous;
try { previous = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* First run or stale installation marker. */ }
if (previous?.fingerprint !== fingerprint || !existsSync(join(app, 'node_modules', 'next', 'dist', 'bin', 'next'))) {
  console.log('\nInstalando as dependências fixadas no package-lock.json. A primeira execução precisa de internet.');
  runNpm(['ci', '--no-audit', '--no-fund']);
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ fingerprint }, null, 2) + '\n');
} else console.log('Dependências já preparadas.');

if (options.includes('--preparar')) {
  console.log('\nPreparação concluída. Para abrir o aplicativo, execute: node iniciar.mjs');
  process.exit(0);
}

const production = options.includes('--producao');
if (production) runNpm(['run', 'build']);
console.log(`\nCLARA local: http://localhost:${port}\nAbra esse endereço no navegador e escolha “Explorar demonstração”.\nMantenha este terminal aberto. Para encerrar, pressione Ctrl+C.\n`);
const child = spawn(process.execPath, [join(app, 'node_modules', 'next', 'dist', 'bin', 'next'), production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: app, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; child.kill(signal); });
}
child.on('error', error => stop(`Não foi possível iniciar o aplicativo: ${error.message}`));
child.on('exit', (code, signal) => {
  if (!stopping && code !== 0) console.error(`\nO servidor encerrou. Se a porta estiver ocupada, tente: node iniciar.mjs --porta=${port === 3000 ? 3001 : 3000}`);
  process.exit(stopping ? 0 : code ?? (signal ? 1 : 0));
});
