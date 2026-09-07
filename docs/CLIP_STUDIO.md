# Clip Studio

Clip Studio (`/studio`) is the editor for **per-dog reaction libraries**. Generation happens **outside** the app (Grok Imagine, Pika, Gemini, or anything else). The app stores source still + framing + prompt + weight + attached MP4.

Demo persistence uses **localStorage** (library JSON) and **IndexedDB** (photos/videos) when Supabase secrets are missing. Nothing here calls a live video API. **Suggest prompt** is a local template composer — no API key, works on GitHub Pages.

## Add a dog

1. Open **Clip Studio**.
2. Type a name in **New dog name** → **Add dog**.
3. Edit the personality notes (first line = breed; following lines = character). Suggest prompt and new clip slots pick this up.

Murphy, Riley, and **Both** ship as seed dogs (huskitas) with baked stills in `web/public/modes/`. **Riley is the black huskita.** **Murphy is the other dog** (not Riley).

| Mode | Photo | Who |
|------|-------|-----|
| **Murphy** | `modes/murphy.jpg` | Tan/ginger huskita, folded ears — the other dog, not Riley |
| **Riley** | `modes/riley.jpg` | Black-and-white huskita, upright ears — the black huskita |
| **Both** | `modes/both.jpg` | Murphy on the left, Riley on the right |

Those stills are the Studio avatars, the home/demo three-mode picker cards, incoming-call faces, and the default source photo on **idle + name / come / hug / howl** slots. Other slots fall back to the dog-level still until you attach a different one. Reset seed from the bottom of Studio if you want to start over in this browser. Portrait framing is a sensible default — refine crops in Studio.

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
   - dog name + breed notes (huskita / Husky × Akita). **Riley = black huskita**; **Murphy = the other huskita** (keep them distinct; do not swap coats).
   - intent (treat, hug, howl, come, …)
   - seed personality, including:
     - **Murphy & Riley:** remarkably **non-vocal**; they express via face and body
     - **Riley hug:** silent warning face — bares teeth when her side is touched or she is asked for a hug (not an attack). No growl sound.
     - **Murphy hug:** loves the hug, chest scratch, nose up offering his neck, mouth closed
     - **Murphy howl:** strong, confident sing (howl/sing vocal exception)
     - **Riley howl:** awkward, weak howl attempt (howl/sing vocal exception)
     - **Play:** downward-dog play-bow (front low, rear up) plus one short sneeze-like challenge huff — not a bark
   - this slot’s label + optional slot notes
   - framing context when a photo is attached (portrait FaceTime, keep identity)
   - a **6s** Grok Imagine arc: reaction peaks in the first ~2–3s → return to calm FaceTime idle and hold. Camera stays perfectly still; only the dog moves.
   - **LOCKED CAMERA** on every Suggest (see below) so playback can return to idle without a framing reset.
   - **AUDIO first** (silence-first by default — see below). Prompts stay short.
3. **Copy** (toast confirms). Paste into **Grok Imagine** as an **image-to-video** prompt, with the framed still as the source image.
4. In Grok Imagine, length options are **6 / 10 / 15s** (there is no 3–4s). Use **6s**, **9:16 portrait**, H.264 MP4. Reject morphing / breed drift / extra dogs / talking dogs / camera moves / clips that keep reacting until the last frame.
5. **Attach MP4** back on the same slot. If Grok still adds bark, music, or other audio, **strip the audio before attaching** — post mute is normal.

You can edit the prompt after Suggest, then Copy again. Suggest again to rebuild from the current dog / intent / notes / framing.

### LOCKED CAMERA — only the dog moves

Playback returns to the idle still/clip. If Grok pans, zooms, or reframes, the last frame no longer matches idle and the call has to “reset.” Suggest therefore puts a **LOCKED CAMERA** block on every prompt (howl and play included):

- Camera **perfectly still**.
- **No** pan, tilt, dolly, zoom, push-in, pull-out, handheld shake, or reframing.
- Framing **identical** from first frame to last — same crop as the source still.
- **Only the subject (dog) moves.**

