// Patterns screen — entirely passive views of the user's own data.
//
// Everything here describes; nothing judges, scores, predicts or reassures.
// Gaps in the strips can simply mean the user was busy or asleep — the data
// is attention-filtered, and the copy must never read absence as stillness.

import * as store from './store.js?v=1781256394';
import { localParts, epoch, todayLocalDate, gestationalAge } from './time.js?v=1781256394';
import { clusterEpisodes } from './episodes.js?v=1781256394';

const $ = (id) => document.getElementById(id);

// ---- shared helpers ------------------------------------------------------

function dateAddDays(date, delta) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function lastNDates(n) {
  const today = todayLocalDate();
  return Array.from({ length: n }, (_, i) => dateAddDays(today, -i)); // newest first
}

function shortDayLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' })
    .format(new Date(y, m - 1, d));
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function groupByDate(events) {
  const by = new Map();
  for (const e of events) {
    const d = localParts(e.t).date;
    if (!by.has(d)) by.set(d, []);
    by.get(d).push(e);
  }
  return by;
}

// date -> Set of half-hour blocks (0–47) any episode touched.
function blocksByDate(events, gapMinutes) {
  const filled = new Map();
  const mark = (date, b) => {
    if (!filled.has(date)) filled.set(date, new Set());
    filled.get(date).add(b);
  };
  for (const ep of clusterEpisodes(events, gapMinutes)) {
    let prev = null;
    for (const e of ep.events) {
      const p = localParts(e.t);
      const b = Math.floor(p.minutesOfDay / 30);
      mark(p.date, b);
      // Bridge the small gap between consecutive events of one episode.
      if (prev && prev.date === p.date) {
        for (let i = prev.b + 1; i < b; i++) mark(p.date, i);
      }
      prev = { date: p.date, b };
    }
  }
  return filled;
}

function timeToBlockX(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / 30; // block units, fractional
}

// ---- day strips (hero view) ---------------------------------------------

const X0 = 46;
const BW = 6.5; // half-hour block width
const GRID_W = 48 * BW;

function hourAxis(y) {
  return [0, 6, 12, 18, 24].map((h) =>
    `<text x="${X0 + h * 2 * BW}" y="${y}" font-size="8" fill="var(--muted)"
       text-anchor="middle">${h}</text>`).join('');
}

function dayStripsSVG(events, settings) {
  const dates = lastNDates(14);
  const filled = blocksByDate(events, settings.episodeGapMinutes);
  const firstDate = events.length ? localParts(events[0].t).date : dates[0];
  const wakeA = timeToBlockX(settings.wakingHours.start);
  const wakeB = timeToBlockX(settings.wakingHours.end);
  const rowH = 11;
  const gap = 3;
  const y0 = 14;
  const nowBlock = (() => {
    const d = new Date();
    return (d.getHours() * 60 + d.getMinutes()) / 30;
  })();

  let rows = '';
  dates.forEach((date, i) => {
    const y = y0 + i * (rowH + gap);
    rows += `<rect x="${X0}" y="${y}" width="${GRID_W}" height="${rowH}" rx="2"
       fill="var(--border)" opacity="0.4"/>`;
    // Night-time subtly darker than the waking-hours band.
    if (wakeB > wakeA) {
      rows += `<rect x="${X0}" y="${y}" width="${wakeA * BW}" height="${rowH}"
         fill="var(--text)" opacity="0.07"/>`;
      rows += `<rect x="${X0 + wakeB * BW}" y="${y}" width="${GRID_W - wakeB * BW}"
         height="${rowH}" fill="var(--text)" opacity="0.07"/>`;
    }
    for (const b of filled.get(date) || []) {
      rows += `<rect x="${(X0 + b * BW + 0.4).toFixed(1)}" y="${y + 0.5}"
         width="${BW - 0.8}" height="${rowH - 1}" rx="1.5" fill="var(--accent)"/>`;
    }
    // Dim what hasn't happened yet (today) and days before logging began,
    // so empty never silently reads as "still".
    if (i === 0) {
      rows += `<rect x="${X0 + nowBlock * BW}" y="${y - 0.5}"
         width="${GRID_W - nowBlock * BW}" height="${rowH + 1}" fill="var(--bg)" opacity="0.65"/>`;
    } else if (date < firstDate) {
      rows += `<rect x="${X0}" y="${y - 0.5}" width="${GRID_W}" height="${rowH + 1}"
         fill="var(--bg)" opacity="0.65"/>`;
    }
    rows += `<text x="${X0 - 5}" y="${y + rowH - 2.5}" font-size="8.5"
       fill="var(--muted)" text-anchor="end">${i === 0 ? 'Today' : shortDayLabel(date)}</text>`;
  });

  const height = y0 + 14 * (rowH + gap) + 2;
  return `<svg viewBox="0 0 360 ${height}" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="When movement was logged over the last 14 days">
     ${hourAxis(9)}${rows}</svg>`;
}

// ---- typical day profile -------------------------------------------------

function profileSVG(events, settings) {
  const dates = lastNDates(14);
  const filled = blocksByDate(events, settings.episodeGapMinutes);
  const chartH = 44;
  const base = 8 + chartH;
  let bars = '';
  for (let b = 0; b < 48; b++) {
    const days = dates.filter((d) => (filled.get(d) || new Set()).has(b)).length;
    if (!days) continue;
    const h = (days / 14) * chartH;
    bars += `<rect x="${(X0 + b * BW + 0.4).toFixed(1)}" y="${(base - h).toFixed(1)}"
       width="${BW - 0.8}" height="${h.toFixed(1)}" rx="1.5" fill="var(--accent)" opacity="0.85"/>`;
  }
  return `<svg viewBox="0 0 360 ${base + 14}" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="Share of the last 14 days with activity, by half hour">
     <line x1="${X0}" y1="${base}" x2="${X0 + GRID_W}" y2="${base}"
       stroke="var(--border)" stroke-width="1"/>
     ${hourAxis(base + 11)}${bars}</svg>`;
}

