# Clip Studio

Clip Studio (`/studio`) is the editor for **per-dog reaction libraries**. Generation happens **outside** the app (Grok Imagine, Pika, Gemini, or anything else). The app stores source still + framing + prompt + weight + attached MP4.

Demo persistence uses **localStorage** (library JSON) and **IndexedDB** (photos/videos) when you are signed out or Supabase secrets are missing. **Signed in**, the same library syncs through the memorial Supabase project so PC Chrome and iPhone Chrome share dogs, generation stills, call idle, and attached MP4s. Nothing here calls a live video API. **Suggest prompt** is a local template composer — no API key, works on GitHub Pages.

## Sync Studio across devices

Clip Studio used to live only in **this browser**. That is why Murphy’s library on PC Chrome did not appear in phone Chrome or Keep’s in-app browser — those are separate localStorage / IndexedDB silos, even on the same GitHub Pages URL.

**Fix:** sign in with the **same Google (or email) account** on every device. The app reuses the existing **Dog_memorial_facetime** Supabase project (`cqmkcuchmnehnpizapqy`) — it does **not** need a second project.

1. On the **PC that already has Murphy’s videos**, open Clip Studio and sign in (Google is fine). Wait until the banner says the library is synced. Attached MP4s and generation stills upload; they are **merged**, not wiped. Do **not** tap Reset seed.
2. On the **phone**, open the site in **Chrome** (not Keep’s in-app browser). Sign in with the **same account**. The phone downloads that library. Sample Call / Debug then play the real MP4s, not the colored placeholders.
3. Later edits (new videos, idle pick, holiday intents) debounce-upload from whichever device you are on.

**Unsigned / demo:** GitHub Pages still works with no secrets. You get the baked seed + whatever you attach in that one browser.

**GitHub Pages secrets** (same as memorial sharing — no new names):

| Secret | Value |
|--------|--------|
| `VITE_SUPABASE_URL` | `https://cqmkcuchmnehnpizapqy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |

If those secrets were never set, the live site cannot sign in and each browser stays isolated. Add them under **Settings → Secrets and variables → Actions**, then re-run **Deploy Web App to GitHub Pages**.

Also in Supabase **Authentication → URL Configuration**, **add** (do not replace the stills-app URLs) redirect URL `https://thorpemark.github.io/dog-facetime-clips/` (site root, same as memorial sign-in on this fork). Keep `https://thorpemark.github.io/dog-facetime/` if that app already uses this project. Run [`web/supabase/migration_studio_library.sql`](../web/supabase/migration_studio_library.sql) once if you are applying SQL by hand.

## Add a dog

1. Open **Clip Studio**.
2. Type a name in **New dog name** → **Add dog**.
3. Set the **Personality** radios (vocal style, voice size, energy, eyes, mouth, touch) and optional notes (first line = breed; following lines = character). Suggest prompt and new clip slots pick this up.

Murphy, Riley, and **Both** ship as seed dogs (huskitas) with baked stills in `web/public/modes/`. **Riley is the black huskita.** **Murphy is the other dog** (not Riley).

| Mode | Photo | Who |
|------|-------|-----|
| **Murphy** | `modes/murphy.jpg` | Tan/ginger huskita, folded ears — the other dog, not Riley |
| **Riley** | `modes/riley.jpg` | Black-and-white huskita, upright ears — the black huskita |
| **Both** | `modes/both.jpg` | Murphy on the left, Riley on the right |

Those stills are the Studio tab avatars, the home/demo three-mode picker cards, and incoming-call faces. They are **not** the still Grok uses for new clips. Seed **idle + name / come / hug / howl / unknown** slots start with a copy of that mode photo for the first library. Set each dog’s **Generation still** to the portrait you already used for keepers so later intents match those videos. Reset seed from the bottom of Studio if you want to start over **in this browser** (it does not delete a signed-in cloud library).

**Call idle (looping FaceTime hold):** the `idle` intent is what you see after Accept and after every reaction. Attach a short MP4 on an idle slot, then pick it in the **Call idle loop** dropdown (or tap **Use as call idle** on the slot). First attached idle is the default until you choose. Sample Call / demo plays that clip in a **9:16 portrait** FaceTime stage (same framing as the kitchen generation still — full sit, not a landscape head crop). If nothing is attached yet, the call holds the **generation still** at full frame, or the dog still — not the colored placeholder slab and not `modes/*.jpg` landscape closeup. Preference is stored on the dog (local + cloud when signed in) and does not wipe other attachments.

