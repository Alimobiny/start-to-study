# TEST REPORT — Stage A Reminder Engine

## Local reproducible suite (current)

**Release:** development-infrastructure repair session  
**Runner:** Node.js 24 (vm sandbox, no browser, no downloads)  
**Command:** `node tests/run-tests.mjs` (or double-click `run_tests.bat`)  
**Timezone:** logic exercised at fixed Asia/Tehran instants via a controllable clock  
**Result:** 14 / 14 PASS — verified on the user's Windows machine (2026-11-20)

| Test | Result |
|---|---|
| Inline script passes `node --check` | PASS |
| Initial state: 16 tasks across the four zones, reminders on | PASS |
| `civilMinute` / `dayIxFromIso` arithmetic sanity | PASS |
| All seven shift rules exist with exact intervals | PASS |
| Saturday Sina and Sunday Parsian shifts cross midnight | PASS |
| Shift boundaries are end-exclusive (Thursday Sina) | PASS |
| Free interval: Monday daytime | PASS |
| Reminder fires in a free slot and is recorded | PASS |
| Same occurrence is not duplicated | PASS |
| Reminder suppressed when the activity crosses a shift | PASS |
| No reminder for a task already done today | PASS |
| Global pause blocks all reminders without touching settings | PASS |
| Backup JSON contains reminder fields (schemaVersion 3) | PASS |
| `save()` persists reminder settings through the storage adapter | PASS |

Method: the inline `<script>` is extracted from `index.html`, syntax-checked with
`node --check`, then executed inside a Node `vm` context with minimal DOM,
`localStorage`, `Blob`/`URL` shims and a fakeable `Date`. Scheduling behaviour is
exercised directly (`checkScheduledReminders` with a fixed clock), so the suite
runs in about a second and needs no browser. It complements — not replaces —
the earlier browser-level run below.

## Prior browser-level record (2026-11, container environment)

**Release:** Stage A / in-dashboard reminder scheduling  
**Browser:** Chromium headless through Playwright  
**Timezone:** Browser context Europe/Berlin; app logic uses Asia/Tehran  
**Result:** 19 / 19 PASS

| Test | Result |
|---|---|
| Initial routine render (4 sections) | PASS |
| Main navigation views present | PASS |
| Reminder fires during a non-shift interval | PASS |
| Same reminder occurrence is not duplicated | PASS |
| Reminder settings saved in storage adapter | PASS |
| Reminder config retained in state | PASS |
| Activity overlapping a shift is suppressed | PASS |
| Shift boundary helper: Thursday shift | PASS |
| Free interval helper: Monday daytime | PASS |
| Saturday Sina night shift interval | PASS |
| Sunday Parsian night shift interval | PASS |
| Tuesday Pardis shift interval | PASS |
| Wednesday Di shift interval | PASS |
| Thursday Sina day shift interval | PASS |
| Friday Parsian day shift interval | PASS |
| Friday Parsian overnight shift interval | PASS |
| Global reminder pause switch | PASS |
| JSON backup contains reminder fields | PASS |
| No browser JavaScript/console errors | PASS |

## Test method and limitations

- Inline JavaScript syntax passed `node --check`.
- Interaction and scheduling logic were tested in Chromium with Playwright using controlled dates/times.
- Local navigation (`http://127.0.0.1` and `file://`) was restricted by the execution environment, so the automated UI test used `page.set_content` and an injected storage adapter. The `localStorage` API path, save calls and backup serialization were exercised; actual persistence in the user's Windows profile has not yet been verified on their machine.
- The app does not send native OS notifications in Stage A. It displays an in-page reminder card while the dashboard code is running.
- Background throttling, device sleep, and real-world delivery latency are not guaranteed by this stage.


## Final release smoke test

A second Playwright run against the production HTML (without the test-only hook) passed. The test waited for the actual 15-second interval, confirmed a reminder appears at the selected free-time due point, then moved simulated time to Thursday morning and confirmed the shift-overlapping reminder is suppressed. No browser errors occurred. The local Python server was started and returned HTTP 200 for `/index.html`; ZIP integrity and required-file presence were also verified.
