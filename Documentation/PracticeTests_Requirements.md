# Practice Tests Module — Requirements

## Overview

A new module for the 4Tura Nest family app that allows tracking test results for kids. The module is template-driven: an admin first defines test templates (subject, topic breakdown, default points), then records test results against those templates. A statistics view provides per-template and cross-template performance insights.

The module is available on both **desktop** (via the top navigation bar) and **mobile** (via the bottom tab bar), because parents and kids will use it from phones as well as the main computer.

---

## Goals

1. Allow any authenticated user to define reusable test templates with flexible topic structures.
2. Provide a fast result-entry form pre-filled from the template to reduce manual input.
3. Auto-calculate total scores consistently (no manual arithmetic).
4. Offer meaningful statistics per kid, per template, and across all templates.
5. Maintain the existing design system (CSS variables, dark/light themes, consistent table and modal patterns).

---

## Functional Requirements

### FR-1 Navigation Entry

A **"Tests"** link must appear:
- In the desktop top navigation bar, inside the existing **Finance dropdown** group — or as a standalone top-level link. Placement decision left to implementation, but it must be reachable in one click from any page.
- In the mobile bottom tab bar as a sixth tab with an appropriate icon (e.g., a clipboard/checklist icon). The existing five tabs are: Home · Expense · Income · AI · Settings. The "Tests" tab is added as the sixth.

Route: `/practice-tests`

### FR-2 Page Layout

The Practice Tests page is a single-route page with four tabs at the top. Tab order and default:

- **Statistics** *(default — first tab, shown on load)* — performance charts, summary grades bar, topic pass-rate blocks.
- **Tests** *(formerly "Results")* — select a template and view/enter results.
- **Templates** — list and manage test templates.
- **Kids** — manage the kid list.

### FR-3 Kid List Configuration

The list of kid names used in result entries is a configurable, ordered list stored per `userId`. It is managed in one of the following two locations (implementation chooses one):

**Option A**: A dedicated "Kids" section inside the existing **Settings** page (`/settings`), consistent with how other app-wide configuration is managed.

**Option B**: A "Kids" panel within the Practice Tests page itself, accessible via a gear/config icon.

The kid list stores:
- `kidName` (string, unique within the list, max 50 characters)
- `order` (integer, for display ordering)

Operations: add, rename, reorder (drag or up/down arrows), delete. Deleting a kid from the config list does **not** delete historical result rows that reference that kid name — the name is stored as a plain string on each result record.

There is no system-wide minimum number of kids; an empty list is valid (result entry will show a free-text fallback input instead of a dropdown).

---

## DynamoDB Schema

### Table: `TestTemplates`

| Attribute | Type | Notes |
|---|---|---|
| `templateId` | String (PK) | UUID, generated at creation |
| `userId` | String | Cognito `sub`; all queries filter by this |
| `name` | String | Template display name, e.g. "Matematică cls. 4" |
| `subject` | String | Optional subject label (e.g. "Matematică", "Română") |
| `freePoints` | Number | Non-negative integer; points granted automatically regardless of topic scores |
| `topics` | List of Map | Ordered list of up to 20 topics (see structure below) |
| `createdAt` | String | ISO 8601 timestamp, set at creation |
| `updatedAt` | String | ISO 8601 timestamp, updated on every PUT |

**Topic map structure** (element of `topics` list):
```
{
  "topicId":       String  // short UUID or sequential index string, unique within the template
  "title":         String  // e.g. "Adunare și scădere"
  "defaultPoints": Number  // non-negative integer, pre-filled in results
}
```

**Constraints**:
- `name`: required, max 100 characters.
- `freePoints`: required, integer ≥ 0.
- `topics`: list, 0–20 items. At least 1 topic OR freePoints > 0 must be present (a template with 0 topics and 0 free points is rejected).
- Each topic `title`: required, max 100 characters.
- Each topic `defaultPoints`: required, integer ≥ 0.

**GSI**: `userId-createdAt-index`
- Partition key: `userId`
- Sort key: `createdAt`
- Purpose: list all templates for a user sorted by creation date without a full table scan.

---

### Table: `TestResults`