## Generation still (video source)

Each dog has one **clip source portrait** — the still you already used to generate videos you like (Murphy’s portrait, Riley’s, Both together). That is **not** the tab / demo picker avatar (`modes/*.jpg`).

1. Pick the dog.
2. Under **Generation still**, upload that portrait — or on a slot that already has it, tap **Use this photo as generation still**.
3. It is stored at **full frame** (whole image, portrait and landscape). You do not re-crop for every new intent. Frame only if you want a tighter crop later.
4. **Setting it** copies that portrait onto **empty slots and seed/avatar photos** at full frame (Riley and Both stills that still show `modes/*.jpg`, plus any slot with no photo). Attached MP4s stay attached — only the source still/framing is swapped.
5. **Apply generation still to all clip slots (full frame)** does the same pass later (for example if the still was set before this existed, or you replaced the portrait). Custom unique slot photos (a crop you uploaded that is not the seed avatar) are kept.
6. **Add intent** / **Add clip variant**. New slots copy that exact portrait at full frame so future clips match the identity and framing of the videos you already like.

Do this once per dog. Persists with the Studio library. Home cards stay on `modes/*.jpg`. Portrait and MP4 binaries live in this browser’s IndexedDB and, when you are signed in, in private Supabase Storage for that account.

### How Mark uses this (Riley / Both, then Thanksgiving)

Hard refresh. **Do not reset Studio** if Murphy already has attached videos.

1. Studio → **Riley** (then **Both**).
2. If **Generation still** is already the kitchen portrait, tap **Apply generation still to all clip slots (full frame)** and confirm. If it is not set yet, upload / promote that portrait — empty + seed photos update automatically; use Apply if any leftover avatar stills remain.
3. Expand **Thanksgiving**. Suggest already uses the generation still as the source photo.
4. **Suggest prompt** → **Copy**. In Grok Imagine pick **10s** (or **15s**), **9:16**, image-to-video from that still. Do **not** pick 6s.
5. Attach the MP4 on the same slot.

Repeat for the other holiday intents when you want those greetings.

## Add an intent (bucket)

1. Type a label (e.g. `belly rub`) → **Add intent**.
2. New clip slots copy this dog’s **Generation still** at full frame (the portrait you generate from) when one is set — not the tab avatar.
3. Set **priority** (higher wins close matches), **semantic hints** (paraphrases for meaning match), and **phrases** (keyword fallback).
4. Expand the intent to edit clip slots.

Intent ids are slugs (`belly-rub`). You do **not** edit TypeScript unions for each new intent.

Seed libraries include an **`unknown`** catch-all (confused head-tilt). The matcher plays it when a spoken or typed phrase is not recognized — it does not stay on idle and does not pick a random other intent. Murphy, Riley, and Both each have their own slots + Suggest prompt (silence-first). Attach the MP4s here the same way as any other intent.

Seed libraries also include **holiday costume-walk** intents (Halloween, Thanksgiving, Christmas, New Year’s, Valentine’s Day, Super Bowl Sunday, St. Patrick’s Day, Birthday, Memorial Day, 4th of July, Labor Day). Existing browsers pick up missing holidays on refresh without wiping attached videos, a Halloween intent you already added, or the generation still. Suggest for these is a **10s / 15s** locked-camera costume walk — not the 6s react-idle arc.

## Add a phrase

In an expanded intent: type the phrase → **Add phrase**. Lowercased automatically. `{dogName}` / `{ownerName}` still work in seed phrases.

## Add a clip variant

1. **Add clip variant** on the intent. If a generation still is set, the new slot already has that photo at full frame.
2. **Add photo** only if you need a different still (same framing editor: portrait + landscape/PC, crop handles, zoom, rotation). **Use this photo as generation still** if this is the keeper you want on later intents.
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
   - intent (treat, hug, howl, come, unknown head-tilt, …)
   - seed **Personality** radios (not dog-name ifs). Murphy and Riley ship silent / dry / huskita defaults; Murphy is goofy + cuddly, Riley is alert + grumble-hug. Changing radios changes Suggest. See trait table below.
   - **Play:** downward-dog play-bow (front low, rear up) plus one short sneeze-like challenge huff — not a bark (intent exception even for silent dogs)
   - this slot’s label + optional slot notes
   - framing context when a photo is attached (portrait FaceTime, keep identity)
   - a **6s** Grok Imagine arc for ordinary reactions: reaction peaks in the first ~2–3s → return to calm FaceTime idle and hold. Camera stays perfectly still; only the dog moves.
   - **Holiday costume-walk intents** (Thanksgiving, Halloween, …): **10s** (15s ok) locked-camera walk — off left, return in costume, walk across with eye contact, return without costume to the exact source pose. Do **not** use 6s for these.
   - **LOCKED CAMERA** on every Suggest (see below) so playback can return to idle without a framing reset.
   - **AUDIO first** (silence-first by default — see below). Prompts stay short.
