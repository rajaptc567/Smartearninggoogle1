# Production Incident & Operational Recovery Runbook

## Overview

This runbook defines step-by-step procedures for handling production incidents, infrastructure interruptions, and financial discrepancies in SmartExn.

---

## 1. Database Outage / Connection Loss

### Symptoms
- API endpoints returning `500 Internal Server Error` or `503 Service Unavailable`.
- Backend logs showing: `Error connecting to MongoDB: serverSelectionTimeoutMS expired`.

### Action Plan
1. **Check Status**: Inspect MongoDB Atlas cluster status or local MongoDB daemon (`systemctl status mongod`).
2. **Network IP Whitelist**: Verify that the production server's outbound egress IP is whitelisted in Atlas Security / Network Access (`0.0.0.0/0` with strong authentication or specific VPC peering).
3. **Connection Limits**: Check if current active connections exceed database tier limits.
4. **Service Health**: If restarted, confirm the connection is restored; SmartExn server will automatically reconnect without needing a process restart due to Mongoose connection pooling.

---

## 2. Application Server Restart & Recovery

### Symptoms
- Ephemeral container restart due to memory threshold or platform health check failure.

### Action Plan
1. **Startup Health Check**: Confirm server logged `SmartExn Backend server running on port <PORT>`.
2. **Socket.IO Reconnection**: Real-time clients will automatically reconnect via exponential backoff.
3. **Passive Auth Verification**: JWT tokens are stateless; users remain logged in without session loss.
4. **Rate Limiter Reset**: In-memory rate limiter windows will safely reset on restart without deadlocking user accounts.

---

## 3. Failed Deployment Rollback

### Symptoms
- Build failure in CI/CD pipeline or runtime fatal error after deployment.

### Action Plan
1. **Immediate Rollback**: Trigger rollback to previous known stable container image or Git commit (`P22-A -> P32`).
2. **Schema Invariants**: Because P30–P32 index and schema enhancements are non-destructive and backward compatible, rollback requires zero database downgrade scripts.
3. **Verify Health**: Visit `/api/v1/settings/public` to confirm 200 OK response.

---

## 4. Missing Uploaded Receipts or Proof Files

### Symptoms
- Broken image link when viewing a deposit receipt or task submission screenshot.

### Action Plan
1. **Local vs Cloud Check**: Inspect if `NODE_ENV=production` is running on an ephemeral container without cloud storage or persistent volume.
2. **S3/GCS Sync**: If backup sync exists, restore missing files:
   ```bash
   aws s3 sync s3://smartexn-production-backups/uploads/ /path/to/backend/uploads/
   ```
3. **User Notification**: If a receipt is irrecoverable, request re-upload from user via the Admin Support / Dispute channel before taking approval actions.

---

## 5. Financial Reconciliation Anomaly

### Symptoms
- Anomaly reported by `/api/v1/transactions/reconciliation-audit`.

### Action Plan
1. **Read-Only Inspection**: Query the reconciliation endpoint as an Admin:
   `GET /api/v1/transactions/reconciliation-audit`
2. **Examine Fields**:
   - `negativeBalanceUsers`: Users whose balance fell below 0.
   - `duplicateTaskRewards`: Task submissions credited more than once.
   - `missingRewardSubmissions`: Approved tasks lacking transaction records.
   - `missingDepositTransactionsCount`: Approved deposits without ledger records.
   - `missingWithdrawalRefundTransactionsCount`: Rejected withdrawals without refund records.
3. **Evidence-Based Investigation**: Do not run automatic bulk balance scripts. Inspect the user audit trail in Admin Users and Admin Logs.

---

## 6. Approved Deposit Missing Wallet / Ledger Evidence

### Symptoms
- Deposit marked `Approved` in database, but user wallet balance was not updated or `Transaction` record is missing.

### Action Plan
1. **Audit Logs**: Check `Log` collection for deposit approval actions and timestamp.
2. **Manual Reconciliation**:
   - Check if user received funds under another transaction ID.
   - If confirmed missing: Admin credits user wallet via Admin User Management adjustment and records a formal Manual Adjustment note.

---

## 7. Rejected Withdrawal Missing Refund Evidence

### Symptoms
- Withdrawal marked `Rejected` or `Cancelled`, but funds were not returned to user wallet.

### Action Plan
1. **Check Atomic Status**: In P28–P30, rejection automatically executes an atomic wallet increment and creates a `Withdrawal Refund` transaction.
2. **Verify Record**: Check if `Transaction` with `type: "Withdrawal Refund"` exists for the `withdrawalId`.
3. **Manual Credit**: If refund failed due to mid-operation server crash prior to P28, credit the refund via Admin User Management with description `Manual Refund for Withdrawal #<ID>`.

---

## 8. Approved Transfer Missing Recipient Ledger Evidence

### Symptoms
- Transfer marked `Approved`, sender was debited, but recipient was not credited.

### Action Plan
1. **Check Transfer Record**: Inspect `Transfer` document with `_id`.
2. **Inspect Transactions**: Look for `type: "Transfer Received"` linked to `transferId`.
3. **Credit Recipient**: If missing, credit recipient balance by `netAmount` and log the administrative resolution.

---

## 9. Approved Task Reward Missing Transaction Evidence

### Symptoms
- `UserTaskSubmission` marked `Approved` with `rewardClaimed: true`, but no matching `Task Reward` transaction exists.

### Action Plan
1. **Run Reconciliation Audit**: Check `missingRewardSubmissions`.
2. **Verify Worker Balance**: Confirm whether worker balance was credited during submission approval.
3. **Create Ledger Entry**: Insert missing `Task Reward` transaction record linked to `submissionId` and `taskId`.

---

## 10. Recovery from Accidental Configuration Changes

### Symptoms
- Admin accidentally toggled off critical features (e.g., `isUserTaskEnabled: false`, payment methods disabled).

### Action Plan
1. **Inspect Settings**: Visit Admin Settings > Work & Earn / Module Configuration.
2. **Restore Defaults**: Toggles can be re-enabled instantly in Admin UI.
3. **Verify Public Settings**: Confirm `/api/v1/settings/public` reflects desired state.
