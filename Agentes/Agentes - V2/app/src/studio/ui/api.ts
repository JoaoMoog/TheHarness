export class StudioError extends Error{constructor(public status:number,message:string,public requestId?:string){super(message)}}
export async function request<T>(path:string,body?:unknown,workspace?:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(`/api/v1/studio/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(workspace?{'x-clara-workspace':workspace}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',signal});
 const value=await response.json();if(!response.ok)throw new StudioError(response.status,value.error?.message||'Não foi possível concluir a operação.',value.error?.requestId);return value;
}
