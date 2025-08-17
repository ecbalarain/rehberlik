# Hizmet Tracker — README

This README describes the architecture, free-tier stack, and build plan for the Hizmet Tracker PWA based on Cloudflare (Pages/Workers/DO/D1) with Firebase Authentication (anonymous).

---

## 1) Overview

Hizmet Tracker is a mobile-first PWA that helps users log Qur’an reading, adhkār, duʿā, Tahajjud, fasting, and related activities. Circles are led by a Rehber who can view reports, set goals, manage Hatim readings, and send broadcasts.

---
## 2) Core features

- Auth-lite: Anonymous sign-in; circles join via Rehber invite code.
- Auto-logging: In-app reading auto-logs pages; per-page timing; Wake Lock API; idle prompts.
- Manual logging: For fasting, Tahajjud, etc.
- Prayer times: User-selectable authority; location-based times; opt-in push reminders.
- Reports: Auto-generated daily/weekly/monthly/yearly; CSV/PDF exports; optional server-side export drop.
- Goals: User and Rehber-assigned.
- Hatim management: Create Hatim; members claim Juz; completion tracked.
- Rehber broadcasts: Quiet-hour aware fan-out.
- Localization/RTL: English, Arabic, Turkish UI; RTL support.
- Offline-first PWA: Works offline; syncs when online; install nudges.
