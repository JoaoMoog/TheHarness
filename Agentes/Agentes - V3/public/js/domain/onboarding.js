/** Completion is a device preference, independent from account, logout and demo resets.
 * `automatic: false` keeps it from opening by itself (the presentation starts with its own controls free). */
export function createOnboarding({ storage, key, existingAccount = false, preview = false, previewStep = null, automatic = true }) {
  let completed = false;
  try { completed = storage.getItem(key) === "done"; } catch { /* Work in memory when storage is unavailable. */ }
  let step = preview ? previewStep : completed || existingAccount || !automatic ? null : 0;
  return {
    get step() { return step; },
    open() { step = 0; },
    next() { if (step !== null) step = Math.min(3, step + 1); },
    previous() { if (step !== null) step = Math.max(0, step - 1); },
    finish() {
      step = null;
      if (!preview) try { storage.setItem(key, "done"); } catch { /* Dismiss for this session even without persistence. */ }
    },
  };
}
