---
title: PathSync API
emoji: 🧭
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8000
pinned: false
---

PathSync backend (FastAPI). Built from `backend/` of github.com/ivanwilliaml/pathsync-icc2026 by `deploy/huggingface/push.sh`.
Settings → Variables and secrets: `PATHSYNC_DATABASE_URL` (Neon, secret), `PATHSYNC_PROXY_SECRET` (secret, same value as on Vercel),
`PATHSYNC_ADMIN_TOKEN` (secret), `PATHSYNC_CORS_ORIGINS` (the Vercel URL).
