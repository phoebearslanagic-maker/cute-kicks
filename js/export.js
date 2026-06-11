// Export and import. The JSON export is self-describing: analysisNotes
// travels with the data so a future analysis session can orient itself
// without explanation.

import {
  SCHEMA_VERSION, DEFAULT_SETTINGS, getSettings, getEvents, replaceAll,
} from './store.js';
import { nowLocalISO, isValidISO, todayLocalDate } from './time.js';

export const APP_VERSION = '0.1.0';

const ANALYSIS_NOTES =
  "Raw fetal movement logs from a single user. Each event is a tap (count=1) " +
  "or a held 'flurry' (count=N) at the recorded local time; tags are optional " +
  "user context. Data is attention-filtered: gaps may mean the user was busy " +
  "or asleep, not that the baby was still. wakingHours bounds the user's " +
  "typical day. Analyse patterns on 'episodes' (events clustered within " +
  "episodeGapMinutes) for robustness, and treat daily raw counts with " +
  "caution. dueDate allows mapping events to gestational weeks.";

export async function buildExport() {
  const [settings, events] = await Promise.all([getSettings(), getEvents()]);
  return {
    schemaVersion: SCHEMA_VERSION,
    exported: nowLocalISO(),
    appVersion: APP_VERSION,
    analysisNotes: ANALYSIS_NOTES,
    settings,
    events,
  };
}

function csvField(s) {
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export async function buildCSV() {
  const events = await getEvents();
  const lines = ['timestamp,count,tags'];
  for (const e of events) {
    lines.push([e.t, e.count, csvField((e.tags || []).join(';'))].join(','));
  }
  return lines.join('\n') + '\n';
}

// Share via the share sheet where files are supported; otherwise download.
async function shareOrDownload(filename, type, text) {
  const file = new File([text], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export async function exportJSON() {
  const text = JSON.stringify(await buildExport(), null, 2);
  return shareOrDownload('cute-kicks-' + todayLocalDate() + '.json', 'application/json', text);
}

export async function exportCSV() {
  return shareOrDownload('cute-kicks-' + todayLocalDate() + '.csv', 'text/csv', await buildCSV());
}

// Validate an export payload without writing anything. Throws with a
// readable message; returns clean { settings, events } on success.
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON.');
  }
  if (typeof data !== 'object' || data === null) throw new Error('Not a Kick export.');
  if (typeof data.schemaVersion !== 'string' || !data.schemaVersion.startsWith('kick-tracker/')) {
    throw new Error('Not a Kick export (missing schemaVersion).');
  }
  if (!Array.isArray(data.events)) throw new Error('Export has no events array.');

  const events = data.events.map((e, i) => {
    const label = 'Event ' + (i + 1);
    if (!e || typeof e.id !== 'string' || !e.id) throw new Error(label + ': missing id.');
    if (!isValidISO(e.t)) throw new Error(label + ': bad timestamp.');
    if (!Number.isInteger(e.count) || e.count < 1) throw new Error(label + ': bad count.');
    const tags = e.tags === undefined ? [] : e.tags;
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
      throw new Error(label + ': bad tags.');
    }
    return { id: e.id, t: e.t, count: e.count, tags };
  });
  if (new Set(events.map((e) => e.id)).size !== events.length) {
    throw new Error('Duplicate event ids in export.');
  }

  const s = data.settings || {};
  const settings = structuredClone(DEFAULT_SETTINGS);
  if (typeof s.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.dueDate)) {
    settings.dueDate = s.dueDate;
  }
  if (s.wakingHours && typeof s.wakingHours.start === 'string' && typeof s.wakingHours.end === 'string') {
    settings.wakingHours = { start: s.wakingHours.start, end: s.wakingHours.end };
  }
  if (Array.isArray(s.tags) && s.tags.every((t) => typeof t === 'string')) {
    settings.tags = s.tags;
  }
  if (Array.isArray(s.archivedTags) && s.archivedTags.every((t) => typeof t === 'string')) {
    settings.archivedTags = s.archivedTags;
  }
  if (Number.isInteger(s.episodeGapMinutes) && s.episodeGapMinutes >= 1 && s.episodeGapMinutes <= 120) {
    settings.episodeGapMinutes = s.episodeGapMinutes;
  }
  return { settings, events };
}

// Restore: validates, then replaces all stored data.
export async function importData(text) {
  const { settings, events } = parseImport(text);
  await replaceAll(settings, events);
  return { events: events.length };
}
