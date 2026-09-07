# Placeholder clips

Tiny colored portrait MP4s so GitHub Pages and local demo have something to play.
Replace with Murphy/Riley AI renders using the same paths registered in
`web/src/data/reactionCatalog.ts`. Missing files are skipped at playback time.

| Path | Meaning |
|------|---------|
| `idle.mp4`, `idle/idle_01.mp4`, `idle/idle_02.mp4` | Calm loop |
| `reactions/{bucket}/{bucket}_{nn}.mp4` | Weighted reaction variants |
| `react_*.mp4` | Legacy single-file names |
