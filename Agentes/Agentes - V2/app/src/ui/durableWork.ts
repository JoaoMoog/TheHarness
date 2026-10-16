import { api, ApiError } from './api';
import { readWork, writeWork, type WorkSession } from './workSession';
import type { Draft } from '@/core/types';

type RemoteWork = { state: WorkSession | null; revision: number; updatedAt: string };
type State = { revision: number; value: WorkSession | null; saved: string; chain: Promise<void>; timer?: ReturnType<typeof setTimeout>; conflict: boolean; notify: (message: string) => void; workspace: string };
const states = new Map<string, State>();

export async function loadDurableWork(owner: string, workspace: string, notify: (message: string) => void) {
  const existing = states.get(owner);
  if (existing && existing.revision >= 0) { existing.notify = notify; return readWork(owner); }
  const local = readWork(owner);
  let remote: RemoteWork;
  try { remote = await api<RemoteWork>('work', { workspace }); }
  catch (error) {
    // Keep a retryable state even when the first account read fails.
    states.set(owner, { revision: -1, value: local, saved: '', chain: Promise.resolve(), conflict: false, notify, workspace });
    throw error;
  }
  const remoteState = remote.state?.owner === owner ? remote.state : null;
  const value = remoteState || local;
  writeWork(owner, value);
  states.set(owner, { revision: remote.revision, value, saved: JSON.stringify(remoteState), chain: Promise.resolve(), conflict: false, notify, workspace });
  if (!remoteState && local) queueWork(owner, value);
  return value;
}
export function queueWork(owner: string, value: WorkSession | null) {
  writeWork(owner, value);
  const state = states.get(owner);
  if (!state) return;
  state.value = value;
  clearTimeout(state.timer);
  if (JSON.stringify(value) === state.saved) return;
  state.notify('Salvando rascunho…');
  state.timer = setTimeout(() => { void flushWork(owner); }, 350);
}
export async function flushWork(owner: string): Promise<boolean | undefined> {
  const state = states.get(owner);
  if (!state) return;
  clearTimeout(state.timer);
  let success = true;
  state.chain = state.chain.then(async () => {
    const serialized = JSON.stringify(state.value);
    if (state.revision < 0) {
      const remote = await api<RemoteWork>('work', { workspace: state.workspace });
      if (remote.state && JSON.stringify(remote.state) !== serialized) throw new ApiError(409, 'Há outro rascunho salvo na conta. Preserve seu texto e recarregue para conferir antes de substituir.');
      state.revision = remote.revision; state.saved = JSON.stringify(remote.state);
    }
    if (serialized === state.saved) { state.notify('Rascunho salvo na sua conta.'); return; }
    if (state.conflict) throw new ApiError(409, 'Outra aba alterou o rascunho. Recarregue para conferir a versão salva.');
    const result = await api<RemoteWork>('work', { workspace: state.workspace, body: { revision: state.revision, state: state.value } });
    state.revision = result.revision; state.saved = serialized;
    state.notify('Rascunho salvo na sua conta.');
  }).catch(error => {
    success = false;
    if (error instanceof ApiError && error.status === 409) state.conflict = true;
    state.notify(error instanceof Error ? error.message : 'Não foi possível salvar o rascunho na conta. Seus ajustes continuam nesta aba.');
  });
  await state.chain;
  return success;
}
export async function forgetWork(owner: string) {
  const state = states.get(owner);
  if (state) { await flushWork(owner); clearTimeout(state.timer); states.delete(owner); }
  writeWork(owner, null);
}
export function hasUnsavedWork(owner: string) {
  const state = states.get(owner);
  return !!state && JSON.stringify(state.value) !== state.saved;
}
export async function recoverDurableWork(owner: string, draftId: string) {
  if (await flushWork(owner) === false) throw new Error('Salve o rascunho na conta antes de recuperar. Seus ajustes continuam nesta aba.');
  const state = states.get(owner);
  if (!state) throw new Error('Recarregue para recuperar o rascunho salvo na conta.');
  const result = await api<{ draft: Draft; work: RemoteWork }>('work/resume', { workspace: state.workspace, body: { revision: state.revision, draftId } });
  state.revision = result.work.revision; state.value = result.work.state; state.saved = JSON.stringify(result.work.state);
  writeWork(owner, result.work.state);
  return result.draft;
}