| Attribute | Type | Notes |
|---|---|---|
| `resultId` | String (PK) | UUID, generated at creation |
| `userId` | String | Cognito `sub` |
| `templateId` | String | FK reference to `TestTemplates.templateId` |
| `templateName` | String | Denormalized snapshot of template name at time of entry |
| `kidName` | String | Selected from kid list or free-text; stored as plain string |
| `date` | String | Test date, `YYYY-MM-DD`; defaults to current day |
| `sourceTitle` | String | Free-text description, e.g. "Lucrare scrisă semestrul 1" |
| `freePoints` | Number | Editable; pre-filled from template's `freePoints` |
| `topicScores` | List of Map | One entry per template topic (see structure below) |
| `totalScore` | Number | Auto-calculated: `(freePoints + sum(topicScores[*].points)) / 10`, 1 decimal place |
| `verified` | Boolean | Default `false`; toggled manually |
| `createdAt` | String | ISO 8601 timestamp |
| `updatedAt` | String | ISO 8601 timestamp |

**Topic score map structure** (element of `topicScores` list):
```
{
  "topicId":  String  // matches TestTemplates.topics[*].topicId
  "title":    String  // snapshot of topic title at time of entry
  "points":   Number  // actual points awarded; non-negative integer
}
```

**Constraints**:
- `templateId`: required; backend validates the referenced template exists and belongs to same `userId`.
- `kidName`: required, max 50 characters.
- `date`: required, `YYYY-MM-DD` format.
- `freePoints`: required, integer ≥ 0.
- Each `topicScores[*].points`: required, integer ≥ 0.
- `totalScore`: computed by backend on every write; never accepted from client.
- `verified`: boolean, defaults to `false` if omitted.

**GSIs**:

1. `userId-date-index`
   - Partition key: `userId`
   - Sort key: `date`
   - Purpose: fetch all results for a user within a date range.

2. `userId-templateId-index`
   - Partition key: `userId`
   - Sort key: `templateId`
   - Purpose: fetch all results for a specific template efficiently.

---

### Table: `KidConfig`

| Attribute | Type | Notes |
|---|---|---|
| `userId` | String (PK) | Cognito `sub`; one record per user |
| `kids` | List of Map | Ordered list of kid entries |

**Kid map structure**:
```
{
  "kidId":   String  // UUID, stable identifier for ordering/rename operations
  "name":    String  // display name, unique within the list
  "order":   Number  // integer, ascending; used for sort order in dropdowns
}
```

**Design note**: The full kid list is stored as a single DynamoDB item keyed by `userId`, making it a single read/write per user.

---

## API Endpoints

All endpoints require Cognito JWT via the `Authorization` header (same pattern as existing endpoints). All responses include `Cache-Control: no-store`.

### Test Templates

#### `GET /practice-tests/templates`
Returns all templates for the authenticated user, sorted by `createdAt` descending.

**Response** `200`:
```json
[
  {
    "templateId": "uuid",
    "name": "Matematică cls. 4",
    "subject": "Matematică",
    "freePoints": 10,
    "topics": [
      { "topicId": "t1", "title": "Adunare", "defaultPoints": 20 }
    ],
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-01-15T10:00:00Z"
  }
]
```

#### `POST /practice-tests/templates`
Creates a new template.

**Request body**:
```json
{
  "name": "Matematică cls. 4",
  "subject": "Matematică",
  "freePoints": 10,
  "topics": [
    { "title": "Adunare și scădere", "defaultPoints": 20 },
    { "title": "Înmulțire", "defaultPoints": 30 }
  ]
}
```
Backend generates `templateId`, `topicId` for each topic, `createdAt`, `updatedAt`.

**Response** `201`: Full created template object.

**Validation errors** `400`:
- `name` missing or empty.
- `freePoints` < 0 or non-integer.
- `topics` has more than 20 items.
- Any topic missing `title` or having `defaultPoints` < 0.
- Template has 0 topics and `freePoints` = 0.

#### `GET /practice-tests/templates/{templateId}`
Returns a single template. Returns `404` if not found or belongs to a different user.

#### `PUT /practice-tests/templates/{templateId}`
Replaces all mutable fields. Accepts same body shape as POST (minus `templateId`). Updates `updatedAt`. Topic list may be reordered, items added or removed (up to 20). Existing `topicId` values must be preserved for topics that are retained; new topics receive new `topicId` values. **Does not retroactively update existing result rows** (topic scores on results are snapshots).

**Response** `200`: Updated template object.

#### `DELETE /practice-tests/templates/{templateId}`
Deletes the template. Associated results are **not** automatically deleted — they remain in `TestResults` with the `templateId` preserved (orphaned results shown in UI with a warning indicator).

**Response** `200`: `{ "deleted": true }`

---

### Test Results

#### `GET /practice-tests/results`
Returns results for the authenticated user.

