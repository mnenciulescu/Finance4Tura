# Headquarters — Feature Requirements

## Overview

Headquarters (HQ) tracks readings for physical locations (houses, flats). Users define **Tracker Templates** that describe what to measure, attach them to **Locations**, and log **Entries** over time. Each location gets its own tab, and a dashboard summarises them all, with water-consumption charts where the meters allow it.

---

## Route & Navigation

- **Route**: `/headquarters`
- **Navigation**: the **HQ** tab in the bottom bar (Home · Finance · Books · HQ)
- One phone-width layout (430 px column) on every screen, like the rest of the app

---

## Page Layout — Tabs

A horizontal tab strip, in this order:

1. **HQ Dashboard** — cross-location summary (always first)
2. **One tab per Location** — named after the location
3. **Settings** — manage locations and templates (always last)

Adding a location adds its tab and switches to it. Deleting the active location returns to the Dashboard.

---

## Data Model

### 1. Locations

| Field | Type | Notes |
|---|---|---|
| `hqId` | String (PK) | UUID |
| `userId` | String | Owner |
| `name` | String | Required |
| `address` | String | Optional |
| `order` | Number | Tab order |
| `createdAt` | String | ISO timestamp |

### 2. Tracker Templates

| Field | Type | Notes |
|---|---|---|
| `templateId` | String (PK) | UUID |
| `userId` | String | Owner |
| `hqId` | String | Location it belongs to |
| `name` | String | e.g. "Water Consumption" |
| `parameters` | Array | 1–30 parameter definitions |
| `createdAt`, `updatedAt` | String | ISO timestamps |

**Parameter**:

| Field | Type | Notes |
|---|---|---|
| `parameterId` | String | UUID within the template |
| `title` | String | Required, e.g. "Baie - Apa Rece" |
| `type` | Enum | `number`, `text`, `boolean` |
| `unit` | String | Optional, e.g. "m³", "kWh" |
| `order` | Number | Display order |

### 3. Tracker Entries

| Field | Type | Notes |
|---|---|---|
| `entryId` | String (PK) | UUID |
| `userId` | String | Owner |
| `templateId` | String | Template it belongs to |
| `hqId` | String | Denormalized from the template |
| `date` | String | `YYYY-MM-DD`; defaults to today |
| `values` | Array | `{ parameterId, title, value }` per parameter |
| `notes` | String | Optional |
| `createdAt`, `updatedAt` | String | ISO timestamps |

---

## API Endpoints

```
# Locations
GET    /headquarters                          List the user's locations
POST   /headquarters                          Create
PUT    /headquarters/{hqId}                   Update
DELETE /headquarters/{hqId}                   Delete — 400 while it has templates

# Tracker Templates
GET    /headquarters/templates                List (optional ?hqId=)
POST   /headquarters/templates                Create
PUT    /headquarters/templates/{templateId}   Update
DELETE /headquarters/templates/{templateId}   Delete

# Tracker Entries
GET    /headquarters/entries                  List (?templateId=, ?hqId=, ?from=, ?to=), newest first
POST   /headquarters/entries                  Create
PUT    /headquarters/entries/{entryId}        Update
DELETE /headquarters/entries/{entryId}        Delete
```

All routes are handled by one Lambda, `HQFunction` (`backend/src/handlers/headquarters.mjs`).

---

## DynamoDB Tables

| Table | PK | Indexes |
|---|---|---|
| `HQ_Locations` | `hqId` | none |
| `HQ_Templates` | `templateId` | none |
| `HQ_Entries` | `entryId` | none |

There are no GSIs: list calls scan and filter by `userId` (plus `hqId` / `templateId` / date range where given). Fine at personal scale.

---

## Frontend Files

```
frontend/src/pages/Headquarters/
├── index.jsx              # Tabs, data loading, mutation handlers
├── DashboardTab.jsx       # HQ Dashboard (incl. water charts)
├── LocationTab.jsx        # One location; computed consumption columns
├── SettingsTab.jsx        # Locations + templates
├── EntryTable.jsx         # Entry cards with auto-saving edit mode
├── LocationModal.jsx      # Add/Edit location
├── TemplateModal.jsx      # Add/Edit template
├── Modal.jsx              # Shared modal shell
├── styles.js              # Shared styles
└── Headquarters.test.jsx  # Render tests (4)
```

---

## Feature Details

### Settings Tab

**Locations**
- List with name and address; **Add Location** opens `LocationModal` (name required, address optional).
- Edit and delete per location. Deleting a location that still has templates is refused with a message.

**Tracker Templates**
- Grouped by location; each shows its name, its first five parameters (with units) and `+N more`, plus edit and delete. Delete asks for a second tap (`🗑` → `⚠ Del?`).
- **Add Template** opens `TemplateModal`:
  - **Location** (required) and **Template name** (required)
  - **Parameters** (`n/30`): title, type (`number` / `text` / `boolean`), optional unit, ▲ / ▼ to reorder, × to remove
  - **+ Add Parameter**, disabled at 30
  - Needs at least one parameter to save

### Location Tab

- One section per template at that location, each with a **+ New Entry** button.
- Entries are **cards, newest first**. The collapsed head shows the date and the first two or three values.
- **Editing** turns a card into stacked, labelled inputs: date, then one input per parameter (number, text or checkbox), then notes.
- **Auto-save**: edits save after a 600 ms pause. A new entry is created on its first save and updated afterwards.
- **Delete** is the two-step inline confirm (`Delete` → `Tap to confirm`, reverting after 4 s).

#### Water consumption columns
If a template has all four meters — `Baie - Apa Rece`, `Bucatarie - Apa Rece`, `Baie - Apa Calda`, `Bucatarie - Apa Calda` — the location tab adds computed **Consum Apa Rece** and **Consum Apa Calda** values to each entry: the combined consumption since the previous reading.

### HQ Dashboard Tab

- One block per location: name and address, then each of its templates.
- A **water template** (all four meters present) shows a consumption chart with averages, or "Not enough data."
- Any other template shows a read-only list of its latest entries.
- Read-only; no editing here.
- Empty state: "No locations configured yet. Go to Settings to add your first location."

---

## UX / Design Notes

- Design tokens only; one phone-width column.
- Parameter type icons: `#` number, `T` text, `✓` boolean.
- Booleans read as ✓ / —; empty values as —.
- Inputs at 16 px so iOS doesn't zoom.

---

## Backend Validation

| Rule | Response |
|---|---|
| Location `name` required | 400 |
| Template needs `hqId`, `name`, and 1–30 parameters | 400 |
| Each parameter needs a title and a type of `number` / `text` / `boolean` | 400 |
| Template's `hqId` must belong to the caller | 400 "location not found" |
| Entry needs `templateId`, `hqId`, and `date` as `YYYY-MM-DD` | 400 |
| Entry's template and location must belong to the caller | 400 |
| Location with templates can't be deleted | 400 |

Values aren't range-checked, and the number of `values` isn't checked against the template.

---

## Out of Scope

- Charts for templates other than the water template
- Alerts and thresholds
- Export to CSV (the Admin backup covers raw data)
- Sharing a location between users
- Attachments