3. **Copy** (toast confirms). Paste into **Grok Imagine** as an **image-to-video** prompt, with the framed still as the source image.
4. In Grok Imagine, length options are **6 / 10 / 15s** (there is no 3–4s). Use **6s** for ordinary reactions, **10s or 15s** for holiday costume walks, **9:16 portrait**, H.264 MP4. Reject morphing / breed drift / extra dogs / talking dogs / camera moves / clips that keep reacting until the last frame.
5. **Attach MP4** back on the same slot. If Grok still adds bark, music, or other audio, **strip the audio before attaching** — post mute is normal.

You can edit the prompt after Suggest, then Copy again. Suggest again to rebuild from the current dog / intent / notes / framing.

### LOCKED CAMERA — only the dog moves

Playback returns to the idle still/clip. If Grok pans, zooms, or reframes, the last frame no longer matches idle and the call has to “reset.” Suggest therefore puts a **LOCKED CAMERA** block on every prompt (howl and play included):

- Camera **perfectly still**.
- **No** pan, tilt, dolly, zoom, push-in, pull-out, handheld shake, or reframing.
- Framing **identical** from first frame to last — same crop as the source still.
- **Only the subject (dog) moves.**

The 6s arc and the closing line repeat this. Holiday costume walks use **10s or 15s** instead of that 6s arc, still with a locked camera. Reject keepers where the crop drifts.

### Holiday costume walks (10s+)

Seed holiday intents share one clip concept (Mark’s Thanksgiving prompt, generalized):

- **LOCKED CAMERA** — perfectly still; only the dog moves.
- Length **10 seconds or more** (Grok Imagine 10s or 15s — not 6s).
- Exact same dog as the generation still.
- Walks off camera to the **left**.
- Instantly returns wearing a holiday-appropriate costume (Thanksgiving: Pilgrim hat + dog-jacket; Halloween / Christmas / etc. described per intent).
- Looks **right at the camera** (eye contact) while walking off the **right**.
- Instantly returns **without** any costume, still the exact same dog.
- Returns to the **exact sitting position** in the source image.
- **AUDIO** still follows personality (Murphy/Riley silent unless talker, etc.). No invented bark or music.

**Both:** both dogs do the costume walk together and stay identifiable (Murphy left, Riley right), then return to the source poses.

Phrases include greetings such as “happy thanksgiving”, “merry christmas”, “happy halloween”, “happy birthday”, “super bowl”, “go birds”.

### Personality radios

Each dog in the Studio library has a compact **Personality** panel. Radios are mutually exclusive within a group. They persist with the library (local demo, or the signed-in cloud copy) and drive Suggest — any added dog can use them, not just Murphy/Riley.

| Trait | Values | What Suggest does |
|-------|--------|-------------------|
| **vocalStyle** | `silent` · `soft` · `barks` · `howler` · `talker` | Builds the AUDIO block. Silent = silence-first (current Murphy/Riley default). Soft = faint whine/breath only. Barks/howler = matching vocalization. Talker = a few English words, labeled **experimental**. |
| **voiceSize** | `small_high` · `medium` · `large_low` | Pitch of allowed vocalization (high small-dog vs low large-dog). **Muted/disabled in the UI when vocalStyle is silent.** Still colors howl-intent AUDIO when a silent dog is asked to howl/sing. |
| **energy** | `calm` · `normal` · `hyper` | Motion line: slow/unhurried vs typical vs quick/hyper (stay in frame). |
| **eyes** | `soft_sad` · `alert` · `goofy` | Personality eyes (Murphy seeds `goofy`; Riley seeds `alert`). |
| **mouth** | `dry` · `slobberer` | Dry muzzle vs a little slobber/drool. |
| **touch** | `cuddly` · `grumble_hug` | Hug beat: loves hugs / neck offer vs Riley-style silent warning face (bares teeth, not an attack, no growl). |

Seed profiles:

