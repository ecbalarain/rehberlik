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

---

## 3) Architecture and stack (free-first)

### Frontend / PWA

- Host static app on Cloudflare Pages (HTML/JS/CSS, manifest, service worker). Pages hits don’t count toward Worker request billing; dynamic API calls do.
- Client handles prayer time calculations, offline caching (IndexedDB + service worker), and install prompts.

### Auth (anonymous, upgradeable later)

- Firebase Authentication (Spark) — anonymous sign-in via web SDK. Keep to documented free limits.

### Backend compute, APIs, scheduling

- Cloudflare Workers (Free) for all APIs (logs, goals, Hatim ops, invite codes, exports, push senders).
- Cron Triggers for reports aggregation and notification scans.
- Avoid Cloudflare Queues (paid); use Durable Objects + cron patterns instead.

### State and coordination

- Durable Objects (SQLite-backed) on the Free plan for per-circle coordination (claims, counters, broadcasts).

### Database (pick one)

- Option A — Cloudflare D1 (generous free tier): good for logs, goals, memberships, broadcast queues.
- Option B — Firebase Cloud Firestore (Spark): if chosen, Workers call Firestore via REST with a service account; verify Firebase ID tokens in Workers.

### Push notifications

- Standards-based Web Push (VAPID) from Workers. Store PushSubscription in D1/Firestore; fan-out via Workers. Works on Chromium/Firefox and installed iOS PWAs.

### Exports (CSV/PDF)

- Prefer client-side generation and direct download.
- If server files are needed, use Cloudflare R2 (Forever Free tier; zero egress fees) and provide signed links.

### “Free” guardrails

- Do not use Cloudflare Queues (requires paid plan). Use cron + Durable Objects.
- Do not use Firebase Cloud Functions on Spark (not available). Keep all server logic on Workers.
- Ignore Firebase Hosting limits by using Pages for hosting.

---

## 4) Two concrete free architectures

### Variant A — Cloudflare-heavy (simpler)

Pages (PWA) → Workers API → Durable Objects (coordination) → D1 (data) → R2 (optional exports)

- Firebase Auth only (anonymous)
- Pros: single data plane (D1), fewer credentials, easy push + cron
- Quotas to watch: Workers ~100k req/day free, D1 ~100k writes/day; DO available with SQLite backend

### Variant B — Firebase data + Cloudflare compute

Pages (PWA) → Workers API (verifies Firebase ID tokens) → Firestore (data) → R2 (optional)

- Firebase Auth (anonymous)
- Pros: Firestore’s offline SDK is excellent; rules can gate Rehber/member actions
- Quotas to watch: Firestore ~50k reads/day, ~20k writes/day; Workers ~100k req/day

---

## 5) Mapping features to components

- Auth-lite: Firebase Auth (anonymous) + token verification in Workers (B only)
- Auto/Manual logging, Goals, Hatim mgmt: Worker endpoints; Durable Objects for contention (claiming Juz); D1/Firestore for persistence
- Prayer Times + push: client computes; Workers schedule/send Web Push respecting quiet hours
- Reports: cron Worker aggregates; stream CSV/PDF to client or drop into R2
- Rehber Broadcasts: Durable Object maintains audience pointers + throttling; cron Worker fans out (no Queues)
- Localization/RTL, Offline, Install nudges: client-side PWA

---

## 6) Implementation plan

Week 1
- Finalize scope & ERD
- Create Cloudflare account; set up Pages project (connect repo)
- Initialize Workers with Wrangler; create dev/prod environments
- Set up Firebase project for Authentication (anonymous)

Week 2
- Implement base PWA shell (manifest, service worker, IndexedDB); RTL-ready UI
- Reading view with auto-logging, Wake Lock API, idle detection
- Choose database path (D1 or Firestore) and scaffold schema

Week 3
- Circle creation & Rehber dashboard
- Invite code endpoints (Workers) + Durable Object for circle coordination
- Store memberships and roles in D1/Firestore

Week 4
- Prayer time settings; location permission flow
- Web Push: generate VAPID keys; subscription storage; quiet-hour logic
- Cron Worker for notification scans

Week 5
- Reports aggregation in cron Worker; CSV/PDF client generation
- Optional: R2 export drops + signed links

Week 6
- Goals (user & circle level)
- Hatim claim/release/complete flows (Durable Objects)
- QA, accessibility, performance pass; beta rollout

---

## 7) Data model (key entities)

- User (Auth: Firebase UID or anonymous device-linked UID)
- Circle
- Membership (role: Rehber/member)
- Material
- ActivityType
- ActivityLog (source: auto/manual)
- Goal
- Hatim & HatimJuz (claims, status)
- Report
- Notification (push subscription refs)

---

## 8) Technical considerations

- Token verification: If using Firestore (Variant B), Workers verify Firebase ID tokens on write/read APIs
- Push on iOS: requires PWA install (Add to Home Screen) and permission
- Offline: full logging offline; reconcile/sync queue on reconnect
- Performance: target p95 page load < 2s on low-end mobile; batched writes; Worker CPU within free limits
- Budgets/quotas: stay within Workers/D1/Firestore/R2 free tiers

---

## 9) Next steps

- Decide Variant A (D1) vs Variant B (Firestore)
- Generate VAPID keys and storage plan for subscriptions
- Define D1 schema or Firestore collections + security rules
- Draft Worker routes: /auth/session, /logs, /goals, /hatim, /invite, /reports, /push
- Wireframe Reading View, Prayer Times Card, Hatim Flow, Rehber Dashboard
