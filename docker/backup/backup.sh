#!/usr/bin/env bash
# Dumps the church database to /backups and removes dumps older than KEEP_DAYS.
# Run manually:   docker compose --profile backup run --rm backup
# Schedule it with Windows Task Scheduler (local) or cron (server) — see docs/RUNBOOK.md.
set -euo pipefail

STAMP=$(date +%Y-%m-%d_%H%M)
OUT="/backups/${MONGO_DB}_${STAMP}.archive.gz"

echo "Backing up ${MONGO_DB} to ${OUT}"
mongodump --uri="${MONGO_URI}" --db="${MONGO_DB}" --archive="${OUT}" --gzip

find /backups -name "${MONGO_DB}_*.archive.gz" -mtime +"${KEEP_DAYS:-14}" -delete
echo "Done. Current backups:"
ls -lh /backups
