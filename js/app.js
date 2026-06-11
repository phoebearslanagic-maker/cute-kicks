// App shell: bottom tab bar navigation between screens.

import * as store from './store.js';
import * as exporter from './export.js';
import * as time from './time.js';
import * as episodes from './episodes.js';
import { initLog, refreshLog } from './log.js';
import { renderHistory } from './history.js';
import { initSettings, runSelfTest } from './settings.js';

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
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
}

initLog();
initSettings();

// Console access for debugging.
window.__kick = { store, exporter, time, episodes, runSelfTest };
