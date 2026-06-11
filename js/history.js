// History screen: reverse-chronological list grouped by day. Day headers show
// daily totals (taps and episodes) with the gestational week as annotation.
// Tapping an entry opens an inline editor for time, count and tags, with
// delete (confirmed).

import * as store from './store.js';
import { localParts, fmtHM, todayLocalDate, gestationalAge } from './time.js';
import { clusterEpisodes } from './episodes.js';
import { refreshLog } from './log.js';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

let editingId = null;

function dayLabel(date) {
  if (date === todayLocalDate()) return 'Today';
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(y, m - 1, d));
}

function entrySummary(e) {
  const what = e.count === 1 ? '1 movement' : `${e.count} movements`;
  return `${what} at ${fmtHM(e.t)}`;
}

function buildRow(e) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'hist-row';

  const t = document.createElement('span');
  t.className = 'hist-time num';
  t.textContent = fmtHM(e.t);

  const c = document.createElement('span');
  c.className = 'hist-count num';
  c.textContent = e.count === 1 ? '1 movement' : `${e.count} movements`;

  const tags = document.createElement('span');
  tags.className = 'hist-tags';
  tags.textContent = (e.tags || []).map((x) => x.replace(/_/g, ' ')).join(' · ');

  row.append(t, c, tags);
  row.addEventListener('click', () => {
    editingId = e.id;
    renderHistory();
  });
  return row;
}

function buildEditor(e, settings) {
  const box = document.createElement('div');
  box.className = 'hist-edit';

  const grid = document.createElement('div');
  grid.className = 'edit-grid';

  const timeLabel = document.createElement('label');
  timeLabel.textContent = 'Time';
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  const p = localParts(e.t);
  timeInput.value = pad2(p.hour) + ':' + pad2(p.minute);
  timeLabel.appendChild(timeInput);

  const countLabel = document.createElement('label');
  countLabel.textContent = 'Movements';
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '1';
  countInput.max = '500';
  countInput.inputMode = 'numeric';
  countInput.value = e.count;
  countLabel.appendChild(countInput);

  grid.append(timeLabel, countLabel);

  // Tag chips: settings tags plus any tags already on the event (so entries
  // tagged with since-archived tags stay editable without losing them).
  const chipWrap = document.createElement('div');
  chipWrap.className = 'chips left';
  let chosen = [...(e.tags || [])];
  const allTags = [...new Set([...settings.tags, ...chosen])];
  for (const tag of allTags) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (chosen.includes(tag) ? ' on' : '');
    chip.textContent = tag.replace(/_/g, ' ');
    chip.addEventListener('click', () => {
      chosen = chosen.includes(tag) ? chosen.filter((x) => x !== tag) : [...chosen, tag];
      chip.classList.toggle('on', chosen.includes(tag));
    });
    chipWrap.appendChild(chip);
  }

  const buttons = document.createElement('div');
  buttons.className = 'row';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'primary';
  save.textContent = 'Save';
  save.addEventListener('click', async () => {
    const patch = { tags: chosen };
    const count = parseInt(countInput.value, 10);
    if (Number.isInteger(count) && count >= 1) patch.count = count;
    if (timeInput.value) {
      const [hh, mm] = timeInput.value.split(':');
      // Same recorded day, seconds and UTC offset; only the wall time moves.
      patch.t = `${p.date}T${hh}:${mm}:${pad2(p.second)}${p.offset}`;
    }
    await store.updateEvent(e.id, patch);
    editingId = null;
    renderHistory();
    refreshLog();
  });

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => {
    editingId = null;
    renderHistory();
  });

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'danger';
  del.textContent = 'Delete';
  del.addEventListener('click', async () => {
    if (!confirm(`Delete "${entrySummary(e)}"?`)) return;
    await store.deleteEvent(e.id);
    editingId = null;
    renderHistory();
    refreshLog();
  });

  buttons.append(save, cancel, del);
  box.append(grid, chipWrap, buttons);
  return box;
}

export async function renderHistory() {
  const [settings, events] = await Promise.all([store.getSettings(), store.getEvents()]);
  const list = $('history-list');
  list.textContent = '';

  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    const msg = document.createElement('p');
    msg.className = 'muted';
    msg.textContent = 'Nothing logged yet — movements you log will appear here, newest first.';
    empty.appendChild(msg);
    list.appendChild(empty);
    return;
  }

  const byDate = new Map();
  for (const e of events) {
    const d = localParts(e.t).date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(e);
  }

  const dates = [...byDate.keys()].sort().reverse();
  for (const date of dates) {
    const dayEvents = byDate.get(date); // ascending within the day
    const taps = dayEvents.reduce((n, e) => n + e.count, 0);
    const episodes = clusterEpisodes(dayEvents, settings.episodeGapMinutes).length;

    const head = document.createElement('div');
    head.className = 'day-head';
    const h = document.createElement('h3');
    h.textContent = dayLabel(date);
    const totals = document.createElement('span');
    totals.className = 'muted small num';
    const ga = gestationalAge(settings.dueDate, date);
    totals.textContent = (ga ? `Week ${ga.weeks} · ` : '')
      + `${taps} movement${taps === 1 ? '' : 's'} · ${episodes} episode${episodes === 1 ? '' : 's'}`;
    head.append(h, totals);
    list.appendChild(head);

    for (const e of [...dayEvents].reverse()) {
      list.appendChild(e.id === editingId ? buildEditor(e, settings) : buildRow(e));
    }
  }
}
