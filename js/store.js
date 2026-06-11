// Domain layer: settings and raw event CRUD.
//
// Raw events are the source of truth and are stored as logged; everything
// else (episodes, daily totals, patterns) is derived at render time.

import { idb } from './db.js?v=1781201788';
import { nowLocalISO, epoch } from './time.js?v=1781201788';

export const SCHEMA_VERSION = 'kick-tracker/1.0';

export const DEFAULT_SETTINGS = Object.freeze({
  dueDate: null,
  wakingHours: { start: '07:00', end: '23:00' },
  tags: ['after_eating', 'lying_down', 'cold_drink', 'walking'],
  // Archived tags stay known to the app so historic events keep rendering.
  archivedTags: [],
  episodeGapMinutes: 10,
});

export async function getSettings() {
  const stored = await idb.get('settings', 'settings');
  return { ...structuredClone(DEFAULT_SETTINGS), ...(stored || {}) };
}

// Saves are serialised: two quick edits must not race read-modify-write,
// or the slower one overwrites the faster with stale data.
let settingsQueue = Promise.resolve();

export function saveSettings(patch) {
  const run = settingsQueue.then(async () => {
    const next = { ...(await getSettings()), ...patch };
    await idb.put('settings', next, 'settings');
    return next;
  });
  settingsQueue = run.catch(() => {});
  return run;
}

export async function addEvent({ count = 1, tags = [], t = nowLocalISO() } = {}) {
  const event = { id: crypto.randomUUID(), t, count, tags };
  await idb.put('events', event);
  return event;
}

export function getEvent(id) {
  return idb.get('events', id);
}

// History allows editing time, count and tags; the id is permanent.
export async function updateEvent(id, patch) {
  const existing = await idb.get('events', id);
  if (!existing) throw new Error('No such event: ' + id);
  const next = { ...existing };
  if (patch.t !== undefined) next.t = patch.t;
  if (patch.count !== undefined) next.count = patch.count;
  if (patch.tags !== undefined) next.tags = patch.tags;
  await idb.put('events', next);
  return next;
}

export async function deleteEvent(id) {
  await idb.delete('events', id);
}

// All events, oldest first. Sorted by absolute instant (not string order,
// which breaks across mixed UTC offsets), with id as a stable tie-break.
export async function getEvents() {
  const events = await idb.getAll('events');
  events.sort((a, b) => epoch(a.t) - epoch(b.t) || (a.id < b.id ? -1 : 1));
  return events;
}

export function countEvents() {
  return idb.count('events');
}

export async function clearAllData() {
  await idb.clear('events');
  await idb.clear('settings');
}

// Restore from an import: replaces settings and all events.
export async function replaceAll(settings, events) {
  await clearAllData();
  await idb.put('settings', settings, 'settings');
  await idb.bulkPut('events', events);
}
