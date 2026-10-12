#!/bin/sh
# Daily PostgreSQL dump kept for $BACKUP_KEEP_DAYS days (default 14). Restore drill:
#   gunzip -c /backups/pathsync-YYYYMMDD.sql.gz | psql "$DATABASE_URL"
set -eu
while true; do
  f="/backups/pathsync-$(date +%Y%m%d).sql.gz"
  if pg_dump --no-owner --clean --if-exists "$DATABASE_URL" | gzip > "$f.tmp"; then
    mv "$f.tmp" "$f" && echo "[backup] wrote $f ($(du -h "$f" | cut -f1))"
  else
    echo "[backup] FAILED at $(date)" >&2; rm -f "$f.tmp"
  fi
  find /backups -name 'pathsync-*.sql.gz' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
  sleep 86400
done
