# Memorial Call — Web App

<!-- deploy trigger: GitHub Pages workflow (path filter web/**) -->

> **Clips fork:** This web app lives in [dog-facetime-clips-clips](https://github.com/thorpemark/dog-facetime-clips-clips). Voice reactions target prerendered clip buckets (`src/data/reactionCatalog.ts`). The still-image Ken Burns product is [dog-facetime-clips](https://github.com/thorpemark/dog-facetime-clips).

A browser-based memorial video call experience. Create personal dog memorials, upload photos, share a link with family, and call one dog or two together — no account needed.

## Quick Start (Local)

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Without Supabase env vars, the app runs in **demo mode** (memorials saved in `localStorage`). A banner reminds you to connect Supabase for real sharing.

### Try on Your Phone Tonight

1. Run `npm run dev` on your computer.
2. Find your computer's local IP (e.g. `192.168.1.42`).
3. On iPhone/iPad (same Wi‑Fi), open Safari → `http://YOUR_IP:5173`
4. Tap **Create a Memorial**, add photos, copy the share link, open it on your phone.

> **Tip:** For HTTPS on mobile (some browsers require it for mic), use a tunnel like [ngrok](https://ngrok.com/) or deploy to GitHub Pages (below).

## Supabase Setup (Sharing)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, paste and run [`supabase/migration.sql`](supabase/migration.sql).
3. Run [`supabase/migration_auth_owners.sql`](supabase/migration_auth_owners.sql) for creator accounts and **My memorials**.
4. If upgrading an existing project, also run [`supabase/migration_focal_point.sql`](supabase/migration_focal_point.sql) for portrait focal points.
5. In **Authentication → URL Configuration**, set:
   - **Site URL:** `https://thorpemark.github.io/dog-facetime-clips/`
   - **Redirect URLs:** `https://thorpemark.github.io/dog-facetime-clips/` and `http://localhost:5173/` (local dev)
   - Magic links land on site **root** (not `/my`) so GitHub Pages serves `index.html` reliably; the app then navigates to My memorials.
6. Enable **Email** magic links (default). Optionally enable **Google** under Authentication → Providers.
7. Copy `web/.env.example` → `web/.env` and set:
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Project Settings → API → `anon` `public` key
8. Rebuild and redeploy (`npm run build` locally, or push to `main` for GitHub Pages).

After setup, memorials are stored in Supabase with public share links (`/m/:shareId`) and secret edit links (`/edit/:editToken`). Photos upload to the `memorial-photos` storage bucket.

### Creator accounts

Signed-in creators get memorials attached to their account (`owner_id`). Visit **My memorials** (`/my`) to copy share/edit links anytime.

- **Magic link email** — no password; works well on iPhone
- **Google** (optional) — enable in Supabase Auth providers
- **Anonymous create** still works — sign in afterward to claim memorials created in the same browser session

### Sign-in troubleshooting (Gmail / magic links)

Magic links redirect to `https://thorpemark.github.io/dog-facetime-clips/` (site root with base path). If Supabase **Redirect URLs** omit `/dog-facetime-clips/` or point at `/my` only, users can hit 404s or refresh loops.

**Gmail** often prefetches links in email, which can consume a one-time magic link before you tap it. If the link fails:

1. On the sign-in screen, enter the **6-digit code** from the same email (recommended).
2. Or open the link in **Safari/Chrome** (⋯ → Open in Safari) — not Gmail’s in-app browser.

**Photo upload troubleshooting:** The web app never inserts into `media_assets` directly — uploads go to storage at `{editToken}/{targetId}/…` and rows are created only via the `register_media_asset` RPC (tables have RLS with no anon INSERT policies). If registration fails with an RLS error, re-run [`supabase/migration.sql`](supabase/migration.sql) so the SECURITY DEFINER RPCs are present. Storage bucket policies can be relaxed to `bucket_id = 'memorial-photos'` only; the code fix above is still required for `media_assets`.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Home — Clip Studio, memorial create, open a link, sign in |
| `/studio` | Clip Studio — per-dog intents, phrases, photo framing, prompts, attach MP4s |
| `/catalog` | Reaction catalog — read-only table + phrase tester |
| `/demo` | Sample clip-mode call (`?dog=Riley` to pick a library) |
| `/create` | Step-by-step memorial creation |
| `/my` | My memorials — list owned memorials, sign in |
| `/m/:shareId` | Public share — pick who to call, start FaceTime UI |
| `/edit/:editToken` | Owner edit — photos, names, regenerate share link |

## Production Build

```bash
cd web
npm run build    # outputs to web/dist
npm run preview  # serve dist locally
```

## Deploy to GitHub Pages

A workflow at [`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml) builds and deploys `web/` on every push to `main`.

**One-time repo settings:**

1. GitHub → **Settings** → **Pages** → set **Source** to **GitHub Actions**
2. GitHub → **Settings** → **Secrets and variables** → **Actions** → add:
   - `VITE_SUPABASE_URL` — Supabase Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — Supabase Project Settings → API → `anon` `public` key

If these secrets were added **after** the first deploy, the live site stays in demo mode until you **re-run** the workflow: **Actions** → **Deploy Web App to GitHub Pages** → **Run workflow** (or push a new commit to `main`).

The build sets `GITHUB_PAGES=true` so Vite uses base `/dog-facetime-clips/` and emits `404.html` (SPA fallback for `/create`, `/m/:id`, `/edit/:token`).

After the next push to `main`, the site will be live at:

**https://thorpemark.github.io/dog-facetime-clips/**

(Replace `thorpemark/dog-facetime-clips` with your fork if different.)

## Using the App

| Screen | What it does |
|--------|--------------|
| **Home** | Create a memorial, paste a share link, sign in |
| **My memorials** | List your memorials, copy share/edit links |
| **Create flow** | Memorial name → Dog 1 photos → optional Dog 2 → optional Together → copy links |
| **Share page** | Pick who to call (when multiple dogs), optional your name |
| **Incoming Call** | FaceTime-style ring — Accept or Decline |
| **Active Call** | Crossfading photos with Ken Burns motion, side-drawer speed control + swipe/button photo nav, keyword reactions, debug panel |
| **Edit page** | Upload photos, set portrait focal points, rename dogs, regenerate share link |

### Photo Playback (v1)

Uploaded photos are shown with a respectful “alive” presentation:

- Idle: crossfading stills with subtle Ken Burns / breathing motion
- Reactions: alternate photos + stronger motion presets (perk / excited / calm)
- Structure supports swapping in real MP4 clips per reaction later

**Call-screen controls** (photo mode only):

- **Speed** — Compact side drawer tab (right edge, above call controls) expands to Slow / Normal / Fast; preference saved in `localStorage`; auto-collapses after selection or a few seconds
- **Manual navigation** — Swipe left/right on the photo area (touch or mouse drag), or tap the photo to reveal prev/next chevrons; auto-advance pauses ~10s after a manual change, then resumes
- **During reactions** — Manual navigation is disabled while a keyword reaction is playing; the slideshow returns to the pre-reaction photo when the reaction ends

**Portrait framing (focal frame):**

- On create/edit, tap a photo to set **two saved crops**: phone portrait and landscape/PC
- Resize with corner/edge handles (width and height), pan with Move frame, tap to focus, nudge with arrows, and fine-tune straightening with the **Rotate** slider (−15° … +15° per orientation)
- Stored per photo as portrait `focal_x` / `focal_y` / optional `focal_crop_w` / `focal_crop_h` / `focal_rotation_deg` plus landscape `landscape_focal_*` columns (legacy `focal_zoom` kept as derived metadata)
- During calls, the app picks the matching framing when the viewport is portrait vs landscape (phone rotation or desktop widescreen)
- Together / group photos default to slightly wider framing on landscape images
- Existing Supabase projects: run [`supabase/migration_focal_point.sql`](supabase/migration_focal_point.sql), [`supabase/migration_focal_zoom.sql`](supabase/migration_focal_zoom.sql), [`supabase/migration_focal_crop.sql`](supabase/migration_focal_crop.sql), [`supabase/migration_focal_orientation.sql`](supabase/migration_focal_orientation.sql), then [`supabase/migration_focal_rotation.sql`](supabase/migration_focal_rotation.sql) after the base migration

Without uploaded photos, placeholder MP4 clips from `public/clips/` are used.

### Behavior Flow

```
idle → listen → react → cooldown → idle
```

- **idle** — loops the idle clip
- **listen** — microphone + Web Speech API transcribes speech
- **react** — crossfades to a matching reaction clip
- **cooldown** — brief pause before returning to idle

## Speech Recognition

Uses the **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`):

| Browser | Support |
|---------|---------|
| Chrome (desktop/Android) | ✅ Full |
| Safari (iOS/macOS) | ✅ With mic permission |
| Firefox | ❌ Use debug panel + typed phrases |

When speech isn't available, use the **Debug Panel** (🐞 button):

- Tap reaction buttons to fire clips manually
- Type a phrase and press **Send** (e.g. "good boy", "walk")

## Keyword → Clip Mapping

**Source of truth:** [`src/data/reactionCatalog.ts`](src/data/reactionCatalog.ts).

Each intent bucket has seed `phrases`, `semanticHints`, and weighted `clips`. During a call, `matchTranscript` scores meaning (n-gram + synonyms) with keyword fallback; `pickWeightedClip` then rolls a variant by weight.

Inspect the live table at **`/catalog`** (also linked from the landing page). You can tweak weights in the browser (localStorage); lasting edits belong in `reactionCatalog.ts`.

`public/keyword_rules.json` is a static copy kept for compatibility. Playback no longer depends on a single `clipFileName` per rule.

- `{dogName}` and `{ownerName}` are replaced from the memorial profile.
- Higher **priority** wins near-ties. If the best score is below the confidence threshold, the call stays on idle.
- Missing MP4s skip to another variant, then idle.

## Replacing Placeholder Clips

Placeholder colored videos ship in [`public/clips/`](public/clips/). Replace with real footage of your dog:

| File | Purpose |
|------|---------|
| `idle.mp4` | Always-looping clip (~3–6 s, seamless loop) |
| `react_biscuit.mp4` | Dog's name spoken |
| `react_walk.mp4` | "walk" phrases |
| `react_treat.mp4` | "treat" / "cookie" |
| `react_good.mp4` | "good boy/girl" |
| `react_no.mp4` | "no" |
| `react_come.mp4` | "come here" |
| `react_owner.mp4` | Owner's name spoken |

**Format:** H.264 MP4, 720×1280 portrait recommended.

## Alternative: Deploy to Vercel

1. Import this repo at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** to `web`
3. Deploy — Vercel auto-detects Vite

No `GITHUB_PAGES` env var needed; Vercel serves from `/`.

## Project Structure

```
web/
├── public/
│   ├── clips/              # Fallback video assets (no photos)
│   └── keyword_rules.json  # Phrase → reaction mapping
├── supabase/
│   ├── migration.sql              # One-paste Supabase setup
│   └── migration_auth_owners.sql  # Owner accounts & My memorials RPCs
├── src/
│   ├── components/         # UI screens
│   ├── context/            # Call state machine
│   ├── hooks/              # Photo playback, speech
│   ├── services/           # Memorial CRUD (Supabase + demo)
│   └── utils/              # Keyword matching, motion presets
├── .env.example
├── index.html
├── vite.config.ts
└── package.json
```

## Related

The native iOS app lives in [`MemorialCall/`](../MemorialCall/) — requires a Mac with Xcode. Use **`web/`** to run the experience today in any browser.
