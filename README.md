# Tally

A personal, manual-first exam and task tracker, now backed by Supabase and
synced across every device you sign in on (web + the Capacitor Android app).

Nothing is auto-graded or auto-ranked — every exam result and task is
entered by hand. Every "intelligent" dashboard feature (Focus Now, Daily
Mission, Momentum, Milestones) is a deterministic function over that same
real data — no AI, no fabricated stats.

## What changed in this version

- **Syllabus, Deadlines, and History are removed** entirely (pages, stores,
  local database tables — gone).
- **Exam scheduling is redesigned around reusable configs.** An "exam
  config" is a named scoring template (e.g. your উদ্ভাসে ভার্সিটি 'ক' কোর্স)
  that defines, per exam type (daily/weekly/monthly): MCQ question count +
  marks each, written question count + marks each, and a negative mark per
  wrong MCQ. Add a new config once under **Exam configs**, then every time
  you add an exam you just pick the config + type and the structure
  auto-fills — you only type the actual result (correct/wrong/unanswered,
  written marks obtained). You can still add a fully custom exam with no
  config if you want to enter every number by hand.
- **Supabase replaces all local storage.** Dexie/IndexedDB is gone. Exams,
  tasks, exam configs, and settings all live in Postgres behind Row Level
  Security (each row is only visible to the account that created it) and
  sync in real time — a change made in the web app or the Android app
  appears on your other signed-in device within a second or two, no refresh
  needed.
- **Accounts:** email + password via Supabase Auth. Sign up, then sign in
  from any device to see the same data.
- **New visual pass:** refreshed color tokens (still your original Tally
  brand blue, now paired with a violet secondary accent for gradients),
  richer glass-card shadow/edge treatment, gradient primary buttons, and a
  soft fixed gradient wash behind the whole app.

## Supabase project

This build points at your existing Supabase project ("Tally - Syllabus &
Exam Tracker"). `.env` already has the project URL and a public/publishable
key filled in — those are safe to expose in a frontend; Row Level Security
is what actually protects the data. If you ever need to point this at a
different Supabase project, edit `.env` (copy `.env.example` for the
shape).

One thing worth checking in your Supabase dashboard: whether **email
confirmation** is required for new signups (Authentication → Providers →
Email). If it's on, a new account has to click the confirmation link
before they can sign in. If you'd rather skip that for a personal app,
turn it off there.

## Getting started

```bash
npm install
npm run dev       # start dev server
npm run build     # production build
npm run preview -- --host   # serve the production build locally
npm run android:sync   # build + sync into the Capacitor Android project
```

There's no local test suite in this build (the old one was tightly coupled
to the removed local-storage layer and got dropped along with it rather
than shipped broken).

## Features

- **Dashboard** — time-of-day greeting with a real data-driven summary
  line, a 7-day Momentum strip, a single "Focus Now" recommendation, a
  dismissible Daily Mission, and a configurable widget grid (today's tasks,
  next exam) — show/hide, reorder, comfortable/compact density, all from
  Settings.
- **Exams** — add against a reusable config (structure auto-fills) or fully
  custom. Records MCQ correct/wrong (unanswered is calculated automatically
  from the MCQ count), written marks obtained, manual score override, rank,
  participants, notes, reminder. Live score preview while entering results.
  The detail page compares the exam against the previous exam of the same
  type when one exists. Edit, duplicate, and delete.
- **Exam configs** — manage your reusable scoring templates: name,
  negative-marking rate, and per-type (daily/weekly/monthly) MCQ + written
  breakdown.
- **Tasks** — one-off or recurring (daily / weekdays / weekly / custom
  days), priority, category, notes, reminder offset.
- **Calendar** — month grid with exam/task dot markers, day agenda below.
- **Analytics** — average score, task completion rate, exam score trend
  chart, task completion trend chart, and real milestones.
- **Settings** — theme, glass/blur intensity, motion level, dashboard
  layout, notification permission + per-type toggles, account (sign out).

## Notifications

Set a reminder (minutes before) on any exam or task. On the native Android
build this schedules real OS-level local notifications that fire even if
the app is closed. In a browser, notifications can only fire while the tab
or installed PWA is actually open — that's a hard platform limitation, not
a bug here.
