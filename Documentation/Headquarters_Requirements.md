# Headquarters — Feature Requirements

## Overview

Headquarters (HQ) is a configurable metric-tracking module for physical locations (e.g. houses, properties). Users define **Tracker Templates** that describe what to measure (parameters and their types), assign templates to **Locations**, and then log **Entries** over time. The page provides a per-location view of all logged data with inline editing, plus a cross-location dashboard.

---

## Route & Navigation

- **Route**: `/headquarters`
- **Desktop**: accessible from the Sidebar under a new top-level link "Headquarters" (with a suitable icon)
- **Mobile**: not required in this phase

---

## Page Layout — Tabs

The page has a tab bar at the top with the following tabs (in order):

1. **HQ Dashboard** — cross-location summary (always first)
2. **One tab per Location** — named after the location (e.g. "House A", "Apartment")
3. **Settings** — manage Locations and Tracker Templates (always last)

Tabs are dynamic: adding a new Location creates a new tab automatically.

---

## Data Model

### 1. Headquarters (Locations)

A **Headquarters** record represents a named physical location.

| Field | Type | Notes |
|---|---|---|
| `hqId` | String (PK) | UUID |
| `userId` | String | Owner |
| `name` | String | Display name (e.g. "Main House") |
| `address` | String | Optional free text |
| `order` | Number | Tab display order |
| `createdAt` | String | ISO timestamp |

### 2. Tracker Templates

A **Tracker Template** defines what metrics to collect and at which location(s) it applies.

| Field | Type | Notes |
|---|---|---|
| `templateId` | String (PK) | UUID |
| `userId` | String | Owner |
| `hqId` | String | Associated location |
| `name` | String | Template name (e.g. "Water Consumption") |
| `parameters` | Array | Up to 30 parameter definitions (see below) |
| `createdAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**Parameter definition** (within `parameters` array):

| Field | Type | Notes |
|---|---|---|
| `parameterId` | String | UUID within the template |
| `title` | String | Display name (e.g. "Hot Water m³") |
| `type` | Enum | `number`, `text`, `boolean` |
| `unit` | String | Optional unit label (e.g. "m³", "kWh", "°C") |
| `order` | Number | Display order |

Constraints:
- Max **30 parameters** per template (same limit as Practice Tests topics)
- Template name is required
- At least 1 parameter required to save

### 3. Tracker Entries

A **Tracker Entry** is a single logged row for a given template.

| Field | Type | Notes |
|---|---|---|
| `entryId` | String (PK) | UUID |
| `userId` | String | Owner |
| `templateId` | String | Which template this belongs to |
| `hqId` | String | Denormalized from template for fast querying |
| `date` | String | `YYYY-MM-DD`; defaults to today, user-editable |
| `values` | Array | `{ parameterId, title, value }` per parameter |
| `notes` | String | Optional free-text notes field |
| `createdAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

---

## API Endpoints

```
# Locations (HQ)
GET    /headquarters                          List all locations for userId
POST   /headquarters                          Create a location
PUT    /headquarters/{hqId}                   Update a location
DELETE /headquarters/{hqId}                   Delete a location

# Tracker Templates
GET    /headquarters/templates                List all templates (optionally ?hqId=)
POST   /headquarters/templates                Create a template
PUT    /headquarters/templates/{templateId}   Update a template
DELETE /headquarters/templates/{templateId}   Delete a template

# Tracker Entries
GET    /headquarters/entries                  List entries (?templateId=, ?hqId=, ?from=, ?to=)
POST   /headquarters/entries                  Create an entry
PUT    /headquarters/entries/{entryId}        Update an entry
DELETE /headquarters/entries/{entryId}        Delete an entry
```

---

## DynamoDB Tables

### `HQ_Locations`
- **PK**: `hqId`
- Fields: `userId`, `name`, `address`, `order`, `createdAt`
- GSI: `userId-index` on `userId`

### `HQ_Templates`
- **PK**: `templateId`
- Fields: `userId`, `hqId`, `name`, `parameters[]`, `createdAt`, `updatedAt`
- GSI: `userId-hqId-index` on `userId` + `hqId`

### `HQ_Entries`
- **PK**: `entryId`
- Fields: `userId`, `templateId`, `hqId`, `date`, `values[]`, `notes`, `createdAt`, `updatedAt`
- GSI: `templateId-date-index` on `templateId` + `date` (for sorted queries)

---

