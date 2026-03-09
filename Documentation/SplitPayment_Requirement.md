# Phase 10 – Split Payment Module

## Overview

A new desktop-only module that allows the user to log advance payments split into multiple occurrences and track when the total amount has been fully covered.

---

## Functional Requirements

### FR-1 Platform Availability
The Split Payment module **must** be available only in the desktop (web) interface. It **must not** appear in the mobile bottom-tab navigation, nor be accessible from any mobile navigation element.

### FR-2 Navigation Entry
A dedicated "Split Payments" link **must** appear in the top navigation bar (desktop only), alongside the existing navigation items (Add Income, Add Expense, Statistics, Settings, Backstage).
Route: `/split-payments`

### FR-3 Page Layout
The Split Payments page **must** contain:
- A page heading ("Split Payments") and a short descriptive subtitle.
- An **"Add New Split Payment"** button, positioned in the page header area.
- A data table listing all existing split payment entries (see FR-5).
- An empty-state message when no entries exist.

### FR-4 Create Split Payment Form
Pressing "Add New Split Payment" **must** open a modal form with the following fields:

| Field | Type | Constraints |
|---|---|---|
| Created Date | Read-only, auto-filled | Current date (`YYYY-MM-DD`), not editable by the user |
| Title | Text input | Mandatory |
| Amount | Number input | Mandatory; must be > 0 |
| Currency | Dropdown | Options: `RON`, `EUR`, `USD`; default `RON` |
| Number of Occurrences | Integer input | Mandatory; range 1–36 |
| Occurrence Type | Dropdown | `amount` – occurrences split the total equally; `date` – occurrences record individual payment dates |

Pressing **Save** validates all mandatory fields and, on success, appends the new entry to the list and closes the modal.
Pressing **Cancel** or clicking the overlay dismisses the modal without saving.

### FR-5 Split Payment Table
Each split payment entry **must** be rendered as a single table row containing:

**Fixed columns** (always present):
| Column | Description |
|---|---|
| Date | The date the entry was created (`YYYY-MM-DD`) |
| Title | The payment title |
| Amount | The total amount (formatted with locale separators) |
| Currency | The currency code |

**Dynamic occurrence columns** (one column per occurrence, up to the maximum across all visible rows):
- Each cell represents one occurrence of the split payment.
- Behaviour depends on **Occurrence Type**:
  - **amount**: the cell displays the equal installment value (`totalAmount ÷ occurrenceCount`), and can be toggled between **paid** (green) and **unpaid** (grey).
  - **date**: the cell displays the date on which the occurrence was marked as paid, or `—` if not yet paid. Clicking toggles paid status and auto-records today's date on the first paid transition.
- If a row has fewer occurrences than the maximum, trailing cells are rendered empty.

**Trailing columns**:
| Column | Description |
|---|---|
| Coverage | Badge showing `paidCount / totalCount`; turns green with a checkmark (✓) when fully covered |
| Actions | Delete button (✕) to permanently remove the entry |

### FR-6 Occurrence Toggle
Clicking an occurrence cell **must** toggle its `paid` state between `true` and `false`.
When toggled to `paid` for the first time, `paidDate` is set to today's date.
When toggled back to unpaid, `paidDate` is cleared.

### FR-7 Data Persistence
All split payment entries **must** persist across page refreshes and browser sessions using `localStorage` (key: `split_payments_v1`). No backend API call is required for this module.

### FR-8 Delete Entry
Clicking the delete button (✕) on a row **must** permanently remove that entry from the list and from localStorage.

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | The feature is frontend-only; no new backend Lambda, DynamoDB table, or API Gateway route is required. |
| NFR-2 | The module must follow the existing design system (CSS variables, `var(--surface)`, `var(--border)`, `var(--text)`, etc.). |
| NFR-3 | The table must be horizontally scrollable when the number of occurrence columns overflows the viewport. |
| NFR-4 | The feature must not be present in the mobile tab bar or accessible through any mobile navigation element. |

---

## Acceptance Tests

| # | Test | Expected Result |
|---|---|---|
| 10.1 | Navigate to `/split-payments` on desktop | Page loads with heading, subtitle, "Add New Split Payment" button, and empty-state message |
| 10.2 | Click "Add New Split Payment" | Modal opens with all form fields; Created Date pre-filled with today |
| 10.3 | Submit form with all required fields (title, amount, currency, 3 occurrences, type = amount) | Row appears with 3 occurrence cells each showing `amount/3`; coverage badge shows `0/3` |
| 10.4 | Click first occurrence cell | Cell turns green; coverage badge updates to `1/3` |
| 10.5 | Click all occurrence cells | All cells green; coverage badge shows `3/3 ✓` |
| 10.6 | Click a green occurrence cell | Cell reverts to grey; coverage badge decrements |
| 10.7 | Refresh the page | Entries are still present (localStorage persisted) |
| 10.8 | Click ✕ on a row | Row removed immediately; localStorage updated |
| 10.9 | Create entry with type = date; mark an occurrence as paid | Cell displays today's date; toggle back clears the date |
| 10.10 | View app on mobile | "Split Payments" link is absent from bottom tab bar; feature not accessible via mobile navigation |
