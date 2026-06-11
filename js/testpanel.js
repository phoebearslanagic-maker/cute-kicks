// Temporary step-1 test panel. Exercises the data layer on-device; the Log
// screen replaces this in build step 2.

import * as store from './store.js';
import * as exporter from './export.js';
import * as time from './time.js';

const $ = (id) => document.getElementById(id);

async function refresh() {
  try {
    const [settings, events] = await Promise.all([store.getSettings(), store.getEvents()]);
    const taps = events.reduce((n, e) => n + e.count, 0);
    const today = time.todayLocalDate();
    const todayTaps = events
      .filter((e) => time.localParts(e.t).date === today)
      .reduce((n, e) => n + e.count, 0);
    $('status').textContent =
      `${events.length} events, ${taps} movements total · ${todayTaps} today\n` +
      `Settings: gap ${settings.episodeGapMinutes} min · ` +
      `waking ${settings.wakingHours.start}–${settings.wakingHours.end} · ` +
      `${settings.tags.length} tags · due date ${settings.dueDate || 'not set'}`;
  } catch (err) {
    $('status').textContent = 'Database error: ' + err.message;
  }
}

$('add-one').addEventListener('click', async () => {
  const e = await store.addEvent({ count: 1 });
  $('log-out').textContent = 'Logged 1 at ' + e.t;
  refresh();
});

$('add-flurry').addEventListener('click', async () => {
  const e = await store.addEvent({ count: 5, tags: ['after_eating'] });
  $('log-out').textContent = 'Logged flurry of 5 (tag: after_eating) at ' + e.t;
  refresh();
});

$('delete-last').addEventListener('click', async () => {
  const events = await store.getEvents();
  const last = events[events.length - 1];
  if (!last) {
    $('log-out').textContent = 'Nothing to delete.';
    return;
  }
  if (!confirm(`Delete the event at ${last.t} (count ${last.count})?`)) return;
  await store.deleteEvent(last.id);
  $('log-out').textContent = 'Deleted event at ' + last.t;
  refresh();
});

$('export-json').addEventListener('click', async () => {
  try {
    $('io-out').textContent = 'JSON export: ' + (await exporter.exportJSON());
  } catch (err) {
    $('io-out').textContent = 'Export failed: ' + err.message;
  }
});

$('export-csv').addEventListener('click', async () => {
  try {
    $('io-out').textContent = 'CSV export: ' + (await exporter.exportCSV());
  } catch (err) {
    $('io-out').textContent = 'Export failed: ' + err.message;
  }
});

$('import-btn').addEventListener('click', () => $('import-file').click());

$('import-file').addEventListener('change', async () => {
  const file = $('import-file').files[0];
  $('import-file').value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const { events } = exporter.parseImport(text);
    if (!confirm(`Replace everything on this device with ${events.length} imported events?`)) {
      $('io-out').textContent = 'Import cancelled.';
      return;
    }
    const result = await exporter.importData(text);
    $('io-out').textContent = `Imported ${result.events} events.`;
  } catch (err) {
    $('io-out').textContent = 'Import failed: ' + err.message;
  }
  refresh();
});

$('clear-all').addEventListener('click', async () => {
  if (!confirm('Delete ALL events and settings from this device?')) return;
  if (!confirm('Are you sure? This cannot be undone unless you exported first.')) return;
  await store.clearAllData();
  $('io-out').textContent = 'All data cleared.';
  refresh();
});

// ---- Self-test ----------------------------------------------------------

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
  results.push(failures === 0 ? `All ${total} checks passed.` : `${failures} of ${total} CHECKS FAILED`);
  return results.join('\n');
}

$('selftest').addEventListener('click', async () => {
  $('selftest-out').textContent = 'Running…';
  try {
    $('selftest-out').textContent = await runSelfTest();
  } catch (err) {
    $('selftest-out').textContent = 'Self-test crashed: ' + err.message;
  }
  refresh();
});

// Console access for debugging: window.__kick.store / .exporter / .time
window.__kick = { store, exporter, time, runSelfTest };

refresh();
