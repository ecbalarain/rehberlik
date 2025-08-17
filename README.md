# Rehber Reading PWA

A **SvelteKit** progressive web app running on **Cloudflare Pages** with **Pages Functions/Workers**, built for reading and tracking PDFs (with future EPUB/image support), running fully **offline**, and organized around **circles** led by **rehbers**.

Auth is **passwordless** via **Passkeys (WebAuthn)** with optional **email/phone/secret UID** for recovery/sync. Reading time and pages are tracked with an **OCR-driven anti-abuse** model. Rehbers can create circles, upload resources for members, view progress leaderboards, and send **push notifications**.

> This README is derived from the project’s Technical Plan (Draft 2) you approved.

---

## ✨ Features

- **Offline-first PWA**: read and track without connectivity; sync later via Background Sync.
- **PDF reader with pagination**: *Next Page* marks current page as read; *Go to Page* supported; bookmarks + resume page.
- **Single-page duas**: press **+**/long-press to count as read; measured time; subtle success animation.
- **Full-text search** inside PDFs (including image-based PDFs via **OCR**).
- **Role-based circles**: rehbers (leaders) create/manage circles; users can join (limits enforced).
- **Announcements**: rehbers broadcast via **push notifications** (delivered even when the app is closed).
- **Leaderboards**: daily / weekly / monthly totals for pages and time.
- **No PDF exporting**; access via secure proxy only.
- **Quotas & limits**: per-user and per-rehber storage, file size cap, and page-turn rate guards.
- **Privacy**: country is assigned on first use via IP guess and shown in circle aggregates.
- **Extra activities tracking**: Teheccüd, Sadaqa, Awwabin, other nafl prayers, fasting.

---

## 🏗️ Architecture

- **Frontend**: SvelteKit + `@sveltejs/adapter-cloudflare` (SSR shell + reader island).
- **Backend**: Cloudflare **Pages Functions** (Workers runtime) for APIs.
- **Storage & Data**:
  - **R2**: book files, covers, thumbnails.
  - **D1**: relational data (users, circles, books, events, activities, quotas, announcements).
  - **KV**: caches, feature flags, config.
  - **Queues**: OCR/metadata ingestion, push fan-out, anti-cheat aggregation.
- **Country detection**: IP guess at first signup.
- **Security**: Passkeys + (email/phone/secret UID) recovery, Turnstile, rate limits, signed R2 access (no direct downloads).

---

## 📁 Project Structure (planned)

```
/rehber-pwa
  package.json
  svelte.config.js
  vite.config.ts
  wrangler.toml                # Cloudflare bindings
  /src
    app.d.ts
    lib/
      api.ts                   # fetch helpers (retries/Turnstile header)
      idb.ts                   # IndexedDB queues (events, activities)
      tracking.ts              # timers, clamps, anti-abuse guards
      ocr.ts                   # types for page_stats/index
    routes/
      +layout.svelte
      +layout.ts               # load user/circle context
      +page.svelte             # dashboard / library
      reader/[bookId]/+page.svelte
      reader/[bookId]/+page.ts
      circles/+page.svelte
      circles/[id]/+page.svelte
      auth/+page.svelte        # passkeys + recovery
      api/
        auth/register/+server.ts
        auth/login/+server.ts
        auth/link-contact/+server.ts
        upload/signed-url/+server.ts
        books/+server.ts
        books/[id]/+server.ts
        books/[id]/page/[n]/+server.ts  # HTTP Range proxy (no direct download)
        events/batch/+server.ts
        activities/batch/+server.ts
        circles/+server.ts
        circles/[id]/invite/+server.ts
        circles/[id]/join/+server.ts
        circles/[id]/members/+server.ts
        circles/[id]/metrics/+server.ts
        circles/[id]/announcements/+server.ts
  /public
    icons/manifest + PWA icons
  /migrations
    001_init.sql
    002_indexes.sql
/workers
  queues-consumer/
    wrangler.toml
    src/index.ts               # OCR & push consumers
```

---

## 🔐 Authentication (passwordless)

- **Passkeys (WebAuthn)** for registration/sign-in.
- **Recovery** options: **email**, **phone**, or **secret UID** (a long random identifier the user stores privately; can be displayed/QR).
- All recovery routes protected with **Turnstile** and rate limits.
- No usernames or passwords.

---

## 📦 Quotas & Limits (defaults)

- **File size** ≤ **200 MB**.
- **User personal quota**: **100 MB** total.
- **Rehber circle quota**: **500 MB** total (plus **100 MB** personal like others).
- **Circles per rehber**: **2**.
- **Circles per user**: **2**.
- **Max page seconds**: **360 s** (6 min); **page-turn burst**: ~**30/min** (tunable).

---

## 🔎 OCR-driven Anti-Abuse & Search

**Per page stats** produced at ingestion (Queue):
- `page_tokens` (word count), `line_count`, `has_text_layer`, `page_search_text`.

**Minimum time per page**:
```
min_sec(page) = clamp(
  base_floor,
  max( ceil(page_tokens / WPS_MIN), ceil(line_count / LPS_MIN) ),
  hard_cap
)
```
Defaults: `base_floor=3s`, `WPS_MIN=4 words/s`, `LPS_MIN=1.2 lines/s`, `hard_cap=90s`, `MAX_PAGE_SECONDS=360s`.

