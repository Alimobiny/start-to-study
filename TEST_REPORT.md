# TEST REPORT — Reminder Engine (Stage A + B), PWA (Stage C) & Exact Azar Plan

## Local reproducible suite (current)

**Release:** exact Azar 1405 day plan (Aban 30 – Dey 4)  
**Runner:** Node.js 24 (vm sandbox, no browser, no downloads)  
**Command:** `node tests/run-tests.mjs` (or double-click `run_tests.bat`)  
**Timezone:** logic exercised at fixed Asia/Tehran instants via a controllable clock  
**Result:** 34 / 34 PASS — verified on the user's Windows machine (2026-11-21)

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
| System notification fires alongside the in-page card | PASS |
| System notification off: card only, nothing OS-level | PASS |
| Denied permission falls back to card only, no throw | PASS |
| Missing Notification API degrades gracefully | PASS |
| Header button asks for permission on click, then enables | PASS |
| Header button respects an explicit browser denial | PASS |
| Backup JSON contains reminder fields (schemaVersion 4) | PASS |
| Restore keeps the system-notification preference | PASS |
| `save()` persists reminder settings through the storage adapter | PASS |
| Manifest is valid JSON with all install-required fields | PASS |
| Manifest icons exist on disk as real PNGs with matching dimensions | PASS |
| `index.html` links the manifest and registers the SW behind a protocol guard | PASS |
| `sw.js` passes `node --check` | PASS |
| SW install precaches the shell; activate cleans old cache versions | PASS |
| exactPlan covers exactly 2026-11-21 through 2026-12-25 | PASS |
| Sina nights run to 02:00, including the new Monday night of Dey 23 | PASS |
| Engine uses exact data where it differs from the weekly pattern | PASS |
| Night shifts spill into the next morning (Sunday night → Monday tail) | PASS |
| Calendar display reflects the exact plan | PASS |
| Reverts to the weekly pattern after Dey 4 | PASS |
| Reminder suppressed by the new Monday-night shift, fires in exact free slots | PASS |
| Rest and events never suppress; sessions and the installment exist in day data | PASS |

Method: the inline `<script>` is extracted from `index.html`, syntax-checked with
`node --check`, then executed inside a Node `vm` context with minimal DOM,
`localStorage`, `Notification`, `Blob`/`URL` shims and a fakeable `Date`.
Scheduling behaviour is exercised directly (`checkScheduledReminders` with a
fixed clock), the permission flow through the real button handler, and
restore through the real `#backupFile` change path — so the suite runs in
about a second and needs no browser. **Not covered here:** the real Windows
toast, the real browser permission prompt, and the real Chrome/Edge install
flow (install button, standalone window, offline launch) — those need the
manual checks below.

## Manual checks on the user's machine (pending user run)

### Stage B — system notification

1. Start the dashboard (`اجرای_داشبورد.bat`).

1. Start the dashboard (`اجرای_داشبورد.bat`).
2. Click «اعلان سیستم: خاموش» in the header and accept the browser prompt.
3. Configure a reminder a few minutes ahead on a free slot; when it fires, a
   Windows toast should appear even if the tab is in the background.
4. Clicking the toast should bring the dashboard window to the front.
5. Toggling the button off stops OS toasts while in-page cards continue.

### Stage C — install & offline launch

1. Start the server once and open `http://127.0.0.1:8765/index.html` in Chrome or Edge.
2. The address bar should show an install icon (or the three-dot menu an «Install» entry).
3. Install: a standalone window opens without an address bar; a «روتین» icon lands on the desktop/taskbar.
4. Close the server window, then double-click the installed icon — the app must still launch (served from the service-worker cache).
5. Restart the server, open the installed app once — new copies of the shell get cached (updates flow).

## Prior runs (history)

- 2026-11-20 Stage B session: 21/21 PASS (same runner, notification paths included).
- 2026-11-20 infrastructure session: 14/14 PASS (same runner, pre-Stage-B product code).
- 2026-11 container, Chromium/Playwright: 19/19 PASS — details below.

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
