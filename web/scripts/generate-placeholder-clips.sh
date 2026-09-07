#!/usr/bin/env bash
# Bright colored portrait placeholders so demo playback is visible on the dark
# call UI. Replace with Murphy/Riley AI renders using the same paths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIPS="$ROOT/public/clips"

make_clip() {
  local out="$1" color="$2" dur="${3:-1.8}"
  mkdir -p "$(dirname "$out")"
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=${color}:s=360x640:d=${dur}" \
    -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 28 \
    -movflags +faststart -an "$out"
}

make_clip "$CLIPS/idle.mp4" "0x4a6088" 2.4
make_clip "$CLIPS/idle/idle_01.mp4" "0x4a6088" 2.4
make_clip "$CLIPS/idle/idle_02.mp4" "0x5a7098" 2.4

make_clip "$CLIPS/reactions/name/name_01.mp4" "0xf0c040" 1.8
make_clip "$CLIPS/reactions/name/name_02.mp4" "0xe0b030" 1.8
make_clip "$CLIPS/reactions/name/name_03.mp4" "0xd0a020" 1.8
make_clip "$CLIPS/react_biscuit.mp4" "0xf0c040" 1.8

make_clip "$CLIPS/reactions/come/come_01.mp4" "0x3ddc84" 1.8
make_clip "$CLIPS/reactions/come/come_02.mp4" "0x2ecf70" 1.8
make_clip "$CLIPS/reactions/come/come_03.mp4" "0x22b85f" 1.8
make_clip "$CLIPS/react_come.mp4" "0x3ddc84" 1.8

make_clip "$CLIPS/reactions/here/here_01.mp4" "0x40d0e0" 1.8
make_clip "$CLIPS/reactions/here/here_02.mp4" "0x30c0d0" 1.8

make_clip "$CLIPS/reactions/good/good_01.mp4" "0xf080c0" 1.8
make_clip "$CLIPS/reactions/good/good_02.mp4" "0xe060b0" 1.8
make_clip "$CLIPS/reactions/good/good_03.mp4" "0xd050a0" 1.8
make_clip "$CLIPS/react_good.mp4" "0xf080c0" 1.8

make_clip "$CLIPS/reactions/treat/treat_01.mp4" "0xff9f40" 1.8
make_clip "$CLIPS/reactions/treat/treat_02.mp4" "0xff8820" 1.8
make_clip "$CLIPS/reactions/treat/treat_03.mp4" "0xf07010" 1.8
make_clip "$CLIPS/react_treat.mp4" "0xff9f40" 1.8

make_clip "$CLIPS/reactions/walk/walk_01.mp4" "0x5080ff" 1.8
make_clip "$CLIPS/reactions/walk/walk_02.mp4" "0x4070f0" 1.8
make_clip "$CLIPS/reactions/walk/walk_03.mp4" "0x3060e0" 1.8
make_clip "$CLIPS/react_walk.mp4" "0x5080ff" 1.8

make_clip "$CLIPS/reactions/no/no_01.mp4" "0xff5a5a" 1.8
make_clip "$CLIPS/reactions/no/no_02.mp4" "0xee4040" 1.8
make_clip "$CLIPS/react_no.mp4" "0xff5a5a" 1.8

make_clip "$CLIPS/reactions/owner/owner_01.mp4" "0xb070ff" 1.8
make_clip "$CLIPS/reactions/owner/owner_02.mp4" "0xa060f0" 1.8
make_clip "$CLIPS/react_owner.mp4" "0xb070ff" 1.8

make_clip "$CLIPS/reactions/play/play_01.mp4" "0x90e040" 1.8
make_clip "$CLIPS/reactions/play/play_02.mp4" "0x80d030" 1.8

make_clip "$CLIPS/reactions/quiet/quiet_01.mp4" "0x8090a8" 1.8
make_clip "$CLIPS/reactions/quiet/quiet_02.mp4" "0x708098" 1.8

make_clip "$CLIPS/reactions/hug/hug_01.mp4" "0xff6b9d" 1.8
make_clip "$CLIPS/reactions/hug/hug_02.mp4" "0xff8fab" 1.8

make_clip "$CLIPS/reactions/howl/howl_01.mp4" "0xc9a227" 1.8
make_clip "$CLIPS/reactions/howl/howl_02.mp4" "0xd4b84a" 1.8

echo "Wrote bright placeholders under $CLIPS"
