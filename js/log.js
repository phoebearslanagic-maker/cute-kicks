// Log screen: one big button. Tap = one movement; press-and-hold climbs the
// count (1 per ~400ms) and release commits the total as a single event.
// After each log: tag chips and an Undo affordance for ~10 seconds.

import * as store from './store.js?v=1781198427';
import { fmtHM, localParts, todayLocalDate, gestationalAge } from './time.js?v=1781198427';
import { clusterEpisodes } from './episodes.js?v=1781198427';

const $ = (id) => document.getElementById(id);
const AFFORDANCE_MS = 10000;
const HOLD_STEP_MS = 400;

let lastEvent = null;
let holdInterval = null;
let holdCount = 0;
let holding = false;
let affordanceTimer = null;

export async function refreshLog() {
  const [settings, events] = await Promise.all([store.getSettings(), store.getEvents()]);
  const today = todayLocalDate();
  const todays = events.filter((e) => localParts(e.t).date === today);
  const taps = todays.reduce((n, e) => n + e.count, 0);
  const episodes = clusterEpisodes(todays, settings.episodeGapMinutes).length;

  const dateStr = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());
  const ga = gestationalAge(settings.dueDate, today);
  $('log-week').textContent = ga ? `Week ${ga.weeks} · ${dateStr}` : dateStr;
  $('log-today').textContent =
    `${taps} movement${taps === 1 ? '' : 's'} today (${episodes} episode${episodes === 1 ? '' : 's'})`;
  $('log-duedate-hint').hidden = !!settings.dueDate;
}

function showCount(n) {
  const el = $('log-button-count');
  el.textContent = n;
  el.hidden = false;
  $('log-button-hint').hidden = true;
}

function resetButtonFace() {
  $('log-button-count').hidden = true;
  $('log-button-hint').hidden = false;
}

async function renderChips() {
  const settings = await store.getSettings();
  const wrap = $('tag-chips');
  wrap.textContent = '';
  for (const tag of settings.tags) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = tag.replace(/_/g, ' ');
    chip.addEventListener('click', async () => {
      if (!lastEvent) return;
      const tags = lastEvent.tags.includes(tag)
        ? lastEvent.tags.filter((t) => t !== tag)
        : [...lastEvent.tags, tag];
      lastEvent = await store.updateEvent(lastEvent.id, { tags });
      chip.classList.toggle('on', tags.includes(tag));
    });
    wrap.appendChild(chip);
  }
}

function hideAffordances() {
  $('tag-chips').hidden = true;
  $('log-undo').hidden = true;
  $('log-stamp').textContent = '';
}

async function commitLog(count) {
  lastEvent = await store.addEvent({ count });
  $('log-stamp').textContent =
    `Logged ${count === 1 ? '1 movement' : count + ' movements'} at ${fmtHM(lastEvent.t)}`;
  $('log-undo').hidden = false;
  await renderChips();
  $('tag-chips').hidden = false;
  clearTimeout(affordanceTimer);
  affordanceTimer = setTimeout(hideAffordances, AFFORDANCE_MS);
  refreshLog();
}

function endHold(commit) {
  if (!holding) return;
  holding = false;
  clearInterval(holdInterval);
  $('log-button').classList.remove('holding');
  resetButtonFace();
  if (commit && holdCount > 0) commitLog(holdCount);
}

export function initLog() {
  const btn = $('log-button');
  btn.addEventListener('contextmenu', (e) => e.preventDefault());

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    holding = true;
    holdCount = 1;
    showCount(holdCount);
    btn.classList.add('holding');
    clearInterval(holdInterval);
    holdInterval = setInterval(() => {
      holdCount += 1;
      showCount(holdCount);
    }, HOLD_STEP_MS);
  });

  btn.addEventListener('pointerup', () => endHold(true));
  // If the system steals the gesture mid-hold, keep what was counted
  // rather than silently losing it.
  btn.addEventListener('pointercancel', () => endHold(true));

  $('log-undo').addEventListener('click', async () => {
    if (!lastEvent) return;
    await store.deleteEvent(lastEvent.id);
    lastEvent = null;
    hideAffordances();
    $('log-stamp').textContent = 'Undone — that one wasn\'t counted.';
    refreshLog();
  });

  // Keep the date header and today line fresh when the app is reopened.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshLog();
  });

  refreshLog();
}
