# PROJECT HANDOFF — Routine + Residency Reminder System

**هدف این فایل:** انتقال کامل وضعیت، تصمیمات و مراحل بعدی پروژه به یک AI/Agent دیگر بدون نیاز به بازخوانی کل گفت‌وگوی قبلی.

## 1. Project purpose

پروژه یک داشبورد شخصی برای اجرای روتین روزانه و برنامه مطالعه آزمون دستیاری بیهوشی ۱۴۰۶ است. داشبورد از فایل روتین اصلی کاربر توسعه یافته و تقویم شمسی، الگوی شیفت‌های ثابت و ثبت ساعات مطالعه را در خود دارد. اکنون Stage A یادآوری‌های زمان‌بندی‌شده درون‌داشبورد به آن اضافه شده است.

## 2. User operating preferences / constraints

- زبان تعامل و مستندات: فارسی؛ نام APIها، شناسه‌ها و کد به انگلیسی.
- فونت اسناد فارسی Word/PDF: **B Nazanin**.
- Word/PDF: راست‌چین واقعی و RTL، بدون رنگ زمینه، مناسب چاپ سیاه‌وسفید؛ کاربر قالب A4 را ترجیح می‌دهد.
- روش مطالعه، مرور، تست و انتخاب منبع کاملاً در اختیار کاربر است؛ در برنامه، روش مطالعه یا مرور اجباری تعریف نشود.
- اولویت: دقت و بررسی واقعی قبل از تحویل؛ از ادعای تست‌نشده خودداری شود.
- کاربر اشتراک ChatGPT Go دارد و می‌خواهد مصرف توکن/پیام کنترل شود؛ کارهای بعدی باید به واحدهای مستقل و کم‌هزینه تقسیم شوند. در هر تحویل فایل `PROJECT_HANDOFF.md` و `TEST_REPORT.md` را به‌روز کن.

## 3. User-provided source files

### `Routine.html`

فایل اصلی روتین کاربر است. رفتارها و ساختار مهمی که باید حفظ شوند:

- چهار بخش: روتین بیدارشدن، صبح، روز، روتین خواب؛
- مجموعه اولیه ۱۶ فعالیت/عادت؛
- انتخاب فعالیت اصلی روز؛
- تایمر فعالیت اصلی؛
- ثبت انجام فعالیت‌ها و پیشرفت روزانه؛
- مدیریت فعالیت‌ها: افزودن، ویرایش، حذف و جابه‌جایی ترتیب؛
- تغییر عنوان بخش‌ها؛
- انتخاب چند چینش بصری.

### `بازه زمانی(2).docx`

فایل زمان‌بندی مرجع کاربر؛ جدول هفت روزه از شنبه تا جمعه با ردیف‌های زمانی دو ساعته از ۰۶:۰۰ تا ۰۰:۰۰. این فایل مبنای ترتیب جدول و مدل برنامه هفتگی است.

### `B_NAZANIN.zip`

کاربر فونت B Nazanin را بارگذاری کرده است. برای اسناد چاپی از همین فونت استفاده شود. فایل فونت را در بسته تحویلی بازنشر نکن.

## 4. Study capacity decisions (locked unless user changes them)

ظرفیت پایه مطالعه در هفته:

| روز | ظرفیت |
|---|---:|
| شنبه | ۲.۵ ساعت |
| یکشنبه | ۱ ساعت |
| دوشنبه | صفر پایه؛ ۰.۵ ساعت اختیاری |
| سه‌شنبه | ۳ ساعت |
| چهارشنبه | ۳ ساعت |
| پنج‌شنبه | ۲ ساعت پایه؛ تا ۳ ساعت توسعه‌ای |
| جمعه | صفر ساعت |

جمع هدف پایه = ۱۱.۵ ساعت در هفته. دوشنبه اختیاری در هدف پایه نیست. جمعه روز دو شیفت است و مطالعه اجباری ندارد.

**Important:** برنامه فقط ظرفیت زمانی را نشان می‌دهد. نوع مطالعه، منابع، مرور، تست و محتوای مطالعاتی را به کاربر تحمیل نکن.

## 5. Fixed work-shift pattern (locked source for shift conflict checks)

- Saturday / شنبه: Sina ۲۰:۰۰–۰۲:۰۰ Sunday.
- Sunday / یکشنبه: Parsian ۲۰:۰۰–۰۸:۰۰ Monday.
- Tuesday / سه‌شنبه: Pardis ۱۴:۰۰–۲۰:۰۰.
- Wednesday / چهارشنبه: Di ۲۰:۰۰–۰۰:۰۰ Thursday.
- Thursday / پنج‌شنبه: Sina ۰۸:۰۰–۱۴:۰۰.
- Friday / جمعه: Parsian ۰۸:۰۰–۱۴:۰۰.
- Friday / جمعه: Parsian ۲۰:۰۰–۰۸:۰۰ Saturday.

