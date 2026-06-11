// Time helpers.
//
// Every event is stored as ISO 8601 *with the local UTC offset captured at
// logging time* (e.g. "2026-09-14T08:21:02+01:00"). All time-of-day analysis
// reads the wall-clock time back out of the string itself — never through the
// device's current timezone — so data survives the October clock change and
// travel.

export function nowLocalISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const offMin = -d.getTimezoneOffset();
  const sign = offMin < 0 ? '-' : '+';
  const abs = Math.abs(offMin);
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
    sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60)
  );
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isValidISO(t) {
  return typeof t === 'string' && ISO_RE.test(t) && !Number.isNaN(Date.parse(t));
}

// Wall-clock parts as recorded at logging time.
export function localParts(t) {
  const m = ISO_RE.exec(t);
  if (!m) throw new Error('Bad timestamp: ' + t);
  return {
    year: +m[1], month: +m[2], day: +m[3],
    hour: +m[4], minute: +m[5], second: +m[6],
    date: m[1] + '-' + m[2] + '-' + m[3],
    minutesOfDay: +m[4] * 60 + +m[5],
    offset: m[7],
  };
}

// Absolute instant, for ordering and episode clustering.
export function epoch(t) {
  return Date.parse(t);
}

// "17:05" — the wall-clock time recorded at logging.
export function fmtHM(t) {
  const p = localParts(t);
  return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0');
}

export function todayLocalDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// Gestational age on a local date ("YYYY-MM-DD"), derived from the due date.
// Date-only UTC arithmetic so a DST change can never shift a day boundary.
// Returns { weeks, days, totalDays } (completed weeks, e.g. 33w+2), or null
// if no due date is set or the date precedes the derived start of pregnancy.
export function gestationalAge(dueDate, onDate) {
  if (!dueDate || !onDate) return null;
  const [dy, dm, dd] = dueDate.split('-').map(Number);
  const [oy, om, od] = onDate.split('-').map(Number);
  const daysUntilDue = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(oy, om - 1, od)) / 86400000);
  const totalDays = 280 - daysUntilDue;
  if (totalDays < 0) return null;
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays };
}
