import {mkdirSync,writeFileSync} from 'node:fs';
import {studioOpenApi} from '../src/studio/openapi';
mkdirSync('contracts',{recursive:true});
writeFileSync('contracts/studio.openapi.json',JSON.stringify(studioOpenApi(),null,2)+'\n');
console.log('Contrato gerado: contracts/studio.openapi.json');