- **Murphy:** silent, large/low voice size (for howl exception), normal energy, goofy eyes, dry mouth, cuddly.
- **Riley:** silent, medium voice size, normal energy, alert eyes, dry mouth, grumble-hug.
- **Both** (together memorial): silent; hug/howl/play/unknown still use the pair-specific together-shot lines (Murphy leans in, Riley wary; Murphy sings, Riley awkward howl; both head-tilt when a phrase is not recognized).

Freeform notes (first line = breed) still layer on. Howl-quality notes such as “sings and howls well” or “awkward howl attempt” are included **only** on howl/sing intents so a name clip cannot pick up “sings and howls well.”

### AUDIO first — driven by vocalStyle (howl/sing and play-huff excepted)

Grok Imagine will invent a bark, howl, soundtrack, or talking-dog mouth if the prompt invites it — so Suggest puts **AUDIO first** and stays short. AUDIO is built from **vocalStyle**, not from the dog’s name.

Default AUDIO when vocalStyle is **silent** (every slot that is not howl/sing or play):

- **Silence-first.**
- **Hard ban:** bark, howl, whine, growl, music, speech, ambience.
- **Optional only:** faint breath, soft paw on rug.
- **Mouth closed.** Face and body motion only.
- Do **not** say “soft dog sounds”, “pant/huff/whine”, or other language that invites sound.

Other vocalStyle defaults (non-howl, non-play):

- **soft:** faint whine or breath ok; still no bark, howl, music, or speech unless an intent exception applies.
- **barks:** brief barks allowed, pitched by voiceSize; no howl/music/speech.
- **howler:** a brief howl/aroo allowed, pitched by voiceSize; no bark/music/speech.
- **talker:** a few clear English words, labeled experimental; no music/ambience/cartoon overacting.

Intent exceptions (still no music or ambience; apply even when vocalStyle is silent):

- **Howl / sing intents:** a brief dog howl or husky song. Slot notes such as “responds to a howl” do **not** unlock vocalization on a name / come / hug / treat clip.
- **Play intents only:** one short **challenge huff** (sneeze-like chuff — the common way dogs ask to play-fight). Motion is a **play-bow / downward-dog stretch** (front low, rear up). Not a bark. Silent dogs still get this single huff.

Other rules:

- **Name, come, here, owner, attention, eye-contact, perk-up:** ears perk + eye contact only. Closed mouth.
- **Unknown / confused:** classic curious head-tilt toward the camera. AUDIO follows vocalStyle (silence-first for silent dogs — no bark or music). Seed stills are attached on Murphy, Riley, and Both so you can Suggest → Copy → attach.
- **grumble_hug** may show teeth (silent warning face). That is still **not** a growl or a howl.
- Howl-quality notes are **omitted** from non-howl prompts.

Reject keepers where the dog talks (unless vocalStyle is talker), barks/howls against the AUDIO block, or holds a howl-gape on a non-howl slot. If a keeper is visually good but Grok added extra bark/music/ambience, **strip audio before attaching** — post mute is normal. A play keeper may keep **one** short challenge huff; strip anything else.

### SuperGrok vs an API key

A **SuperGrok** (or Grok) subscription lets you generate **in grok.com / the X apps**. That is **not** an xAI API key.

Clip Studio does **not** call Grok from GitHub Pages. In-app **Generate with Grok** would need a separate `VITE_XAI_API_KEY` later. Until then, Suggest stays a local template so Pages keeps working with no secrets.

## External generation workflow

1. Frame the source still in Studio so the crop matches the FaceTime portrait (and landscape if you care about desktop).
2. Suggest prompt → Copy. Keep camera distance consistent across a dog.
3. Image-to-video in Grok Imagine (or Pika / Gemini). Grok Imagine: **6s** for ordinary reactions, **10s or 15s** for holiday costume walks (not 3–4s), **9:16 portrait**, H.264 MP4. Ordinary prompts lock the camera (only the dog moves), are silence-first (howl/sing or one play-bow challenge huff excepted), and ask for react-then-return-to-idle. Holiday prompts use the locked-camera costume walk instead of that 6s arc. If Grok still adds bark/music, strip audio before attaching — post mute is normal.
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

Playback and matching read the Studio library for the active dog name (Murphy / Riley / Both / whatever you added). Demo calls keep **clip mode** (`photoUrls` empty) so attached MP4s still play. After Accept the hold is a **9:16 portrait** stage: the chosen **Call idle loop** if one is attached, otherwise the **generation still** (full-frame portrait). Home / incoming avatars stay on `modes/*.jpg`.