The engine treats overnight shifts as continuous intervals crossing midnight. No reminder is generated for a shift itself.

## 6. Prior artifact / reliability history

Previous HTML builds failed because of JavaScript Temporal Dead Zone issues:

- `$` selector helper was accessed before its initialization.
- During reminder integration, `partsOf` and timezone formatter dependencies were also referenced before initialization.
- The Windows launcher had an earlier Python literal/bytes comparison defect in a different build.

These caused the dashboard not to render or not to start. The current Stage A release has those initialization problems addressed. Do not copy code from earlier broken HTML versions unless necessary; use the `index.html` in this package as the current source of truth.

## 7. Current release: Stage A + Stage B implemented

The latest print schedule artifacts produced earlier in the project are also available as a four-week, single-page A4 RTL Word/PDF template using B Nazanin. Current Stage A work only modifies the HTML dashboard; do not unnecessarily regenerate those Word/PDF files unless requested.

Files in this package:

- `index.html` — merged dashboard + Stage A schedule editor and in-page reminder engine.
- `run_dashboard.py` — local HTTP server using Python Standard Library, bound only to `127.0.0.1:8765`. Restored on 2026-11-20 (it was missing from the export that reached this machine, which broke the launcher); supports `--no-browser` for automated checks, and reuses an already-running instance instead of erroring.
- `اجرای_داشبورد.bat` — Windows launcher (unchanged; calls `py run_dashboard.py`).
- `tests/run-tests.mjs` — reproducible Node-only regression suite: extracts the inline script, runs `node --check`, executes it in a `vm` sandbox with DOM/localStorage shims and a controllable clock, and asserts shift/reminder logic. No browser, no downloads, ~1 s.
- `run_tests.bat` — one-click Windows runner for the suite.
- `.gitignore` — version-control exclusions (Python cache, test tmp, `node_modules/`, tooling workspace).
- `README_FA.md` — Persian setup/use guide.
- `PROJECT_HANDOFF.md` — this project context.
- `TEST_REPORT.md` — test record.

**Version control:** the folder is now a git repository. Commit 1 = baseline of the delivered Stage A package; commit 2 = the infrastructure repair above. `index.html` was not modified in that repair.

### Reminder UI per activity

Each activity can have:

```json
{
  "enabled": true,
  "time": "09:00",
  "days": [0, 2, 5],
  "leadMinutes": 10
}
```

Day index convention: `0=Saturday`, `1=Sunday`, `2=Monday`, `3=Tuesday`, `4=Wednesday`, `5=Thursday`, `6=Friday`.

UI additions:

- reminder enable checkbox per task;
- time-of-day input;
- weekdays selector;
- lead time options 5/10/15 minutes;
- global reminder on/off control in header;
- in-dashboard reminder cards with “ثبت انجام” and “بستن”.

### Reminder engine behavior

- `Asia/Tehran` is the authoritative timezone.
- Checks every 15 seconds, on page focus and when tab becomes visible.
- Fires if current time is within a small 3-minute due window; does not replay stale reminders after long suspension.
- Does not remind for a task already marked complete that day.
- Prevents duplicate alerts by a unique key containing task id, event date, time and lead value.
- Checks both the reminder firing instant and the activity-duration interval against the shift pattern. If either conflicts with a shift, that occurrence is suppressed.
- Shift intervals include overnight spans and are evaluated across adjacent civil dates.
- Reminders are disabled per task by default; user configures them manually.
- Global master switch (`state.remindersEnabled`) pauses all reminders without deleting per-task settings.
- Reminder history stored in `state.reminderSent`, with pruning to keep a bounded set.
- Every occurrence shows an **in-page reminder card** (the only place with a «ثبت انجام» button).
- Stage B addition: when enabled, the same occurrence also raises a Windows/browser OS notification (`Notification API`), RTL Persian, tagged with the occurrence key so duplicates cannot stack; clicking it focuses the window. Construction failures fall back silently to the card.

### Stage B system-notification controls

- Header button «اعلان سیستم: روشن/خاموش» next to the reminder master switch.
- `Notification.requestPermission()` is called **only inside that button's click handler** (user gesture), never at load.
- Explicit handling for: unsupported browser, previously denied permission, declined prompt, and granted.
- Toggling off only flips `state.systemNotifications`; browser permission is left as-is.
- At fire time the engine re-checks live `Notification.permission === 'granted'`, so a permission revoked later in browser settings silently degrades to card-only.

### Storage and backup

