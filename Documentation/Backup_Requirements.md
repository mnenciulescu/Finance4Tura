# Backup ALL Tables — Feature Requirements

## Overview

A one-click backup on the **Admin page** that exports every DynamoDB table in the stack to CSV and saves the files to a new dated folder on Google Drive. It covers all users' data.

---

## Access

- **Page**: `/admin` — shown only to username `nenciulescu`
- **API**: `/admin/backup/*` — requires the Cognito `admin` group
- **Section**: **Database Backup**
- **Trigger**: **Backup ALL Tables**

---

## Flow

### Step 1 — Preview

Clicking the button calls `GET /admin/backup/preview` (spinner while loading) and opens a modal with:

- the destination folder name — today's date, `YYYY-MM-DD`
- one row per table with its current item count (a table that can't be counted shows an error)
- **Confirm** and **Cancel**

Nothing is written at this step.

### Step 2 — Prepare

On confirm, `POST /admin/backup/prepare` creates the folder under the backup parent folder in Drive:

- name `YYYY-MM-DD`; if it already exists, `YYYY-MM-DD_1`, `_2`, … up to `_9`
- returns `{ folderId, folderName, folderUrl }`

If the folder can't be created, the modal shows the error and stops.

### Step 3 — Export, one table at a time

The browser then calls `POST /admin/backup/run-table` **once per table, in order**, with `{ tableName, folderId }`. Each call:

1. scans the whole table (all users)
2. converts it to CSV
3. uploads `<TableName>.csv` to the folder
4. returns `{ table, rows, ok, error? }`

The modal updates each row as it goes: pending → running → ✓ or ✗ with the row count.

Splitting the work per table keeps every request well under API Gateway's 29-second limit, and one failed table doesn't stop the rest.

### Step 4 — Result

When every table is done, the modal shows each table's status and row count, a link to the Drive folder, and **Close**.

---

## CSV Format

- Header row: the union of every attribute name across the table's items, sorted alphabetically
- One row per item; missing attributes are empty
- Objects and arrays are written as JSON strings
- Values containing a comma, quote or newline are quoted, with quotes doubled
- An empty table produces an empty file

---

## Tables Backed Up

All 11 tables in the `finance4tura-backend` stack (the `TABLES` list in `adminBackup.mjs`):

| Table | Primary Key |
|---|---|
| `Incomes` | `incomeId` |
| `Expenses` | `expenseId` |
| `InvestmentOperations` | `operationId` |
| `PortfolioSnapshots` | `snapshotId` |
| `SplitPayments` | `splitPaymentId` |
| `AppSettings` | `settingKey` |
| `FxRates` | `rateId` |
| `Books_and_Dev` | `bookId` |
| `HQ_Locations` | `hqId` |
| `HQ_Templates` | `templateId` |
| `HQ_Entries` | `entryId` |

Adding a table to the stack means adding it to `TABLES` **and** to the function's `dynamodb:Scan` policy in `template.yaml`.

---

## Google Drive Integration

### Authentication

The backup writes as a real Google account via **OAuth2 with a refresh token** (not a service account), so the files belong to that account and use its Drive quota.

- Credentials `{ client_id, client_secret, refresh_token }` are stored in SSM Parameter Store as the SecureString `/finance4tura/gdrive-oauth2`.
- The Lambda reads them once per container and exchanges the refresh token for an access token at `https://oauth2.googleapis.com/token`.
- The parent folder (`4TURA_DB_Backups`) is the Lambda environment variable `GDRIVE_BACKUP_FOLDER_ID`.

### Calls

Plain `fetch` against the Drive v3 REST API — no `googleapis` dependency. Every call passes `supportsAllDrives=true`.

---

## API Endpoints

All require the `admin` group. Responses carry `Cache-Control: no-store`.

### `GET /admin/backup/preview`

```json
{
  "folderName": "2026-10-12",
  "tables": [
    { "name": "Incomes", "count": 142 },
    { "name": "Expenses", "count": 378 }
  ]
}
```

A table that fails to count returns `"count": -1` and an `"error"`.

### `POST /admin/backup/prepare`

```json
{
  "folderId": "1AbC…",
  "folderName": "2026-10-12_1",
  "folderUrl": "https://drive.google.com/drive/folders/1AbC…"
}
```

### `POST /admin/backup/run-table`

Body: `{ "tableName": "Incomes", "folderId": "1AbC…" }`. 400 if either is missing.

```json
{ "table": "Incomes", "rows": 142, "ok": true }
```

On failure it still returns 200, with `"ok": false` and an `"error"` message.

---

## Backend

- Handler: `backend/src/handlers/adminBackup.mjs`
- SAM function: `AdminBackupFunction`
  - Runtime `nodejs22.x` (global), timeout **300 s**, memory **512 MB**
  - Environment: `GDRIVE_BACKUP_FOLDER_ID`
  - IAM: `dynamodb:Scan` on the 11 tables; `ssm:GetParameter` on `/finance4tura/gdrive-oauth2`

## Frontend

- `frontend/src/pages/Admin.jsx`, **Database Backup** section
- `frontend/src/api/adminBackup.js`: `backupPreview()`, `backupPrepare()`, `backupRunTable(tableName, folderId)`
- Modal phases: `loading` → `preview` → `running` → `done`

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Preview fails | Error shown under the button; no modal |
| A table can't be counted | Its preview row shows an error; the backup still runs |
| Folder can't be created (auth failure, `_9` exhausted) | Result shows the error; no tables exported |
| One table fails to scan or upload | Marked ✗ with the error; the others continue |
| A run-table request fails outright | Marked ✗; the others continue |

Files already uploaded stay in Drive whatever happens later.

---

## Out of Scope

- Scheduled backups
- Restore from backup
- Choosing which tables to back up
- Encrypting the CSVs
- Retention or clean-up of old folders
