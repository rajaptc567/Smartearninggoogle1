# Production Backup and Disaster Recovery Guide

## Overview

This guide outlines the standard operating procedures for database backups, data restoration, and disaster recovery for SmartExn. The application uses MongoDB as its primary datastore and local/cloud storage for user uploads (proofs, transaction receipts, payment screenshots).

---

## 1. Database Backup Procedures

### A. MongoDB Atlas Automated Backups (Recommended)
If hosted on **MongoDB Atlas**:
1. Enable **Continuous Cloud Backups** in the Atlas Console under **Cluster > Backup**.
2. Configure Snapshot Schedule:
   - **Daily Snapshots**: Retained for 7 days.
   - **Weekly Snapshots**: Retained for 4 weeks.
   - **Monthly Snapshots**: Retained for 12 months.
3. Enable **Point-in-Time Restore (PITR)** with 7-day granularity for instant recovery from accidental mutations.

### B. Self-Hosted / Standalone MongoDB (`mongodump`)
For VPS, Docker, or standalone MongoDB deployments, run `mongodump` using a non-root backup user with `backup` or `readAnyDatabase` privileges.

#### Manual Backup Command
```bash
# Set your environment variable (DO NOT hardcode credentials in scripts)
export BACKUP_DIR="/secure/backups/mongodb/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Execute compressed backup archive
mongodump --uri="$MONGO_URI" --gzip --archive="$BACKUP_DIR/smartexn_backup.gz"

# Verify archive size and presence
ls -lh "$BACKUP_DIR/smartexn_backup.gz"
```

#### Automated Daily Crontab (Linux / VPS)
```cron
# Run daily at 02:00 UTC
0 2 * * * /usr/local/bin/backup_mongo.sh >> /var/log/mongo_backup.log 2>&1
```

**`backup_mongo.sh` script template:**
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="/secure/backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_FILE="${BACKUP_ROOT}/smartexn_${TIMESTAMP}.archive.gz"

mkdir -p "$BACKUP_ROOT"
mongodump --uri="${MONGO_URI}" --gzip --archive="${TARGET_FILE}"

# Retention: Delete local backups older than 14 days
find "$BACKUP_ROOT" -type f -name "*.archive.gz" -mtime +14 -delete
```

---

## 2. Database Restore Procedures

> **CRITICAL WARNING:** A database restore can overwrite existing production records. Always take a pre-restore backup snapshot of the current state before executing a restore operation.

### A. Pre-Restore Snapshot
```bash
# Capture immediate safety snapshot before applying restore
mongodump --uri="$MONGO_URI" --gzip --archive="/secure/backups/mongodb/pre_restore_safety_$(date +%Y%m%d_%H%M%S).gz"
```

### B. Targeted Database Restore (`mongorestore`)
```bash
# Restore specific archive to target database
mongorestore --uri="$MONGO_URI" --gzip --archive="/secure/backups/mongodb/smartexn_backup.gz" --drop --nsInclude="smartexn.*"
```
* `--drop`: Drops existing collections in the target database before restoring from archive.
* `--nsInclude`: Restricts restore strictly to the application database namespace.

### C. Staging Restore Verification
Before restoring directly onto production, always test the archive against an isolated staging or local database:
```bash
mongorestore --uri="mongodb://localhost:27017/smartexn_staging" --gzip --archive="/path/to/backup.gz"
```

---

## 3. Backup Verification & Health Checks

1. **Integrity Check**: Test that the `.gz` archive is valid and uncorrupted:
   ```bash
   gzip -t /secure/backups/mongodb/smartexn_backup.gz && echo "Archive integrity: OK"
   ```
2. **Size Anomaly Alerts**: Monitor backup file sizes. A sudden drop in backup size (>30% reduction) indicates a failed dump or truncated collection.
3. **Monthly Drill**: Perform a scheduled dry-run restore into a non-production instance on the 1st of every month.

---

## 4. User Uploads & Media Assets Durability

Uploaded files (`/backend/uploads`) include:
- Deposit payment receipts
- Task proof screenshots
- Withdrawal proof documents
- Profile avatars and payment method logos

### Durability Strategy
* **Container / Ephemeral Environments (Cloud Run / Render / Heroku)**: Local disk storage is ephemeral. For production permanence, configure external object storage (e.g., AWS S3, Cloudinary, or Google Cloud Storage) or attach a persistent volume.
* **Persistent VPS / Dedicated Hosts**: Back up the `/backend/uploads` directory daily to an offsite S3/GCS bucket:
  ```bash
  aws s3 sync /var/www/smartexn/backend/uploads s3://smartexn-production-backups/uploads/ --delete
  ```

---

## 5. Security & Access Control

1. **Encryption at Rest**: Ensure all backup storage buckets or volumes use AES-256 server-side encryption.
2. **Zero Secrets in Code**: Never commit `$MONGO_URI`, S3 keys, or backup scripts with hardcoded credentials to Git.
3. **Least Privilege**: Backup users must not have `dbAdminAnyDatabase` or `userAdminAnyDatabase` permissions unless explicitly required.