- Existing storage key retained: `toloe-aram-v1`.
- Reminder settings are stored in each task's `reminder` object.
- Global toggle, system-notification preference (`state.systemNotifications`, default false) and de-duplication history are stored in top-level state properties.
- Export JSON backup `schemaVersion` is 4 (raised from 3 in Stage B). Older backups still import; missing fields fall back to defaults.
- Backup includes reminder settings and state; import logic preserves them, including the notification preference.
- `localStorage` is local to one browser profile/device. There is no automatic cross-device sync in Stage A.

## 8. Limitations (explicit, Stages A+B)

- The browser must remain open (any tab) and JavaScript running at reminder time. OS notifications work while the browser runs, including when the dashboard tab is in the background.
- Closing the browser entirely, OS sleep, shutdown, or aggressive tab throttling can delay or prevent alerts. Background-tab timers may fire late (engine window is 3 minutes).
- Windows Focus Assist / do-not-disturb can suppress the OS toast.
- No Service Worker, PWA, Push API, VAPID, backend or cloud scheduler: nothing is delivered while the browser is closed.
- No cross-device synchronization; each device/browser profile has independent local data. JSON backup/restore is manual transfer only.
- The real Windows toast and the real browser permission prompt are not covered by the automated suite; a manual check list is in `TEST_REPORT.md`.

## 9. Current tests

Two layers:

1. **Local reproducible suite (run before/after every change):**
   `node tests/run-tests.mjs` — **21/21 passed** on the user's Windows machine (2026-11-20).
   Covers script syntax, initial state shape, all seven shift intervals incl. overnight spans,
   end-exclusive boundaries, free-interval checks, reminder firing/dedup/shift-suppression/
   done-skip/global-pause, Stage B system-notification fire/off/denied/missing-API/permission-button
   paths, backup schemaVersion-4 payload, restore preserving the notification preference,
   and persistence round-trip.
2. **Prior browser-level run (container, 2026-11):** **19/19 passed** — details in `TEST_REPORT.md`.

Covered:

- initial render of four routine sections;
- three main navigation views;
- adding/saving a reminder;
- firing during a free non-shift interval;
- duplicate suppression;
- settings stored in the persistence adapter;
- suppression when a scheduled task intersects a shift;
- shift helper boundary checks;
- all seven configured shift categories, including overnight shifts;
- global reminder pause;
- backup JSON contains reminder fields;
- zero browser JavaScript/console errors.

Test environment note: browser navigation to container-local URLs was blocked by the execution environment, so DOM/interaction tests used Chromium `set_content` and a localStorage adapter shim. The scheduling logic and controls were exercised in a real Chromium runtime with controlled time, but a real Windows machine/browser has not yet been tested by the user. Do not claim Windows end-to-end verification.

## 10. Architecture decisions (do not silently supersede)

1. No paid API is required for Stage A.
2. Do not build a paid API dependency.
3. No reminders for shifts; only routine/study/non-shift activities.
4. No automatic rescheduling of missed activities.
5. Timezone is always `Asia/Tehran`, regardless of device timezone.
6. Stage A only; do not add PWA/Web Push/backend unless user explicitly selects the next stage.
7. Keep the Routine.html features when extending the dashboard; avoid replacing it with a stripped-down app.
8. Every code change must include regression tests and updated handoff/test files.

## 11. Next steps / possible future stages

These are options, not authorization to implement automatically:

### Stage C — PWA packaging

- Add `manifest.webmanifest`, icons, install instructions and service worker for app shell/offline assets.
- PWA installation alone does not provide reliable scheduled local notifications across all browsers.

### Stage D — Web Push, closed-browser and cross-device

- Requires HTTPS, Service Worker, Push API, VAPID keys, backend, database, push subscriptions per device, scheduler and lifecycle handling.
- Candidate low-cost infrastructure discussed: Cloudflare Workers + D1 + Cron Triggers. Re-check current free plan limits and platform compatibility before implementation.
- Backend becomes source of truth; localStorage alone is insufficient for device sync.

## 12. Agent execution protocol

Before changing the project:

1. Read this file and README.
2. Inspect current `index.html`; do not assume older versions are equivalent.
3. Preserve the user's locked schedule and UI behavior.
4. Make one small scoped change at a time.
5. Run the local suite: `node tests/run-tests.mjs` (it includes the `node --check` syntax pass). All green before and after the change.
6. Commit each scoped change to the git repository with a clear message; never rewrite the baseline commit.
7. Update `TEST_REPORT.md` and this handoff.
8. If the user asks for a delivery ZIP, export it after tests and commit are green.

User prefers incremental work and explicit tradeoffs. Do not propose doing the entire architecture in one large task.
