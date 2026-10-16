import {useState,type Dispatch,type SetStateAction} from 'react';
import {useApp} from './state';

/** Retain unsaved input through refetch/authentication without crossing identity or workspace. */
export function useWorkspaceDraft<T>(name:string,initial:()=>T):[T,Dispatch<SetStateAction<T>>]{
 const {server,drafts}=useApp(),key=JSON.stringify([server.actor.id,server.workspace.id,name]);
 const restore=()=>drafts.has(key)?drafts.get(key) as T:initial();
 const [entry,setEntry]=useState(()=>({key,value:restore()}));
 const value=entry.key===key?entry.value:restore();
 const setValue:Dispatch<SetStateAction<T>>=update=>{
  const current=drafts.has(key)?drafts.get(key) as T:value;
  const next=typeof update==='function'?(update as (previous:T)=>T)(current):update;
  drafts.set(key,next);setEntry({key,value:next});
 };
 return [value,setValue];
}
