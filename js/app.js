// App shell: bottom tab bar navigation between screens.

import * as store from './store.js?v=1781199129';
import * as exporter from './export.js?v=1781199129';
import * as time from './time.js?v=1781199129';
import * as episodes from './episodes.js?v=1781199129';
import { initLog, refreshLog } from './log.js?v=1781199129';
import { renderHistory } from './history.js?v=1781199129';
import { renderPatterns } from './patterns.js?v=1781199129';
import { initSettings, runSelfTest } from './settings.js?v=1781199129';

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
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showScreen(tab.dataset.screen));
}

initLog();
initSettings();

// Console access for debugging.
window.__kick = { store, exporter, time, episodes, runSelfTest };
