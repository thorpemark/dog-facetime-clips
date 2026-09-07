# Clip Studio

Clip Studio (`/studio`) is the editor for **per-dog reaction libraries**. Generation happens **outside** the app (Grok Imagine, Pika, Gemini, or anything else). The app stores source still + framing + prompt + weight + attached MP4.

Demo persistence uses **localStorage** (library JSON) and **IndexedDB** (photos/videos) when Supabase secrets are missing. Nothing here calls a live video API. **Suggest prompt** is a local template composer — no API key, works on GitHub Pages.

## Add a dog

1. Open **Clip Studio**.
2. Type a name in **New dog name** → **Add dog**.
3. Edit the personality notes (first line = breed; following lines = character). Suggest prompt and new clip slots pick this up.

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
3. Optional: type **slot notes** for this variant (director extras).
4. **Suggest prompt** → edit if you want → **Copy**.
5. Generate the video in Grok Imagine / Pika / Gemini (image-to-video from the still). Label `generatorUsed` if you want (optional).
6. **Attach MP4**. Status becomes `video_attached`.
7. Retry: **Replace video** or **Mark needs redo**. Re-suggest anytime.

Statuses: `empty` → `photo_ready` → `video_attached`, or `needs_redo`.

Colored placeholder MP4s are **demo only** and do not count as attached. Slots that still need a video highlight the Suggest → Copy row.

## Suggest prompt → Copy → Grok Imagine

This is the main generation loop. It is fully offline in the browser.

1. Pick a slot that still needs a video. Add and frame a source still (portrait FaceTime crop).
2. Click **Suggest prompt**. The composer fills the textarea from:
   - dog name + breed notes (huskita / Husky × Akita)
   - intent (treat, hug, howl, come, …)
   - seed personality, including:
     - **Riley hug:** bares teeth / soft growl when her side is touched or she is asked for a hug (warning, not an attack)
     - **Murphy hug:** loves the hug, chest scratch, nose up offering his neck
     - **Murphy howl:** strong, confident sing
     - **Riley howl:** awkward, weak howl attempt
   - this slot’s label + optional slot notes
   - framing context when a photo is attached (portrait FaceTime, keep identity)
   - a **6 second** Grok Imagine arc: start near calm idle from the still → reaction peaks in the first ~2–3s → smoothly return to calm FaceTime idle (soft blinks, subtle breathing, looking toward camera) and hold through the end. Same dog, same framing, no zoom / cut / morph.
   - **audio / mouth rules** (stated at the top of the prompt and repeated at the end): the dog never speaks, talks, or mouths English. Howling is howl-only (see below).
3. **Copy** (toast confirms). Paste into **Grok Imagine** as an **image-to-video** prompt, with the framed still as the source image.
4. In Grok Imagine, length options are **6 / 10 / 15s** (there is no 3–4s). Use **6s**, **9:16 portrait**, H.264 MP4, usually silent. Reject morphing / breed drift / extra dogs / talking dogs / clips that keep reacting until the last frame.
5. **Attach MP4** back on the same slot.

You can edit the prompt after Suggest, then Copy again. Suggest again to rebuild from the current dog / intent / notes / framing.

### Howl-only vocalization

Grok Imagine will invent a howl or talking-dog mouth if the prompt is vague. Suggest prompt is strict:

- **Never:** dialogue, human speech, talking, English words, lip-sync talking.
- **Howl / bay / sing / long open-mouth vocal:** only for **howl** or **sing** intents (or a slot note that explicitly says `responds to a howl`).
- **Name, come, here, owner, attention, eye-contact, perk-up:** ears perk + eye contact only. The prompt says **does not howl**.
- **Treat, walk, good dog, hug, play, idle, and everything else that is not howl/sing:** no howl, no bay, no singing. Soft dog sounds only (quiet pant, soft huff, tiny whine) or silence. Mouth mostly closed.
- **Riley hug** may show teeth and a soft growl. That is still **not** a howl.
- Murphy/Riley personality lines about howling are **omitted** from non-howl prompts so a name clip cannot pick up “sings and howls well.”

Reject keepers where the dog talks, howls on a non-howl slot, or holds a howl-gape.

### SuperGrok vs an API key

A **SuperGrok** (or Grok) subscription lets you generate **in grok.com / the X apps**. That is **not** an xAI API key.

Clip Studio does **not** call Grok from GitHub Pages. In-app **Generate with Grok** would need a separate `VITE_XAI_API_KEY` later. Until then, Suggest stays a local template so Pages keeps working with no secrets.

## External generation workflow

1. Frame the source still in Studio so the crop matches the FaceTime portrait (and landscape if you care about desktop).
2. Suggest prompt → Copy. Keep camera distance consistent across a dog.
3. Image-to-video in Grok Imagine (or Pika / Gemini). Grok Imagine: **6s** (not 3–4s), **9:16 portrait**, H.264 MP4, usually silent. The suggested prompt already asks for react-then-return-to-idle so the extra seconds stay as a loopable FaceTime hold.
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