**Query parameters** (all optional):
- `templateId` — filter to a specific template.
- `kidName` — filter to a specific kid.
- `from` — date lower bound (`YYYY-MM-DD`).
- `to` — date upper bound (`YYYY-MM-DD`).

Results returned sorted by `date` descending, then `createdAt` descending.

**Response** `200`: Array of result objects.

#### `POST /practice-tests/results`
Creates a new result entry.

**Request body**:
```json
{
  "templateId": "uuid",
  "kidName": "Andrei",
  "date": "2026-03-22",
  "sourceTitle": "Lucrare scrisă semestrul 1",
  "freePoints": 10,
  "topicScores": [
    { "topicId": "t1", "title": "Adunare și scădere", "points": 18 },
    { "topicId": "t2", "title": "Înmulțire", "points": 25 }
  ],
  "verified": false
}
```

Backend:
1. Validates `templateId` exists and belongs to `userId`.
2. Validates `topicScores` list matches template topic count (same `topicId` set); extra or missing topics → `400`.
3. Computes `totalScore = (freePoints + sum(topicScores[*].points)) / 10`, rounded to 1 decimal.
4. Stores the record with `createdAt`, `updatedAt`.

**Response** `201`: Full created result object including computed `totalScore`.

#### `GET /practice-tests/results/{resultId}`
Returns a single result. `404` if not found or belongs to different user.

#### `PUT /practice-tests/results/{resultId}`
Updates a result. Accepts same body as POST minus `templateId` (template cannot be changed after creation). Backend recomputes `totalScore`. Updates `updatedAt`.

**Response** `200`: Updated result object.

#### `DELETE /practice-tests/results/{resultId}`
Deletes the result permanently.

**Response** `200`: `{ "deleted": true }`

---

### Kid Configuration

#### `GET /practice-tests/kids`
Returns the kid list for the authenticated user.

**Response** `200`:
```json
{
  "kids": [
    { "kidId": "uuid", "name": "Andrei", "order": 1 },
    { "kidId": "uuid", "name": "Maria",  "order": 2 }
  ]
}
```
Returns `{ "kids": [] }` if no kids configured yet.

#### `PUT /practice-tests/kids`
Replaces the entire kid list. Backend upserts the single `KidConfig` item for this `userId`.

**Request body**:
```json
{
  "kids": [
    { "kidId": "uuid", "name": "Andrei", "order": 1 },
    { "kidId": "uuid", "name": "Maria",  "order": 2 }
  ]
}
```

Backend generates new `kidId` for kids without one. Names must be unique within the list (case-insensitive). Max 20 kids.

**Response** `200`: Full saved kid config object.

**Validation errors** `400`:
- Duplicate kid names.
- More than 20 kids.
- Any `name` empty or > 50 characters.

---

## Frontend Pages & Components

### Route: `/practice-tests`

**File**: `frontend/src/pages/PracticeTests.jsx`

The page has a sub-navigation row (tabs) with:
- **Templates** tab
- **Results** tab (disabled until at least one template exists)
- **Statistics** tab (disabled until at least one result exists)

---

### Templates Tab

#### Template List Panel

- Displays all templates as cards or table rows.
- Each row shows: `name`, `subject`, topic count, `freePoints`, creation date, and action buttons (Edit, Delete).
- Empty state: "No templates yet. Create your first template to get started."
- **"Add Template"** button in the panel header.

#### Add/Edit Template Modal

Fields:

| Field | Type | Constraint |
|---|---|---|
| Template Name | Text input | Required, max 100 chars |
| Subject | Text input | Optional, max 100 chars |
| Free Points | Number input | Required, integer ≥ 0; default 0 |
| Topics (list) | Repeatable section | 0–20 items |

Topics section:
- Each topic row: **Topic Title** (text input, required) + **Default Points** (number input, integer ≥ 0, required) + remove (✕) button.
- **"Add Topic"** button appends a blank row (disabled when 20 topics reached).
- Topics can be reordered via up/down arrow buttons.

Buttons: **Save** | **Cancel**.

#### Delete Template Confirmation

Inline confirmation: *"Delete this template? Existing results linked to it will remain but show as orphaned."* Confirmed deletion calls `DELETE /practice-tests/templates/{templateId}`.

---

### Results Tab

#### Template Selector

A dropdown at the top listing all templates by name. Most recently created selected by default.

#### Results Table

