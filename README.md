# Cute Kicks

A single-user, offline-first PWA for tracking fetal movements during pregnancy,
used on an iPhone via Safari and added to the home screen.

Its job is **pattern awareness, never reassurance**: it shows your own data so
you can know your baby's individual pattern. It never scores, predicts, or
tells you things are fine. If you think your baby's movements have slowed,
stopped or changed, contact your midwife or maternity unit straight away —
don't wait, and don't rely on this app.

## Privacy

No backend, no accounts, no analytics. All data lives in the browser's
IndexedDB on the device and leaves it only via explicit export. Nothing
personal is stored in this repository.

## Tech

Vanilla HTML/CSS/JS, zero dependencies, no build step. Deployed as a static
folder on GitHub Pages.

Local development: `python3 -m http.server 8000` in this folder, then open
<http://localhost:8000>.

## Build progress

1. [x] Data layer (IndexedDB, event CRUD, settings) + export/import
2. [x] Log screen (tap, hold-for-flurry, tags, undo)
3. [x] History
4. [x] Episode derivation + Patterns views
5. [x] Service worker, manifest, icons, install polish
6. [ ] Acceptance checklist pass
7. [ ] Final deploy + home-screen install
