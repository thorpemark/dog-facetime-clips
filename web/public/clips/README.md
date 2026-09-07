# Placeholder clips

Bright colored portrait MP4s (360×640) so GitHub Pages and local demo have something
visible on the dark call UI. Regenerate with:

```bash
bash web/scripts/generate-placeholder-clips.sh
```

Replace with Murphy/Riley AI renders (same paths, or attach via Clip Studio).
Missing files are skipped at playback time.

| Path | Color (approx) | Meaning |
|------|----------------|---------|
| `idle*.mp4` | slate blue | Calm loop |
| `reactions/come/` | green | Come here |
| `reactions/treat/` | orange | Treat |
| `reactions/hug/` | pink | Hug |
| `reactions/howl/` | gold | Howl / sing |
| `reactions/unknown/` | cool gray | Unrecognized phrase / confused head-tilt |
| `react_*.mp4` | matches bucket | Legacy single-file names |