| Column | Notes |
|---|---|
| Date | `YYYY-MM-DD`; sortable |
| Kid | Kid name |
| Source / Title | Free-text description |
| Free Pts | Editable inline number cell |
| One column per topic | Header = topic title; cell = awarded points; editable inline |
| Total Score | Read-only; auto-calculated; 1 decimal (e.g. `8.5`) |
| Verified | Toggle Yes/No; default No; green badge when Yes |
| Actions | Edit (pencil) + Delete (✕) |

- Table is horizontally scrollable when topic columns overflow viewport.
- Rows sorted by `date` descending by default; column headers toggle sort direction.
- Empty state: "No results for this template yet."

#### Add / Edit Result Modal

Triggered by **"Add Result"** button. Pre-filled from the selected template.

| Field | Type | Default |
|---|---|---|
| Kid Name | Dropdown (from kid list) | First kid, or free-text if list is empty |
| Date | Date picker | Today |
| Source / Title | Text input | Empty |
| Free Points | Number input | Template's `freePoints` |
| Topic scores | One row per topic | Template's `defaultPoints` each |

Live **Total Score preview** shown below the form: `(freePoints + Σ topicPoints) / 10`.

If topic score exceeds `defaultPoints`, the cell shows a soft amber highlight (warning only, not a block).

#### Inline Verification Toggle

Clicking the Verified cell immediately calls `PUT /practice-tests/results/{resultId}` with the toggled value. No separate save needed.

---

### Statistics Tab

Default tab when the page loads.

#### Summary Bar (top card)

Horizontal card with three sections separated by vertical dividers:

1. **Kid filter** — dropdown to filter all stats and chart to a specific kid (or "All").
2. **Last 5** — overall average grade (mean of per-template averages, large `var(--text)` number) + per-template average of the last 5 results for each template (template color, smaller).
3. **All tests** — same structure using all results instead of last 5.

All three summary numbers are unaffected by template toggle buttons — they always reflect all templates.

#### Template Toggle Buttons

Pill buttons (one per template, colored) placed inside the Grade Evolution chart card header. Clicking a button shows/hides that template's chart line and its Topic Pass Rate block below. Inactive buttons are dimmed.

#### Grade Evolution Chart (left 70%)

Line chart (`LineChart`):
- X axis: test date; Y axis: `totalScore / 10` (range 8–10)
- One line per template (colors stable by template index)
- Grade labels above each dot (SVG `<rect>` pill + colored `<text>`)
- Verified test dots shown with a red outer ring
- Dashed average reference line per template
- `isNaN(cy)` guard on custom dot renderer prevents phantom half-dots at chart top
- Chart top margin 36px ensures labels are never clipped

#### Monthly Calendar (right 30%)

Color-coded day cells per template with nav arrows.

#### Topic Pass Rate Blocks

One block per visible (non-hidden) template below the chart/calendar row. Kid filter applies. Each block shows per-kid pass rates per topic.

---

## Business Logic Rules

### Scoring Formula

```
totalScore = (freePoints + sum of all topic scores) / 10
```

- Rounded to **1 decimal place** (standard rounding).
- No hard maximum — topic scores may exceed `defaultPoints` (soft warning only).
- Minimum is `0.0`.
- **Computed by the backend on every POST and PUT.** Client may show a live preview but must never persist a client-computed value.

### Kid List Rules

- Kid names stored as plain strings on result records (denormalized snapshot).
- Renaming a kid in `KidConfig` does **not** retroactively update past results.
- Deleting a kid from `KidConfig` does **not** delete their results.
- If the kid list is empty at time of entry, a free-text input is used; the value is stored as-is.

### Template Edit Rules

- Editing a template's topic list does **not** retroactively update existing result rows — results capture a snapshot of `title` and `points` at entry time.
- `topicId` values of retained topics must be preserved across edits.
- Changing `freePoints` or `defaultPoints` on a template only affects **new** results.

### Verified Flag

- Default: `false`.
- Represents a parent/teacher has reviewed and confirmed the score.
- No effect on score calculations or statistics filtering (all results included equally unless a future filter is added).
- UI: verified rows show a green "✓ Yes" badge; unverified show a muted "No".

### Date Handling

- All dates stored as `YYYY-MM-DD` strings.
- Default date in Add Result form is the current **client-side** date (consistent with existing expense/income entry).

---

## Edge Cases and Constraints

