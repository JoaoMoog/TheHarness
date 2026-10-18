import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {parseWorkspaceInvite} from '../src/core/inputLimits';
import {validationMessage} from '../src/server/validation';
import {nameSchema,querySchema,assistantInputSchema,initialDocument,commandSchema,widgetSchema} from '../src/studio/contracts';

test('convites aceitam código ou link e rejeitam formato inválido sem lançar erro de URL',()=>{
 const code='aB_9-'.repeat(6);
 assert.equal(parseWorkspaceInvite(` ${code} `),code);
 assert.equal(parseWorkspaceInvite(`https://clara.example/shared?workspaceInvite=${code}`),code);
 for(const input of ['','abc','https://','https://example.test/','javascript:alert(1)','a'.repeat(101),'https://example.test/?workspaceInvite='+'a'.repeat(2000)]){
  assert.throws(()=>parseWorkspaceInvite(input),/convite|caracteres/);
 }
});

test('contratos rejeitam textos excessivos, nomes vazios e grupos fracionários',()=>{
 assert.equal(nameSchema.parse('n'.repeat(120)).length,120);
 assert.equal(nameSchema.safeParse('n'.repeat(121)).success,false);
 assert.equal(nameSchema.safeParse('   ').success,false);
 assert.equal(querySchema.safeParse({search:'b'.repeat(120)}).success,true);
 assert.equal(querySchema.safeParse({search:'b'.repeat(121)}).success,false);
 for(const [length,valid] of [[4000,true],[4001,false]] as const)assert.equal(assistantInputSchema.safeParse({prompt:'p'.repeat(length),document:initialDocument}).success,valid);
 for(const [length,valid] of [[2000,true],[2001,false]] as const)assert.equal(commandSchema.safeParse({type:'comment.add',boardId:'test',text:'c'.repeat(length)}).success,valid);
 const widget={id:'test',title:'Gráfico',kind:'bar',dimension:'center',metric:'actual'};
 for(const limit of [0,1.5,201])assert.equal(widgetSchema.safeParse({...widget,limit}).success,false);
 for(const limit of [1,200])assert.equal(widgetSchema.safeParse({...widget,limit}).success,true);
});

test('erros indicam o campo e o limite sem revelar os valores enviados',()=>{
 const cases:[z.ZodType,unknown,string][]=[
  [z.object({title:nameSchema}),{title:'x'.repeat(121)},'Título: use no máximo 120 caracteres.'],
  [z.object({title:nameSchema}),{title:' '},'Título: preencha este campo.'],
  [z.object({password:z.string().min(10)}),{password:'secret'},'Senha: use pelo menos 10 caracteres.'],
  [z.object({email:z.string().email()}),{email:'invalid'},'Informe um e-mail válido.'],
  [z.object({amount:z.number().int()}),{amount:1.2},'Quantidade: informe um número inteiro.'],
 ];
 for(const [schema,input,message] of cases){const result=schema.safeParse(input);assert.equal(result.success,false);if(!result.success)assert.equal(validationMessage(result.error),message);}
});
