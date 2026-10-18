import type {Actor} from '@/core/types';
import {HttpError} from './auth';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only directory claims from the server-verified access token can grant platform access. */
export function platformAccess(actor:Actor,now=Date.now()){
 const groups=(process.env.CLARA_PLATFORM_ADMIN_GROUP_IDS||'').split(',').map(v=>v.trim().toLowerCase()).filter(v=>uuid.test(v));
 const directory=actor.directory;
 const allowed=actor.auth==='msal'&&!actor.demo&&!!directory&&!directory.overage&&directory.expiresAt>now&&directory.tenantId.toLowerCase()===(process.env.MSAL_TENANT_ID||'').toLowerCase()&&directory.groups.some(id=>groups.includes(id.toLowerCase()));
 return {manageCredits:allowed,viewUsage:allowed};
}
export function requirePlatformAdmin(actor:Actor){if(!platformAccess(actor).manageCredits)throw new HttpError(403,'Acesso restrito ao grupo de administradores da plataforma no Microsoft Entra ID. Se sua participação mudou, entre novamente.');}

/** Called only after signature, issuer, audience, tenant and delegated scope validation. */
export function directoryClaims(payload:Record<string,unknown>){
 const overage=payload.hasgroups===true||!!(payload._claim_names as Record<string,unknown>|undefined)?.groups;
 return {tenantId:String(payload.tid||''),objectId:String(payload.oid||payload.sub||''),groups:!overage&&Array.isArray(payload.groups)?payload.groups.filter((v):v is string=>typeof v==='string'&&uuid.test(v)):[],expiresAt:typeof payload.exp==='number'?payload.exp*1000:0,overage};
}
