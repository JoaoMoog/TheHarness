import { checkJevConnection, jevErrorMessage } from '../src/server/jev';

async function main() {
  try {
    const response = await checkJevConnection();
    console.log('Jev conectado: chamada real à API concluída.');
    console.log(JSON.stringify({
      model: response.model,
      urgencyProbability: response.answers.urgent.noul,
      usage: response.usage,
    }, null, 2));
  } catch (error) {
    console.error(jevErrorMessage(error));
    process.exitCode = 1;
  }
}

void main();