## Frontend Pages & Components

### File structure

```
frontend/src/pages/Headquarters/
├── index.jsx              # Tab routing, data loading
├── DashboardTab.jsx       # HQ Dashboard tab
├── LocationTab.jsx        # Per-location tab (receives hqId)
├── SettingsTab.jsx        # Manage locations + templates
├── TemplateModal.jsx      # Add/Edit tracker template modal
├── LocationModal.jsx      # Add/Edit location modal
├── EntryTable.jsx         # Inline-editable entries table (reused per template)
└── styles.js              # Shared styles object
```

`App.jsx` adds: `<Route path="/headquarters" element={<Headquarters />} />`

---

## Feature Details

### Settings Tab

#### Locations section
- List of configured locations with name, address, order
- **Add Location** button → `LocationModal`
  - Fields: Name (required), Address (optional)
- Edit / Delete inline per location
- Delete is blocked if location has templates (show warning)

#### Tracker Templates section
- Grouped by location
- Card grid (similar to PracticeTests Templates tab)
- **Add Template** button → `TemplateModal`
- Each card shows: template name, location, parameter count
- Edit / Delete per card

#### TemplateModal
- Fields:
  - **Location** — dropdown of configured locations (required)
  - **Template name** — text input (required)
  - **Parameters** — dynamic list, up to 30 rows:
    - `Title` (text input)
    - `Type` (select: `number` / `text` / `boolean`)
    - `Unit` (text input, optional; shown when type = `number`)
    - Drag-handle or ↑/↓ buttons to reorder
    - Remove (×) button per row
  - **+ Add Parameter** button
- Save / Cancel buttons
- Validation: name required, at least 1 parameter, max 30 parameters

---

### Location Tab (one per HQ location)

- One **section per Tracker Template** assigned to that location
- Each section has:
  - Section header: template name + **+ New Entry** button
  - **EntryTable**: displays all entries for that template

#### EntryTable behaviour
- Columns: `Date` | one column per parameter (with unit in header) | `Notes` | `Actions`
- **Sorted by date descending** (latest first)
- **Inline editing**: clicking ✎ on a row converts all cells to inputs in place (no modal)
  - `date` → date input (default: today)
  - `number` parameter → numeric input
  - `text` parameter → text input
  - `boolean` parameter → checkbox
  - `notes` → text input
- **Auto-save**: same debounced pattern (600 ms) as Practice Tests Results tab
  - First save on a new row creates the record (stores `entryId` via `useRef`)
  - Subsequent saves update it
- Save button flushes pending debounce and exits edit mode
- Delete button (🗑) per row with confirmation
- **+ New Entry** inserts a new editable row at the top with today's date and empty values

---

### HQ Dashboard Tab

- One **summary card per location**
- Each card shows:
  - Location name
  - List of tracker templates at that location
  - For each template: the **most recent entry date** and a preview of the first 3 parameter values
- Acts as a quick status overview; no editing from this tab
- Empty state if no locations configured yet

---

## UX / Design Notes

- Visual style consistent with Practice Tests module (same tab bar style, card grid, inline edit pattern)
- Parameter type icons in column headers: `#` for number, `T` for text, `✓` for boolean
- Boolean values displayed as ✓ / — in read mode, checkbox in edit mode
- Number values right-aligned in table cells; text values left-aligned
- Long text values truncated with ellipsis in read mode (`max-width` + `overflow: hidden`)
- Date column always shows `YYYY-MM-DD`; editable via `<input type="date">`
- Mobile: page not accessible (desktop-only, same as Books & Development)

---

## Backend Validation

- Max 30 parameters per template (HTTP 400 if exceeded)
- `date` field must match `YYYY-MM-DD` format
- `values` array length must match template's `parameters` length
- `amount` / numeric values: no strict range validation (unlike expenses)
- `hqId` must belong to the same `userId`
- `templateId` must belong to the same `userId`

---

## Sidebar Entry

- New top-level link in `Sidebar.jsx` between "Split Pay" and "Investments" (or at bottom of main links)
- Label: **Headquarters**
- Icon: a house/building SVG (new `IconHQ` component)
- Desktop only (not added to `MobileLayout.jsx`)

---

## Out of Scope (Phase 1)

- Charts / trend visualisation per parameter (future phase)
- Alerts / thresholds (e.g. "notify if water > X")
- Export to CSV
- Multiple users sharing a location
- Image attachments per entry