| # | Scenario | Behavior |
|---|---|---|
| EC-1 | Template deleted while results exist | Results remain; UI shows a "Template deleted" warning tag on affected rows |
| EC-2 | Topic awarded points exceed `defaultPoints` | Allowed; frontend shows amber cell highlight; save proceeds normally |
| EC-3 | Template with 0 topics, only `freePoints` | Valid; result form shows only Free Points field; `totalScore = freePoints / 10` |
| EC-4 | All topics have `defaultPoints = 0` | Valid; weakness panel skips these topics to avoid division by zero |
| EC-5 | Kid list is empty | Result form shows free-text input for kid name |
| EC-6 | Two results on same date for same kid | Both rows stored; no deduplication |
| EC-7 | `freePoints` input left blank | Treated as 0 |
| EC-8 | `totalScore` is exactly `0.0` | Valid and displayable |
| EC-9 | Very long template name | Truncated with ellipsis in selectors; full name shown on hover |
| EC-10 | Statistics with only 1 result | All stats computable; best = worst = average |
| EC-11 | Concurrent edits | Last-write-wins (same as existing modules) |
| EC-12 | Mobile layout | Results table horizontally scrollable; Add Result modal opens as full-screen sheet |

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | All Lambda handlers follow existing CORS pattern (`Content-Type`, `Access-Control-Allow-Origin: *`, `Cache-Control: no-store`) |
| NFR-2 | All DynamoDB operations filter by `userId`; no cross-user data leakage |
| NFR-3 | Page uses CSS variables for full dark/light theme support |
| NFR-4 | Results table must be horizontally scrollable when topic columns overflow viewport |
| NFR-5 | `totalScore` always computed by backend; client preview only |
| NFR-6 | All three new DynamoDB tables defined in `backend/template.yaml` |
| NFR-7 | New API routes added as SAM `AWS::Serverless::Function` resources in `template.yaml` |
| NFR-8 | Backstage page (`/backstage`) must display `TestTemplates`, `TestResults`, `KidConfig` tables following the existing expand/collapse pattern |
| NFR-9 | `sync-from-aws.mjs` updated to include all three new tables in its sync list |

---

## New DynamoDB Tables Summary

| Table | PK | GSIs |
|---|---|---|
| `TestTemplates` | `templateId` (String) | `userId-createdAt-index` (PK: userId, SK: createdAt) |
| `TestResults` | `resultId` (String) | `userId-date-index` (PK: userId, SK: date); `userId-templateId-index` (PK: userId, SK: templateId) |
| `KidConfig` | `userId` (String) | none |

---

## New API Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/practice-tests/templates` | List all templates for user |
| `POST` | `/practice-tests/templates` | Create template |
| `GET` | `/practice-tests/templates/{templateId}` | Get single template |
| `PUT` | `/practice-tests/templates/{templateId}` | Update template |
| `DELETE` | `/practice-tests/templates/{templateId}` | Delete template |
| `GET` | `/practice-tests/results` | List results (filterable) |
| `POST` | `/practice-tests/results` | Create result |
| `GET` | `/practice-tests/results/{resultId}` | Get single result |
| `PUT` | `/practice-tests/results/{resultId}` | Update result |
| `DELETE` | `/practice-tests/results/{resultId}` | Delete result |
| `GET` | `/practice-tests/kids` | Get kid config |
| `PUT` | `/practice-tests/kids` | Replace full kid list |

---

## Acceptance Tests

| # | Test | Expected Result |
|---|---|---|
| AT-1 | Navigate to `/practice-tests` | Page loads; Results and Statistics tabs disabled |
| AT-2 | Create a template: "Matematică", freePoints=10, 2 topics | Template appears in list; Results tab enabled |
| AT-3 | Select template in Results tab → click "Add Result" | Modal opens; Free Points = 10; topic rows pre-filled with defaultPoints |
| AT-4 | Enter kid, date, title, change topic scores → Save | Row appears; Total Score = (10 + t1 + t2) / 10 with 1 decimal |
| AT-5 | Click Verified toggle on result row | Flips to Yes; green badge; API called immediately |
| AT-6 | Edit a result and change a topic score | Total Score recomputed correctly after save |
| AT-7 | Delete a result | Row removed; statistics update |
| AT-8 | Edit template, remove a topic | Existing results retain original topic snapshot |
| AT-9 | Delete a template | Template removed; existing results show "Template deleted" warning |
| AT-10 | Add two kids in config → create result | Dropdown shows both kids |
| AT-11 | Select "All Templates" in statistics | Cross-template summary shows all templates |
| AT-12 | Enter topic score higher than defaultPoints | Amber cell highlight; save succeeds |
| AT-13 | View on mobile | Table horizontally scrollable; Add Result opens full-screen |
| AT-14 | Refresh page | All data persists from DynamoDB |
| AT-15 | Template with 0 topics, freePoints=50 → create result | Total score = 5.0 |
