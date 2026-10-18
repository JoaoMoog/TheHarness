import {writeFileSync} from 'node:fs';
import {sapOpenApi} from '../src/sap/openapi';
writeFileSync('../docs/SAP-OPENAPI.json',JSON.stringify(sapOpenApi,null,2)+'\n');
console.log('Contrato salvo em docs/SAP-OPENAPI.json');
