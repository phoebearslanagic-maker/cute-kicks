// Settings screen: due date, rhythm (waking hours, episode gap), tags,
// backup & restore with a gentle fortnightly reminder, health check,
// delete-all, about.

import * as store from './store.js?v=1781256394';
import * as exporter from './export.js?v=1781256394';
import * as time from './time.js?v=1781256394';
import { refreshLog } from './log.js?v=1781256394';

const $ = (id) => document.getElementById(id);

const IO_MESSAGES = {
  shared: 'Backup sent to the share sheet.',
  downloaded: 'Backup downloaded.',
  cancelled: 'Cancelled — nothing was saved.',
};

// Gentle reminder when there is data but no backup in roughly a fortnight.
async function updateBackupReminder() {
  const [s, n] = await Promise.all([store.getSettings(), store.countEvents()]);
  const el = $('backup-reminder');
  if (n === 0) {
    el.hidden = true;
    return;
  }
  if (!s.lastExportAt) {
    el.textContent = 'No backup has been saved from this device yet.';
    el.hidden = false;
    return;
  }
  const days = Math.floor((Date.now() - time.epoch(s.lastExportAt)) / 86400000);
  el.textContent = `Last backup: ${days} days ago.`;
  el.hidden = days < 14;
}

async function recordExport(status) {
  if (status === 'shared' || status === 'downloaded') {
    await store.saveSettings({ lastExportAt: time.nowLocalISO() });
  }
  updateBackupReminder();
  return status;
}

// ---- Tags: add / rename / archive / restore ------------------------------

const normaliseTag = (raw) => raw.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 30);
const tagLabel = (tag) => tag.replace(/_/g, ' ');

function tagRow(tag, buttons) {
  const row = document.createElement('div');
  row.className = 'tag-row';
  const name = document.createElement('span');
  name.className = 'tag-name';
  name.textContent = tagLabel(tag);
  row.appendChild(name);
  for (const [label, onClick] of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'compact';
    b.textContent = label;
    b.addEventListener('click', onClick);
    row.appendChild(b);
  }
  return row;
}

async function renderTags() {
  const s = await store.getSettings();
  const list = $('tag-list');
  list.textContent = '';
  for (const tag of s.tags) {
    list.appendChild(tagRow(tag, [
      ['Rename', () => renameTag(tag)],
      ['Archive', () => archiveTag(tag)],
    ]));
  }
  const archived = $('archived-list');
  archived.textContent = '';
  $('archived-wrap').hidden = s.archivedTags.length === 0;
  for (const tag of s.archivedTags) {
    archived.appendChild(tagRow(tag, [['Restore', () => restoreTag(tag)]]));
  }
}

async function addTag() {
  const tag = normaliseTag($('new-tag').value);
  if (!tag) return;
  const s = await store.getSettings();
  if (s.tags.includes(tag) || s.archivedTags.includes(tag)) {
    alert('That tag already exists.');
    return;
  }
  await store.saveSettings({ tags: [...s.tags, tag] });
  $('new-tag').value = '';
  renderTags();
}

async function renameTag(oldTag) {
  const raw = prompt(`Rename "${tagLabel(oldTag)}" to:`, tagLabel(oldTag));
  if (raw === null) return;
  const newTag = normaliseTag(raw);
  if (!newTag || newTag === oldTag) return;
  const s = await store.getSettings();
  if (s.tags.includes(newTag) || s.archivedTags.includes(newTag)) {
    alert('That tag already exists.');
    return;
  }
  await store.saveSettings({ tags: s.tags.map((t) => (t === oldTag ? newTag : t)) });
  // A rename is the same tag with a better label, so history follows it.
  const events = await store.getEvents();
  for (const e of events) {
    if ((e.tags || []).includes(oldTag)) {
      await store.updateEvent(e.id, { tags: e.tags.map((t) => (t === oldTag ? newTag : t)) });
    }
  }
  renderTags();
}

async function archiveTag(tag) {
  const s = await store.getSettings();
  await store.saveSettings({
    tags: s.tags.filter((t) => t !== tag),
    archivedTags: [...s.archivedTags, tag],
  });
  renderTags();
}

async function restoreTag(tag) {
  const s = await store.getSettings();
  await store.saveSettings({
    tags: [...s.tags, tag],
    archivedTags: s.archivedTags.filter((t) => t !== tag),
  });
  renderTags();
}

// Called when the Settings tab is opened.
export function refreshSettings() {
  renderTags();
  updateBackupReminder();
}