- **Empty pages** (0 tokens & 0 lines) **don’t count** on Next.
- **Single-page duas**: measure **actual time** until tap “+”/long-press; clamp to `MAX_PAGE_SECONDS`.

**Search**: Build a simple per-book inverted index (`token → pages`) in D1; can evolve to FTS later.

---

## 🧰 API Outline (examples)

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/link-contact`  
- **Upload**: `POST /api/upload/signed-url` → signed PUT to R2 (enforce quotas)  
- **Books**: `GET /api/books`, `GET /api/books/:id`, `GET /api/books/:id/page/:n` (HTTP Range proxy)  
- **Events**: `POST /api/events/batch` (reading logs)  
- **Activities**: `POST /api/activities/batch`  
- **Circles**: `POST /api/circles`, `POST /api/circles/:id/invite`, `POST /api/circles/:id/join`, `POST /api/circles/:id/members`, `GET /api/circles/:id/metrics`  
- **Announcements**: `POST /api/circles/:id/announcements`, `GET /api/circles/:id/announcements`  
- **Quotas**: `GET /api/quota`

---

## ⚙️ Local Development

### Prerequisites
- **Node.js** (LTS) and **pnpm** or **npm**
- **Wrangler** (`npm i -D wrangler`) for local Pages dev and D1/KV/R2 management.

### First run
1. Create the SvelteKit app and install deps (or clone your repo).
2. Add `@sveltejs/adapter-cloudflare` and configure `svelte.config.js`.
3. Create **D1** database and apply migrations:
   ```bash
   wrangler d1 create rehber_db
   wrangler d1 execute rehber_db --file=./migrations/001_init.sql
   wrangler d1 execute rehber_db --file=./migrations/002_indexes.sql
   ```
4. Configure **wrangler.toml** bindings (D1/KV/R2/Queues, VAPID, Turnstile).
5. Start local dev (Pages + Functions):
   ```bash
   wrangler pages dev . --compatibility-date=2025-08-17
   ```

### Useful commands
```bash
# Tail logs from Functions
wrangler tail

# Check D1
wrangler d1 execute rehber_db --command "SELECT name FROM sqlite_master WHERE type='table';"
```

---

## 🚀 Deploying to Cloudflare Pages

1. Create a Pages project and connect your Git repo.
2. Set **Build command** to your SvelteKit build (e.g., `npm run build`).  
   Set **Output directory** to your adapter’s output (for SvelteKit + adapter-cloudflare, Pages will wire Functions automatically).
3. Add **Environment Variables & Bindings**:
   - `DB_D1` (D1), `KV_APP` (KV), `R2_FILES` (R2), `OCR_QUEUE`, `PUSH_QUEUE` (Queues)
   - `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
   - `APP_ENV=production`
4. Promote Preview → Production when ready.

---

## 🗄️ Data Model (high-level)

- **users**: id, passkey credentials, contact (optional), country, profile
- **circles** & **circle_members** (status/role)
- **books** (R2 key, metadata, placement: personal/circle/global)
- **reading_progress** (last_page, percent)
- **reading_events** (page_read/page_jump/single_mark, duration, ts)
- **activities** (extra practices)
- **announcements** & **push_subscriptions**
- **page_stats**, **page_index** (OCR/search)

> See `migrations/001_init.sql` and `migrations/002_indexes.sql` for details.

---

## 🔔 Notifications

- Users store **Web Push** subscriptions per device.
- Rehber announcements enqueue messages to **PUSH_QUEUE**; consumer performs fan-out.
- Service worker displays notifications and deep-links to the app.

---

## 📦 `wrangler.toml` (sample)

```toml
name = "rehber-pwa"
compatibility_date = "2025-08-17"

[vars]
APP_ENV = "production"

[[d1_databases]]
binding = "DB_D1"
database_name = "rehber_db"
database_id = "<uuid>"

[[kv_namespaces]]
binding = "KV_APP"
id = "<kv-id>"

[[r2_buckets]]
binding = "R2_FILES"
bucket_name = "rehber-files"

[triggers]
crons = ["0 3 * * *"] # nightly aggregation
```

---

## 🧵 Queues Consumer Worker (separate)

```toml
# workers/queues-consumer/wrangler.toml
name = "rehber-queues"
main = "src/index.ts"
compatibility_date = "2025-08-17"

[[queues.consumers]]
queue = "OCR_QUEUE"

[[queues.consumers]]
queue = "PUSH_QUEUE"
```

```ts
// workers/queues-consumer/src/index.ts (outline)
export default {
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
    for (const msg of batch.messages) {
      if (msg.queue === 'OCR_QUEUE') {
        // fetch PDF from R2, run Tesseract (WASM), write page_stats & page_index
      } else if (msg.queue === 'PUSH_QUEUE') {
        // fan-out Web Push to device subscriptions in D1
      }
    }
  }
}
```

---

## 🧪 Testing

- **Unit**: Vitest for stores/utilities.
- **E2E**: Playwright against `wrangler pages dev`.
- **Contract**: Schema validation for API payloads with **Zod** both client & server.

---

## 🗺️ Roadmap

- EPUB & image-sequence readers
- OCR accuracy tuning (Arabic/Turkish/English) + FTS index
- Rich highlights/notes
- Payments for paid circles
- Accessibility (screen reader, high-contrast, dyslexic-friendly font)
- Analytics dashboards for rehbers

---

## 📄 License

TBD by project owner.