The 6s arc and the closing line repeat this. Reject keepers where the crop drifts.

### AUDIO first — silence-first (howl/sing and play-huff excepted)

Murphy and Riley are remarkably **non-vocal**. They express via face and body (closed mouth, ear/eye/weight shifts), not sound. Grok Imagine will still invent a bark, howl, soundtrack, or talking-dog mouth if the prompt invites it — so Suggest puts **AUDIO first** and stays short.

Default AUDIO block (every slot that is not howl/sing or play):

- **Silence-first.**
- **Hard ban:** bark, howl, whine, growl, music, speech, ambience.
- **Optional only:** faint breath, soft paw on rug.
- **Mouth closed.** Face and body motion only.
- Do **not** say “soft dog sounds”, “pant/huff/whine”, or other language that invites sound.

Exceptions (still no bark, music, speech, or ambience):

- **Howl / sing intents:** a brief dog howl or husky song. Slot notes such as “responds to a howl” do **not** unlock vocalization on a name / come / hug / treat clip.
- **Play intents only:** one short **challenge huff** (sneeze-like chuff — the common way dogs ask to play-fight). Motion is a **play-bow / downward-dog stretch** (front low, rear up). Not a bark.

Other rules:

- **Name, come, here, owner, attention, eye-contact, perk-up:** ears perk + eye contact only. Closed mouth.
- **Riley hug** may show teeth (silent warning face). That is still **not** a growl or a howl.
- Murphy/Riley personality lines about howling are **omitted** from non-howl prompts so a name clip cannot pick up “sings and howls well.”

Reject keepers where the dog talks, barks, howls on a non-howl slot, or holds a howl-gape. If a keeper is visually good but Grok added bark/music/ambience, **strip audio before attaching** — post mute is normal. A play keeper may keep **one** short challenge huff; strip anything else.

### SuperGrok vs an API key

A **SuperGrok** (or Grok) subscription lets you generate **in grok.com / the X apps**. That is **not** an xAI API key.

Clip Studio does **not** call Grok from GitHub Pages. In-app **Generate with Grok** would need a separate `VITE_XAI_API_KEY` later. Until then, Suggest stays a local template so Pages keeps working with no secrets.

## External generation workflow

1. Frame the source still in Studio so the crop matches the FaceTime portrait (and landscape if you care about desktop).
2. Suggest prompt → Copy. Keep camera distance consistent across a dog.
3. Image-to-video in Grok Imagine (or Pika / Gemini). Grok Imagine: **6s** (not 3–4s), **9:16 portrait**, H.264 MP4. The suggested prompt locks the camera (only the dog moves), is silence-first (howl/sing or one play-bow challenge huff excepted), and asks for react-then-return-to-idle so the extra seconds stay as a loopable FaceTime hold. If Grok still adds bark/music, strip audio before attaching — post mute is normal.
4. Reject morphing / identity drift / camera movement. Attach the keeper, or mark **needs redo**.
5. Optional: later commit keepers under `web/public/clips/reactions/{intent}/{intent}_{nn}.mp4` for GitHub Pages.

Weights are relative (40/30/30 ≡ 4/3/3). Playback picks with `pickWeightedClip`.

## Catalog vs Studio

| Page | Role |
|------|------|
| `/studio` | Editor (dogs, intents, phrases, photos, framing, prompts, videos) |
| `/catalog` | Read-only table + phrase tester for the selected dog |
| `/demo` | Three-mode picker (Murphy / Riley / Both) |
| `/demo?dog=Riley` | Sample call using that dog’s library (no memorial photos → clip mode) |

Playback and matching read the Studio library for the active dog name (Murphy / Riley / Both / whatever you added). Demo calls keep **clip mode** (`photoUrls` empty) so placeholder / attached MP4s still play. The mode photo is also used as an idle still behind the video so the dog is visible if a clip file is missing.
