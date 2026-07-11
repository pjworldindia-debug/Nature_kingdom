#!/bin/bash
# Daily PostgreSQL backup — runs via cron at 02:00
# Cron entry: 0 2 * * * /var/www/nature-kingdom/scripts/backup-db.sh

BACKUP_DIR="/var/backups/nature-kingdom"
DB_NAME="${DB_NAME:-naturekingdom}"
DB_USER="${DB_USER:-nk_app}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/nk_db_$TIMESTAMP.sql.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "[$(date)] Backup created: $BACKUP_FILE"
  # Delete backups older than retention period
  find "$BACKUP_DIR" -name "nk_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
  echo "[$(date)] Old backups pruned (kept last $RETENTION_DAYS days)"
else
  echo "[$(date)] BACKUP FAILED" >&2
  exit 1
fi
