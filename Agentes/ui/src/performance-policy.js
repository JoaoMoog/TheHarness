// Admission limits protect the UI, not the agent's conversation or unsaved work.
export const PERFORMANCE = Object.freeze({
  maxTabs: 24,
  bufferBytes: 32 * 1024 * 1024,
  syntaxChars: 512 * 1024,
  diffChars: 512 * 1024,
  expandedDirectories: 16,
  cachedTreeRows: 8000,
  pendingRequests: 32,
  requestBytes: 8 * 1024 * 1024,
  terminalScrollback: 2000,
});
export function bufferWeight(buffer) {
  return buffer.model
    ? buffer.model.getValueLength() * 2 + (buffer.saved?.length || 0) * 2
    : (buffer.dataUrl?.length || 0) * 2;
}
export function admitBuffer(buffers, extraBytes, replacingKey = null) {
  const retained = [...buffers].filter(([key]) => key !== replacingKey);
  return (
    retained.length < PERFORMANCE.maxTabs &&
    retained.reduce((n, [, buffer]) => n + bufferWeight(buffer), 0) +
      extraBytes <=
      PERFORMANCE.bufferBytes
  );
}
export function dirtySince(model, savedVersion) {
  return model.getAlternativeVersionId() !== savedVersion;
}
// No interval backlog; stop timers while hidden. A focus refresh can be coalesced
// with running work without spawning parallel disk/Git operations.
export function refreshLoop({
  run,
  hidden,
  active = () => false,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onError = () => {},
}) {
  let timer,
    running = false,
    stopped = false,
    forceQueued = false,
    touched = now(),
    lastForce = -Infinity;
  const delay = () => (active() || now() - touched < 60000 ? 10000 : 30000);
  function schedule() {
    clearTimer(timer);
    if (!stopped && !hidden()) timer = setTimer(() => execute(false), delay());
  }
  async function execute(force) {
    clearTimer(timer);
    if (stopped || hidden()) return;
    if (running) {
      forceQueued ||= force;
      return;
    }
    if (force && now() - lastForce < 2000) {
      schedule();
      return;
    }
    if (force) lastForce = now();
    running = true;
    try {
      await run(force);
    } catch (e) {
      onError(e);
    } finally {
      running = false;
      if (forceQueued && !hidden() && !stopped) {
        forceQueued = false;
        void execute(true);
      } else {
        forceQueued = false;
        schedule();
      }
    }
  }
  schedule();
  return {
    touch() {
      touched = now();
    },
    refresh: () => execute(true),
    visibility() {
      if (hidden()) clearTimer(timer);
      else return execute(true);
    },
    stop() {
      stopped = true;
      clearTimer(timer);
    },
  };
}
