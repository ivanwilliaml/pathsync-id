#!/bin/sh
# Copy backend/ plus the Space card and Dockerfile into a clone of the Space repo and push it.
#   sh deploy/huggingface/push.sh <hf-username>/<space-name>
# Needs `git` and a Hugging Face write token configured for git (huggingface-cli login).
set -e
SPACE="$1"; [ -n "$SPACE" ] || { echo "usage: push.sh <user>/<space>"; exit 1; }
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
git clone "https://huggingface.co/spaces/$SPACE" "$TMP/space"
cd "$TMP/space"
git rm -rq --ignore-unmatch . >/dev/null 2>&1 || true
(cd "$ROOT/backend" && git ls-files -z | xargs -0 -I{} cp --parents {} "$TMP/space/")
cp "$ROOT/deploy/huggingface/README.md" "$ROOT/deploy/huggingface/Dockerfile" .
git add -A
git commit -qm "deploy $(cd "$ROOT" && git rev-parse --short HEAD)"
git push
echo "pushed; build log: https://huggingface.co/spaces/$SPACE"
