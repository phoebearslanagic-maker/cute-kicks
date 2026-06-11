// App shell: bottom tab bar navigation between screens, service worker.

import * as store from './store.js?v=1781203200';
import * as exporter from './export.js?v=1781203200';
import * as time from './time.js?v=1781203200';
import * as episodes from './episodes.js?v=1781203200';
import { initLog, refreshLog } from './log.js?v=1781203200';
import { renderHistory } from './history.js?v=1781203200';
import { renderPatterns } from './patterns.js?v=1781203200';
import { initSettings, refreshSettings, runSelfTest } from './settings.js?v=1781203200';

function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.classList.toggle('active', screen.id === 'screen-' + name);
  }
  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab.dataset.screen === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  if (name === 'log') refreshLog();
  if (name === 'history') renderHistory();
  if (name === 'patterns') renderPatterns();
  if (name === 'settings') refreshSettings();
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
}

initLog();
initSettings();

// Offline support + self-updating. When a deploy installs a new worker, the
// page reloads itself once to pick it up. Skipped during local development
// (cache-first would mask edits); opt in with ?sw=test.
if ('serviceWorker' in navigator
    && (location.hostname !== 'localhost' || location.search.includes('sw=test'))) {
  navigator.serviceWorker.register('sw.js');
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

// Console access for debugging.
window.__kick = { store, exporter, time, episodes, runSelfTest };