// ---- trend: episodes per day, 7-day median -------------------------------

function trendSVG(events, settings) {
  const byDate = groupByDate(events);
  const first = localParts(events[0].t).date;
  const today = todayLocalDate();
  const dates = [];
  for (let d = first; d <= today; d = dateAddDays(d, 1)) dates.push(d);

  const values = dates.map((d) =>
    clusterEpisodes(byDate.get(d) || [], settings.episodeGapMinutes).length);
  const med = values.map((_, i) => median(values.slice(Math.max(0, i - 6), i + 1)));

  const x0 = 26;
  const w = 326;
  const top = 8;
  const h = 78;
  const base = top + h;
  const ymax = Math.max(4, ...values);
  const xAt = (i) => x0 + (dates.length === 1 ? w / 2 : (i / (dates.length - 1)) * w);
  const yAt = (v) => base - (v / ymax) * h;

  let dots = '';
  values.forEach((v, i) => {
    dots += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="1.9"
       fill="var(--accent)" opacity="${v > 0 ? 0.5 : 0.18}"/>`;
  });
  const line = dates.length > 1
    ? `<polyline points="${med.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')}"
         fill="none" stroke="var(--accent)" stroke-width="1.6"/>`
    : '';

  // X annotations: gestational weeks when the due date is known, else months.
  let labels = '';
  let prevKey = null;
  let lastLabelX = -100;
  dates.forEach((d, i) => {
    const ga = gestationalAge(settings.dueDate, d);
    const key = ga ? `W${ga.weeks}` : new Intl.DateTimeFormat('en-GB', { month: 'short' })
      .format(new Date(d + 'T12:00:00'));
    if (key !== prevKey && prevKey !== null && xAt(i) - lastLabelX > 26) {
      labels += `<text x="${xAt(i).toFixed(1)}" y="${base + 12}" font-size="8"
         fill="var(--muted)" text-anchor="middle">${key}</text>
         <line x1="${xAt(i).toFixed(1)}" y1="${base}" x2="${xAt(i).toFixed(1)}" y2="${base + 3}"
         stroke="var(--border)" stroke-width="1"/>`;
      lastLabelX = xAt(i);
    }
    prevKey = key;
  });

  return `<svg viewBox="0 0 360 ${base + 16}" xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="Episodes per day over the whole history">
     <line x1="${x0}" y1="${base}" x2="${x0 + w}" y2="${base}" stroke="var(--border)" stroke-width="1"/>
     <text x="${x0 - 4}" y="${base + 3}" font-size="8" fill="var(--muted)" text-anchor="end">0</text>
     <text x="${x0 - 4}" y="${top + 3}" font-size="8" fill="var(--muted)" text-anchor="end">${ymax}</text>
     ${dots}${line}${labels}</svg>`;
}

// ---- tag notes (descriptive only) ----------------------------------------

function activityWithinHourAfter(epochs, t0) {
  // epochs sorted ascending; true if any falls in (t0, t0 + 1h].
  let lo = 0;
  let hi = epochs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (epochs[mid] <= t0) lo = mid + 1; else hi = mid;
  }
  return lo < epochs.length && epochs[lo] - t0 <= 3600000;
}

function renderTagNotes(events, settings) {
  const wrap = $('tag-notes');
  wrap.textContent = '';
  const addLine = (text) => {
    const p = document.createElement('p');
    p.className = 'tagnote';
    p.textContent = text;
    wrap.appendChild(p);
  };

  const epochs = events.map((e) => epoch(e.t));
  const followShare = (subset) =>
    subset.filter((e) => activityWithinHourAfter(epochs, epoch(e.t))).length / subset.length;

  const baseline = events.length ? Math.round(followShare(events) * 100) : 0;
  const allTags = [...new Set([...settings.tags, ...events.flatMap((e) => e.tags || [])])];

  let any = false;
  for (const tag of allTags) {
    const label = tag.replace(/_/g, ' ');
    const tagged = events.filter((e) => (e.tags || []).includes(tag));
    if (tagged.length === 0) continue;
    any = true;
    if (tagged.length < 10) {
      addLine(`${label} — not enough data yet (n=${tagged.length}; notes appear from 10 tagged entries).`);
    } else {
      const pct = Math.round(followShare(tagged) * 100);
      addLine(`In the hour after "${label}": further activity in ${pct}% of cases `
        + `(n=${tagged.length}), vs ${baseline}% in the hour after any logged movement `
        + `(n=${events.length}).`);
    }
  }
  if (!any) {
    addLine('No tagged entries yet. Tag logs as you go (after eating, lying down…) and '
      + 'descriptive notes appear here once a tag reaches 10 uses.');
  }
}

// ---- screen --------------------------------------------------------------

export async function renderPatterns() {
  const [settings, events] = await Promise.all([store.getSettings(), store.getEvents()]);
  const has = events.length > 0;
  $('patterns-empty').hidden = has;
  $('patterns-views').hidden = !has;
  if (!has) return;
  $('strips').innerHTML = dayStripsSVG(events, settings);
  $('profile').innerHTML = profileSVG(events, settings);
  $('trend').innerHTML = trendSVG(events, settings);
  renderTagNotes(events, settings);
}
