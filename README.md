# Memorial Call — Clips & Voice Reactions

> **Product fork:** This repository (`dog-facetime-clips`) is the **interactive clip-library** line — prerendered idle/reaction video, keyword spotting, and random clip variety during FaceTime-style calls.
>
> The **still-image Ken Burns** memorial product remains in **[thorpemark/dog-facetime](https://github.com/thorpemark/dog-facetime)**. Do not merge clip-first behavior back into that repo without an explicit product decision.

A gentle memorial experience that simulates FaceTiming a beloved dog who has passed away — full-screen video, familiar reactions when you speak their name, and a warm call-like UI.

## Clips fork vs still-image app

| | **dog-facetime** (original) | **dog-facetime-clips** (this repo) |
|---|---------------------------|-----------------------------------|
| **Primary media** | Uploaded photos + Ken Burns motion | Prerendered MP4 idle + reaction clips |
| **Voice** | Maps phrases → photo motion presets | Maps phrases → reaction **buckets** → random clip |
| **Idle state** | Crossfading stills | Looping idle clip(s) |
| **Sharing** | Supabase memorial links | Same UX target; clip assets per memorial (planned) |
| **Status** | Production memorial sharing | v1 scaffold — see [`docs/CLIP_LIBRARY_PLAN.md`](docs/CLIP_LIBRARY_PLAN.md) |

**Next steps for Mark:** from home, pick **Murphy / Riley / Both** (photos are preloaded; Riley is the black huskita, Murphy is the other dog), or open **Clip Studio** (`/studio`) to refine framing, **Suggest prompt** → **Copy** into Grok Imagine (6s · 9:16, or Pika), and attach MP4s. See [`docs/CLIP_STUDIO.md`](docs/CLIP_STUDIO.md). Ken Burns photo mode stays as fallback until dual-mode is complete.

### Three call modes

| Mode | Photo | Notes |
|------|-------|-------|
| **Murphy** | [`web/public/modes/murphy.jpg`](web/public/modes/murphy.jpg) | Tan/ginger huskita, folded ears — the other dog, not Riley |
| **Riley** | [`web/public/modes/riley.jpg`](web/public/modes/riley.jpg) | Black-and-white huskita, upright ears — the black huskita |
| **Both** | [`web/public/modes/both.jpg`](web/public/modes/both.jpg) | Murphy left, Riley right — shared memorial |

These stills are the picker / Studio avatars and the default Clip Studio source photo (idle + key reaction slots). Demo calls stay on clip playback.

---

## Run Today (No Mac Required)

Use the **web app** in any modern browser:

```bash
cd web
npm install
npm run dev
```

Open the local URL on your PC, or on iPhone/iPad Safari at `http://YOUR_COMPUTER_IP:5173` (same Wi‑Fi).

See **[`web/README.md`](web/README.md)** for phone setup, speech recognition tips, and deployment.

### Deployed URL (GitHub Pages)

After enabling **Pages → Source: GitHub Actions** in repo settings, pushes to `main` publish:

**https://thorpemark.github.io/dog-facetime-clips/**

## Native iOS App (Future / With Mac)

The SwiftUI app in [`MemorialCall/`](MemorialCall/) targets iOS 17+ and requires Xcode on a Mac.

```bash
# Open in Xcode 15+
open MemorialCall/MemorialCall.xcodeproj
```

See the sections below for iOS-specific details (clips, keywords, CI).

---

## Repository Layout

| Path | Purpose |
|------|---------|
| **`web/`** | **Run now** — Vite + React web app for Safari/Chrome (PC, iPhone, iPad) |
| **`docs/CLIP_LIBRARY_PLAN.md`** | Architecture for clip buckets, phrase matching, storage, migration |
| **`docs/CLIP_STUDIO.md`** | How to add a dog / intent / phrase / clip; external generation workflow |
| **`web/src/data/reactionCatalog.ts`** | Shared seed buckets (fallback + first-load template) |
| **`web/src/data/clipStudioSeed.ts`** | Murphy / Riley / Both personality libraries + seed stills |
| **`web/src/data/callModes.ts`** | Three-mode picker metadata (who is which photo) |
| **`web/public/modes/`** | Murphy / Riley / Both stills |
| **`MemorialCall/`** | Native iOS app — requires Mac + Xcode |
| **`.github/workflows/deploy-web.yml`** | Builds & deploys `web/` to GitHub Pages |

## Web App Features

- Home / demo **three-mode picker**: Murphy, Riley, or Both, with preloaded stills
- Upload photos; crossfading Ken Burns playback during calls *(legacy still mode — kept until clip dual-mode ships)*
- **Clip Studio** (`/studio`) — per-dog intents, phrases, photo framing, **Suggest prompt** → **Copy** into Grok Imagine (6s · 9:16), attach MP4s
- **Clip-library direction:** idle loop + meaning-matched prerendered reactions (`/catalog` overview)
- **Call-screen photo controls** — Side-drawer Ken Burns speed (saved in browser), swipe or tap prev/next between photos
- **Portrait crop framing** — Drag a portrait frame on create/edit photos; zoom out for together shots
- Share links for family (`/m/:shareId`) — no account needed
- Secret edit links (`/edit/:editToken`) for owners
- Optional creator sign-in (magic link + Google) with **My memorials** dashboard
- **Clip Studio cloud sync** — same signed-in account on PC and iPhone shares dogs, generation stills, idle pick, and attached MP4s
- Incoming call → Accept → full-screen memorial call UI with front-camera self-view PiP
- Web Speech API keyword listening (debug panel fallback)
- Supabase backend with localStorage demo mode when env vars are missing
- Configurable `reactionCatalog.ts` (weighted clips + semantic matching) with `/catalog` viewer
- GitHub Pages deploy at `/dog-facetime-clips/` base path

## iOS App — Quick Start

1. Clone this repository.
2. Open `MemorialCall/MemorialCall.xcodeproj` in Xcode 15 or later.
3. Select an iPhone simulator (e.g. iPhone 15).
4. Press **⌘R** to build and run.

On first launch you'll complete a short onboarding (dog name, your name, optional memorial note), then tap **Start Memorial Call** to begin.

## Using the iOS App

| Screen | What it does |
|--------|--------------|
| **Onboarding** | Set dog name (default: Biscuit), owner name, memorial note |
| **Home** | Start a memorial call or edit settings |
| **Incoming Call** | FaceTime-style ring screen — Accept or Decline |
| **Active Call** | Full-screen looping dog video, PiP self-preview, mute/end controls |
| **Debug Panel** | Tap the ladybug icon during a call to manually trigger any reaction (essential for Simulator) |

### Behavior State Machine

```
idle → listen → react → cooldown → idle
```

- **idle** — loops the idle clip (dog looking at camera)
- **listen** — microphone active, Speech framework transcribes speech
- **react** — crossfades to a matching reaction clip (random pick within bucket — planned)
- **cooldown** — brief pause before returning to idle

## Replacing Placeholder Clips

Placeholder colored videos ship in both `web/public/clips/` and `MemorialCall/MemorialCall/Resources/Clips/`. Replace them with real footage of your dog.

### Naming Convention (v1 single-clip per rule)

| File | Purpose |
|------|---------|
| `idle.mp4` | Always-looping clip: dog calmly looking at camera (~3–6 s, seamless loop) |
| `react_biscuit.mp4` | Reaction when dog's name is spoken |
| `react_walk.mp4` | Reaction to "walk" phrases |
| `react_treat.mp4` | Reaction to "treat" / "cookie" |
| `react_good.mp4` | Reaction to "good boy/girl" |
| `react_no.mp4` | Reaction to "no" |
| `react_come.mp4` | Reaction to "come here" |
| `react_owner.mp4` | Reaction when owner's name is spoken |

### Multi-clip buckets (v1 target)

See [`docs/CLIP_LIBRARY_PLAN.md`](docs/CLIP_LIBRARY_PLAN.md) and `web/src/data/reactionCatalog.ts` for bucket layout, e.g. `clips/reactions/come/come_01.mp4`, `come_02.mp4`, …

### Clip Guidelines

- **Format:** H.264 MP4, 720×1280 (portrait) recommended
- **Idle:** 3–6 seconds, designed to loop seamlessly
- **Reactions:** 1–3 seconds, natural start/end (crossfade handles transitions)

## Keyword → Clip Mapping

Rules live in `web/public/keyword_rules.json` (web) and `MemorialCall/MemorialCall/Resources/keyword_rules.json` (iOS). The clips fork is migrating toward **`web/src/data/reactionCatalog.ts`** for phrase lists and multi-clip buckets.

```json
{
  "id": "walk",
  "phrases": ["walk", "go for a walk", "wanna walk"],
  "clipFileName": "react_walk.mp4",
  "priority": 8,
  "description": "Walk"
}
```

- **`{dogName}`** and **`{ownerName}`** are replaced at runtime from onboarding.
- Higher **priority** wins when multiple phrases match.
- Add new rules + matching `react_*.mp4` files to extend behavior.

## Microphone & Speech Recognition

### Web

Uses the **Web Speech API**. Chrome and Safari support it; Firefox does not — use the debug panel instead.

### iOS

The app uses Apple's **Speech** framework with on-device recognition when available. Privacy strings are in `Info.plist`:

- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`

## CI / No Mac

### Web (GitHub Pages)

Workflow: [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml)

**One-time setup:** GitHub → Settings → Pages → Source → **GitHub Actions**

### iOS Simulator Build

You don't need a Mac to verify the iOS project builds. GitHub Actions compiles it on `macos-latest` for the iOS Simulator — no signing secrets required.

| Setting | Value |
|---------|-------|
| **Workflow** | [`.github/workflows/ios-simulator-build.yml`](.github/workflows/ios-simulator-build.yml) |
| **Xcode project** | `MemorialCall/MemorialCall.xcodeproj` |
| **Scheme** | `MemorialCall` |

Download artifacts from GitHub → **Actions** → select run → **Artifacts**.

> Simulator builds run in Xcode Simulator on a Mac; they cannot be installed on a physical iPhone without a device-targeted rebuild.

## Simulator / Browser Tips

- **Web on desktop:** Use the 🐞 debug panel to trigger reactions, or type phrases in the debug input.
- **Web on iPhone:** Allow microphone in Safari; speak naturally during a call.
- **iOS Simulator:** Limited microphone — use the debug panel (ladybug button).

## TODO / Next Steps (clips fork)

- [x] Weighted catalog + meaning match + `/catalog`
- [x] Clip Studio (`/studio`) — per-dog intents/phrases/slots, photo framing, attach MP4
- [ ] Dual mode: Ken Burns photos **or** clip library per memorial
- [ ] Supabase Storage bucket for per-memorial clip sets
- [x] Preload Murphy / Riley / Both stills into picker, Studio, and seed slots
- [ ] Generate Murphy/Riley/Both portrait reactions (Pika / Gemini / Grok) and attach in Studio
- [ ] iOS catalog sync
- [ ] Porcupine wake-word integration (iOS) for faster keyword detection
- [ ] Custom ringtone / memorial sound

## Supabase Setup (Web Sharing)

See **[`web/README.md`](web/README.md)** and **[`docs/CLIP_STUDIO.md`](docs/CLIP_STUDIO.md)** (Sync Studio across devices). Summary:

1. Reuse the existing **Dog_memorial_facetime** project (`cqmkcuchmnehnpizapqy`) — clips does not need its own Supabase project.
2. Run [`web/supabase/migration.sql`](web/supabase/migration.sql) in the SQL editor
3. Run [`web/supabase/migration_auth_owners.sql`](web/supabase/migration_auth_owners.sql) for creator accounts
4. Run [`web/supabase/migration_studio_library.sql`](web/supabase/migration_studio_library.sql) for Clip Studio cloud sync (tables + private `studio-media` bucket + RLS)
5. Configure Auth **Redirect URLs** — add `https://thorpemark.github.io/dog-facetime-clips/` (keep the stills-app URL if this project already serves dog-facetime). See [`web/README.md`](web/README.md).
6. Copy `web/.env.example` → `web/.env` with your URL and anon key
7. Rebuild / redeploy

For GitHub Pages, add repository secrets (no extra names):

- `VITE_SUPABASE_URL` — `https://cqmkcuchmnehnpizapqy.supabase.co`
- `VITE_SUPABASE_ANON_KEY` — anon/public key from that project

If they are missing, Pages stays in local demo mode (each browser is its own silo). Re-run the deploy workflow after adding them.

## License

Private memorial use prototype. Replace placeholder clips with your own footage.
