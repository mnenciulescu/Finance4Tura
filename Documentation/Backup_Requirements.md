# Backup ALL Tables — Feature Requirements

## Overview

A one-click backup feature available on the **Admin page** that exports all DynamoDB tables to CSV files and saves them to a specific Google Drive folder. Intended for full-database snapshots across all users.

---

## Access

- **Page**: `/admin` (existing Admin page, restricted to user `nenciulescu`)
- **Section**: New "Data Backup" section, below existing sections
- **Trigger**: Button labelled **"Backup ALL Tables"**

---

## Flow

### Step 1 — Summary modal (confirmation)

Before writing anything, open a modal that shows:

- **Backup destination**: `4TURA_DB_Backups / <YYYY-MM-DD>` (or `<YYYY-MM-DD>_1`, `_2`, … if a folder for today already exists)
- **Tables to be exported** (list): one row per table with table name and current item count
- **Estimated file count**: equal to number of tables
- **Warning**: "This will export data for ALL users."
- Two buttons: **Confirm & Backup** and **Cancel**

The item counts are fetched from the backend at the time the button is clicked (before showing the modal), so the summary is accurate.

### Step 2 — Export & upload

On confirmation:

1. Backend scans each DynamoDB table in full (no userId filter — all users)
2. Converts each table to CSV:
   - First row: column headers (union of all attribute keys found across items, sorted alphabetically)
   - Subsequent rows: one row per item; values serialised as plain strings; nested objects/arrays serialised as JSON strings; missing fields left empty
3. Creates the destination folder in Google Drive under `4TURA_DB_Backups`:
   - Folder name: `YYYY-MM-DD` (today's date at time of confirmation)
   - If a folder with that name already exists under `4TURA_DB_Backups`, try `YYYY-MM-DD_1`, `YYYY-MM-DD_2`, … until a free name is found
4. Uploads each CSV file to the newly created folder
   - File name: `<TableName>.csv` (e.g. `Incomes.csv`, `Expenses.csv`)
5. Returns a result summary to the frontend

### Step 3 — Result modal

After completion, replace the confirmation modal with a result view showing:

- **Status**: Success or partial failure
- **Folder path**: `4TURA_DB_Backups / <actual folder name used>`
- **Google Drive link** to the folder (direct URL)
- Per-table status: table name, row count exported, ✓ or ✗
- **Close** button

---

## Tables to Back Up

All DynamoDB tables in the `finance4tura-backend` stack:

| Table | Primary Key |
|---|---|
| `Incomes` | `incomeId` |
| `Expenses` | `expenseId` |
| `InvestmentOperations` | `operationId` |
| `PortfolioSnapshots` | `snapshotId` |
| `SP500Monthly` | `monthId` |
| `SplitPayments` | `splitPaymentId` |
| `TestTemplates` | `templateId` |
| `TestResults` | `resultId` |
| `KidConfig` | `userId` |
| `AppSettings` | `settingKey` |
| `Books_and_Dev` | `bookId` |
| `HQ_Locations` | `hqId` |
| `HQ_Templates` | `templateId` |
| `HQ_Entries` | `entryId` |

---

## Google Drive Integration

### Authentication

- Uses a **Google Service Account** with Drive API access
- Service account credentials (JSON key) stored as a Lambda environment variable (`GOOGLE_SERVICE_ACCOUNT_JSON`)
- The service account must be granted **Editor** access to the `4TURA_DB_Backups` folder in Google Drive
- `4TURA_DB_Backups` folder ID stored as a Lambda environment variable (`GDRIVE_BACKUP_FOLDER_ID`)

### Libraries

- Backend: [`googleapis`](https://www.npmjs.com/package/googleapis) Node.js client
- No frontend changes needed for Drive auth — all Drive interaction happens server-side

---

## API Endpoint

### `GET /admin/backup/preview`

Returns a pre-backup summary without writing anything.

**Response**:
```json
{
  "folderName": "2026-03-28",
  "tables": [
    { "name": "Incomes", "count": 142 },
    { "name": "Expenses", "count": 378 },
    ...
  ]
}
```

### `POST /admin/backup/run`

Executes the backup.

**Response**:
```json
{
  "folderName": "2026-03-28",
  "folderUrl": "https://drive.google.com/drive/folders/...",
  "results": [
    { "table": "Incomes", "rows": 142, "ok": true },
    { "table": "Expenses", "rows": 378, "ok": true },
    ...
  ]
}
```

**Auth**: Admin-only (same guard as existing `/app-settings` PUT — checks `userId === "nenciulescu"` or the Cognito `sub` equivalent).

---

## Backend

- New handler file: `backend/src/handlers/adminBackup.mjs`
- New SAM function: `AdminBackupFunction`
  - Runtime: `nodejs20.x`
  - Timeout: **300 seconds** (full scan + Drive upload of 14 tables can be slow)
  - Memory: 512 MB
  - Environment variables:
    - `GOOGLE_SERVICE_ACCOUNT_JSON` — stringified service account key JSON
    - `GDRIVE_BACKUP_FOLDER_ID` — Google Drive folder ID for `4TURA_DB_Backups`
  - IAM: `dynamodb:Scan` on all tables

---

## Frontend

- New section in `Admin.jsx`: **"Database Backup"**
- Single button: **"Backup ALL Tables"**
- On click:
  1. Call `GET /admin/backup/preview` → show summary modal (spinner while loading)
  2. User confirms → call `POST /admin/backup/run` → show progress spinner → show result modal
- Modal reuses the existing Admin page modal style

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Drive auth failure | Result modal shows error; partial uploads listed |
| Single table scan failure | Continue with remaining tables; mark that table ✗ in results |
| Folder creation conflict (race) | Retry with next suffix (`_1`, `_2`, …) up to `_9`; fail with error beyond that |
| Lambda timeout | Frontend shows a timeout error; any completed uploads are retained in Drive |

---

## Out of Scope

- Scheduled / automatic backups (future phase)
- Restore from backup
- Selective table backup
- Encryption of CSV files
- Backup retention / cleanup policy
