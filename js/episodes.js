// Episodes: the core derived concept. Events whose timestamps fall within
// episodeGapMinutes of each other cluster into a single episode of activity.
// Pattern analysis runs on episodes, not raw taps, because raw counts measure
// movement × attention; "was the baby active in this window" is far more
// robust to how attentive the user was.

import { epoch } from './time.js?v=1781256394';

// events must be sorted ascending (store.getEvents() guarantees this).
// Returns [{ start, end, events }] with start/end as the recorded timestamps.
export function clusterEpisodes(events, gapMinutes) {
  const gapMs = gapMinutes * 60000;
  const episodes = [];
  let current = null;
  let lastMs = 0;
  for (const e of events) {
    const t = epoch(e.t);
    if (current && t - lastMs <= gapMs) {
      current.events.push(e);
      current.end = e.t;
    } else {
      current = { start: e.t, end: e.t, events: [e] };
      episodes.push(current);
    }
    lastMs = t;
  }
  return episodes;
}