export function initSettings() {
  store.getSettings().then((s) => {
    if (s.dueDate) $('set-duedate').value = s.dueDate;
    $('set-wake-start').value = s.wakingHours.start;
    $('set-wake-end').value = s.wakingHours.end;
    $('set-gap').value = s.episodeGapMinutes;
  });

  const saveWaking = async () => {
    const start = $('set-wake-start').value;
    const end = $('set-wake-end').value;
    if (!start || !end) return;
    await store.saveSettings({ wakingHours: { start, end } });
  };
  $('set-wake-start').addEventListener('change', saveWaking);
  $('set-wake-end').addEventListener('change', saveWaking);

  $('set-gap').addEventListener('change', async () => {
    const gap = parseInt($('set-gap').value, 10);
    if (!Number.isInteger(gap) || gap < 2 || gap > 120) {
      $('set-gap').value = (await store.getSettings()).episodeGapMinutes;
      return;
    }
    await store.saveSettings({ episodeGapMinutes: gap });
    refreshLog();
  });

  $('set-duedate').addEventListener('change', async () => {
    const v = $('set-duedate').value;
    await store.saveSettings({ dueDate: v || null });
    $('duedate-saved').textContent = v ? 'Saved.' : 'Cleared.';
    setTimeout(() => { $('duedate-saved').textContent = ''; }, 3000);
    refreshLog();
  });

  $('export-json').addEventListener('click', async () => {
    try {
      $('io-out').textContent = IO_MESSAGES[await recordExport(await exporter.exportJSON())];
    } catch (err) {
      $('io-out').textContent = 'Backup failed: ' + err.message;
    }
  });

  $('export-csv').addEventListener('click', async () => {
    try {
      $('io-out').textContent = IO_MESSAGES[await recordExport(await exporter.exportCSV())];
    } catch (err) {
      $('io-out').textContent = 'Backup failed: ' + err.message;
    }
  });

  $('add-tag').addEventListener('click', addTag);
  $('new-tag').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTag();
  });

  $('import-btn').addEventListener('click', () => $('import-file').click());

  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files[0];
    $('import-file').value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const { events } = exporter.parseImport(text);
      if (!confirm(`Replace everything on this device with the backup's ${events.length} entries?`)) {
        $('io-out').textContent = 'Restore cancelled — nothing was changed.';
        return;
      }
      const result = await exporter.importData(text);
      $('io-out').textContent = `Restored ${result.events} entries from the backup.`;
      const s = await store.getSettings();
      $('set-duedate').value = s.dueDate || '';
      $('set-wake-start').value = s.wakingHours.start;
      $('set-wake-end').value = s.wakingHours.end;
      $('set-gap').value = s.episodeGapMinutes;
    } catch (err) {
      $('io-out').textContent = 'Restore failed: ' + err.message;
    }
    refreshLog();
    refreshSettings();
  });

  $('clear-all').addEventListener('click', async () => {
    if (!confirm('Delete ALL logged movements and settings from this device?')) return;
    if (!confirm('Are you sure? This cannot be undone unless you saved a backup first.')) return;
    await store.clearAllData();
    $('io-out').textContent = 'All data deleted.';
    $('set-duedate').value = '';
    refreshLog();
    refreshSettings();
  });

  $('selftest').addEventListener('click', async () => {
    $('selftest-out').textContent = 'Running…';
    try {
      $('selftest-out').textContent = await runSelfTest();
    } catch (err) {
      $('selftest-out').textContent = 'Health check crashed: ' + err.message;
    }
  });

  refreshSettings();
}

// End-to-end check of the data layer on this device.
export async function runSelfTest() {
  const results = [];
  const check = (name, ok, detail) => {
    results.push(`${ok ? 'pass' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
    return ok;
  };

  // 1. Timestamp format carries the local UTC offset.
  const now = time.nowLocalISO();
  check('timestamp format', time.isValidISO(now) && !now.endsWith('Z'), now);

  // 2. Clock change: wall time comes from the string, ordering from the
  //    instant. 01:30 BST is *earlier* than 01:15 GMT on 25 Oct 2026,
  //    even though string order says otherwise.
  const bst = '2026-10-25T01:30:00+01:00';
  const gmt = '2026-10-25T01:15:00+00:00';
  check('wall time read from string', time.localParts(bst).hour === 1
    && time.localParts(bst).minutesOfDay === 90);
  check('ordering uses instant, not string', time.epoch(bst) < time.epoch(gmt) && bst > gmt);

  // 3. Gestational week from due date (due 2 Nov 2026 → 33+0 on 14 Sep).
  const ga = time.gestationalAge('2026-11-02', '2026-09-14');
  check('gestational age', ga && ga.weeks === 33 && ga.days === 0,
    ga && `got ${ga.weeks}+${ga.days}`);

  // 4. Event round-trip against the real database (cleaned up afterwards).
  let testId = null;
  try {
    const created = await store.addEvent({ count: 2, tags: ['lying_down', 'a,b'] });
    testId = created.id;
    const fetched = await store.getEvent(testId);
    check('create + read event', fetched && fetched.count === 2 && fetched.t === created.t);
    const updated = await store.updateEvent(testId, { count: 7 });
    check('update event', updated.count === 7 && updated.t === created.t);

    // 5. CSV escapes tags containing commas.
    const csv = await exporter.buildCSV();
    check('CSV format', csv.startsWith('timestamp,count,tags')
      && csv.includes('"lying_down;a,b"'));

    // 6. Export → parseImport round-trip is lossless.
    const exported = await exporter.buildExport();
    const parsed = exporter.parseImport(JSON.stringify(exported));
    check('export/import round-trip',
      JSON.stringify(parsed.events) === JSON.stringify(exported.events)
      && JSON.stringify(parsed.settings) === JSON.stringify(exported.settings));
  } finally {
    if (testId) await store.deleteEvent(testId);
  }
  check('test event cleaned up', !(await store.getEvent(testId)));

  // 7. Import rejects non-exports.
  let rejected = false;
  try {
    exporter.parseImport('{"hello": "world"}');
  } catch {
    rejected = true;
  }
  check('import rejects bad data', rejected);

  const failures = results.filter((r) => r.startsWith('FAIL')).length;
  const total = results.length;
  results.push('');
  results.push(failures === 0 ? `All ${total} checks passed — everything is working.`
    : `${failures} of ${total} CHECKS FAILED`);
  return results.join('\n');
}
