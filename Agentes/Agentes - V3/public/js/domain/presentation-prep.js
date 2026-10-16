// How the presentation gets the demo to the start of a scenario. A track is the order the scenarios are told in (the
// executive pitch or the full demo); the scenarios before the chosen one run fast behind a cover. Pure functions.

/**
 * What to do before playing `index`: restart the demo or not, and which scenarios of the track to run first.
 * `ready` is the scenario the demo was left ready for and the restart count at that moment; a restart since then,
 * another track or a later scenario make it useless, and the demo starts over.
 */
export function prepPlan({ track, index, ready, resets }) {
  const pos = Math.max(0, track.indexOf(index));
  const at = ready && ready.resets === resets ? track.indexOf(ready.index) : -1;
  if (at >= 0 && at <= pos) return { reset: false, run: track.slice(at, pos) };
  return { reset: true, run: track.slice(0, pos) };
}

/** The order a scenario is told in: the list being played, else the track that holds it, else the scenario alone. */
export function trackOf(tracks, index, list) {
  if (list?.includes(index)) return list;
  return Object.values(tracks).find((t) => t.includes(index)) ?? [index];
}
