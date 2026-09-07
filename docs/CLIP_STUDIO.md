# Clip Studio

Clip Studio (`/studio`) is the editor for **per-dog reaction libraries**. Generation happens **outside** the app (Pika, Gemini, Grok, or anything else). The app stores source still + framing + prompt + weight + attached MP4.

Demo persistence uses **localStorage** (library JSON) and **IndexedDB** (photos/videos) when Supabase secrets are missing. Nothing here calls a live video API.

## Add a dog

1. Open **Clip Studio**.
2. Type a name in **New dog name** → **Add dog**.
3. Edit the personality notes (first line = breed; following lines = character). New clip prompts pick this up.

Murphy and Riley ship as seed dogs (huskitas). Reset seed from the bottom of Studio if you want to start over in this browser.

## Add an intent (bucket)

1. Type a label (e.g. `belly rub`) → **Add intent**.
2. Set **priority** (higher wins close matches), **semantic hints** (paraphrases for meaning match), and **phrases** (keyword fallback).
3. Expand the intent to edit clip slots.

Intent ids are slugs (`belly-rub`). You do **not** edit TypeScript unions for each new intent.

## Add a phrase

In an expanded intent: type the phrase → **Add phrase**. Lowercased automatically. `{dogName}` / `{ownerName}` still work in seed phrases.

## Add a clip variant

1. **Add clip variant** on the intent.
2. **Add photo** (same framing feel as the still-image app: portrait + landscape/PC, crop handles, zoom, rotation).
3. Edit the **prompt** (personality is already baked in) → **Copy prompt**.
4. Generate the video in Pika / Gemini / Grok (or another tool). Label `generatorUsed` if you want (optional).
5. **Attach MP4**. Status becomes `video_attached`.
6. Retry: **Replace video** or **Mark needs redo**.

Statuses: `empty` → `photo_ready` → `video_attached`, or `needs_redo`.

Colored placeholder MP4s are **demo only** and do not count as attached.

## External generation workflow

1. Frame the source still in Studio so the crop matches the FaceTime portrait (and landscape if you care about desktop).
2. Copy the slot prompt. Keep camera distance consistent across a dog.
3. Image-to-video in your tool of choice. Target ~1–3s, portrait ~9:16, H.264 MP4, usually silent.
4. Reject morphing / identity drift. Attach the keeper, or mark **needs redo**.
5. Optional: later commit keepers under `web/public/clips/reactions/{intent}/{intent}_{nn}.mp4` for GitHub Pages.

Weights are relative (40/30/30 ≡ 4/3/3). Playback picks with `pickWeightedClip`.

## Catalog vs Studio

| Page | Role |
|------|------|
| `/studio` | Editor (dogs, intents, phrases, photos, framing, prompts, videos) |
| `/catalog` | Read-only table + phrase tester for the selected dog |
| `/demo?dog=Riley` | Sample call using that dog’s library (no memorial photos → clip mode) |

Playback and matching read the Studio library for the active dog name (Murphy / Riley / whatever you added).
