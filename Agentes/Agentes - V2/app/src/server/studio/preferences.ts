import type {Actor} from '@/core/types';
import {read,insert,update} from '../store';
type Preferences={id:string;owner:string;onboarded:boolean};
export function preferences(actor:Actor):Preferences{return read<Preferences>('studio-preferences',`preferences:${actor.id}`,actor.id)||{id:`preferences:${actor.id}`,owner:actor.id,onboarded:false};}
export function completeOnboarding(actor:Actor){const value=preferences(actor);if(read('studio-preferences',value.id,actor.id))update('studio-preferences',{...value,onboarded:true});else insert('studio-preferences',{...value,onboarded:true});return {onboarded:true};}
