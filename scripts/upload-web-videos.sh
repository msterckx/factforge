#!/usr/bin/env bash
# upload-web-videos.sh
# Copies the 720p web videos (local-data/web-videos, made by
# encode-web-videos.js) to the server's video folder, which the site serves
# through /api/videos (VIDEO_DIR=/var/data/videos on the server).
#
# Only new or changed files are sent; nothing on the server is deleted.
# Defaults to a dry run that lists what would be copied — pass --go to upload.
#
#   scripts/upload-web-videos.sh                 # dry run, all games
#   scripts/upload-web-videos.sh --go            # upload
#   scripts/upload-web-videos.sh --go quantum-scientists   # one game only
set -euo pipefail

REMOTE="${VIDEO_REMOTE:-srv-d68p924r85hc73cvspgg@ssh.oregon.render.com}"
REMOTE_DIR="${VIDEO_REMOTE_DIR:-/var/data/videos}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/local-data/web-videos"

GO=0
GAME=""
for arg in "$@"; do
  case "$arg" in
    --go) GO=1 ;;
    -*) echo "Unknown option: $arg" >&2; exit 1 ;;
    *) GAME="$arg" ;;
  esac
done

if [ -n "$GAME" ]; then
  [ -d "$SRC/$GAME" ] || { echo "No web videos for $GAME in $SRC" >&2; exit 1; }
  FROM="$SRC/$GAME/"
  TO="$REMOTE_DIR/$GAME/"
else
  FROM="$SRC/"
  TO="$REMOTE_DIR/"
fi

RSYNC_OPTS=(-rt --itemize-changes --human-readable --stats --include='*/' --include='*.mp4' --exclude='*')
if [ "$GO" -eq 0 ]; then
  echo "DRY RUN — nothing is uploaded. Re-run with --go to copy."
  RSYNC_OPTS+=(--dry-run)
fi

echo "From: $FROM"
echo "To:   $REMOTE:$TO"
if [ "$GO" -eq 1 ]; then
  # Create the target folder on the server first (real uploads only — a dry
  # run must not change anything on the server).
  rsync "${RSYNC_OPTS[@]}" --rsync-path="mkdir -p '$TO' && rsync" "$FROM" "$REMOTE:$TO"
else
  rsync "${RSYNC_OPTS[@]}" "$FROM" "$REMOTE:$TO"
fi
