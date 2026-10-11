#!/usr/bin/env bash
#//// Neoffice — added file (no upstream equivalent). Upstream's script of the same name is gone since
#//// v1.4.0: the media now live INSIDE its repository (catalogue/media/still and clip, 190 MB), and its
#//// `docker compose up` mounts them. Our git history carries none of them (the upstream range was
#//// imported without those two folders), so an instance stages them from an upstream tag instead,
#//// into opengym/public/media/ — served by Frappe on /assets/opengym/media/ (lib/exercises.js).
#////
#//// ⚠️ READ BEFORE RUNNING THIS ON A CLIENT INSTANCE.
#//// The stills and clips are © Gym visual (catalogue/media/NOTICE.md upstream). openGym holds a licence
#//// for them; a fork of ours serving a paying club's members is a commercial use that licence does not
#//// extend to without an agreement of our own. So: this script is for DEVELOPMENT and internal demos
#//// (osiris). Before any client instance is given the media, decide — the club buys its own pack, or we
#//// move to other pictures. Detail: Obsidian, Neoffice/Fitness-Coaching/02-Licences-Et-Contraintes and 83.
#////
#//// Idempotent (it does nothing when the two folders are filled), so it can run at provisioning.
#//// OPENGYM_MEDIA_TAG picks the upstream tag, OPENGYM_MEDIA_SRC another copy of the upstream repository.
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="opengym/public/media"
TAG="${OPENGYM_MEDIA_TAG:-v1.4.1}"
SRC="${OPENGYM_MEDIA_SRC:-https://github.com/DuarteSantos8/openGym}"
mkdir -p "$DEST/still" "$DEST/clip"

if [ -n "$(ls -A "$DEST/still" 2>/dev/null)" ] && [ -n "$(ls -A "$DEST/clip" 2>/dev/null)" ]; then
  echo "✓ Media already there ($(ls "$DEST/still" | wc -l | tr -d ' ') stills, $(ls "$DEST/clip" | wc -l | tr -d ' ') clips): nothing to do."
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "↓ Fetching the exercise media (~190 MB, once) from $SRC at $TAG, only the two media folders…"
git clone --quiet --depth 1 --branch "$TAG" --filter=blob:none --sparse "$SRC" "$tmp"
git -C "$tmp" sparse-checkout set catalogue/media/still catalogue/media/clip
cp -R "$tmp"/catalogue/media/still/. "$DEST/still/"
cp -R "$tmp"/catalogue/media/clip/. "$DEST/clip/"
echo "✓ $(ls "$DEST/still" | wc -l | tr -d ' ') stills, $(ls "$DEST/clip" | wc -l | tr -d ' ') clips."
echo "  © Gym visual — https://gymvisual.com/ (attribution required, 180×180 at most)"
