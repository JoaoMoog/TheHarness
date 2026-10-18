import {z} from 'zod';
export function modelConfig(env:Record<string,string|undefined>=process.env){
 const maxTokens=z.coerce.number().int().min(256).max(16000).parse(env.BEDROCK_MAX_TOKENS||'2000');
 const timeoutMs=z.coerce.number().int().min(5000).max(120000).parse(env.BEDROCK_TIMEOUT_MS||'60000');
 const temperature=env.BEDROCK_TEMPERATURE?z.coerce.number().min(0).max(1).parse(env.BEDROCK_TEMPERATURE):undefined;
 const additional=env.BEDROCK_ADDITIONAL_FIELDS?z.record(z.string(),z.json()).parse(JSON.parse(env.BEDROCK_ADDITIONAL_FIELDS)):undefined;
 return {maxTokens,timeoutMs,inferenceConfig:{maxTokens,...temperature!==undefined?{temperature}:{}},additional};
}
