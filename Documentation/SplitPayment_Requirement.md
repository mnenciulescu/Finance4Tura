# Phase 10 – Split Payment Module

## Overview

Log a payment that's split into instalments, record each instalment as it's paid (by amount or by date), and see when the total is covered.

The module lives on Money → Split (`/money/split`) and as a widget on Today (`/`). Both share the same slot rules.

**Files**: `frontend/src/features/money/split/` (`SplitScreen.tsx`, `SplitSlots.tsx`, `useSplitEditor.ts`, `SplitFormSheet.tsx`), the Split widget in `frontend/src/features/today/Today.tsx`, `frontend/src/ui/DatePicker.tsx`, `backend/src/handlers/splitPayments.mjs`.

---

## Functional Requirements

### FR-1 Navigation
- Route: Money → **Split** segment (`/money/split`; old `/split-payments` redirects).
- Today's **Split Payments** widget (three newest open entries) links to it with *See All*.
- One phone-width layout (430 px column) on every screen.

### FR-2 Page layout
- **Header**: title, `N open · M settled`, the amount left to cover per currency, and a **+ New** button.
- **In progress** group: every open entry, always listed.
- **Settled** group: fully covered entries, collapsed behind a toggle.
- Empty state when there are no entries.

### FR-3 Entry card
- A 3 px progress track shows `paid / occurrenceCount`.
- Open entries start **expanded**, settled ones **collapsed**. Tapping the head toggles either way.
- The collapsed head shows title, coverage badge, date, total and remaining amount.

### FR-4 Slots
- An entry always shows **exactly `occurrenceCount` slots**. The count belongs to the series and is set on create or edit; nothing else adds or removes slots. A stored array that's short or long is padded or trimmed on display, and every write sends the full count.
- Slots sit **two per row** for both kinds of entry. Each slot has an index badge (`#1`, `#2`, …) and nothing beside it.
- **Amount slots** are number inputs at 16 px (no iOS zoom). A slot counts as filled from its first typed character.
- **Date slots** are buttons. Tapping one opens the app's calendar sheet (`DatePickerSheet`), which has **Clear**. There's no native `<input type="date">`: on iOS it opens on today and commits today when dismissed, so a stray tap would record a payment.

### FR-5 Bulk actions (page only)
- **Cover rest** (amount-tracked entries): fills every empty slot with an even split of what's left. The last slot takes the rounding remainder, so the slots add up to `totalAmount` exactly.
- **Clear all**: empties every slot.

### FR-6 Settling
- When an edit fills the **last empty slot** (typing, the calendar, or Cover rest), the app asks **"Mark as settled?"** before saving.
- **Mark settled** saves; the entry moves to Settled (on the Home block, it drops off the list).
- **Cancel** restores the slot and saves nothing.
- Clearing the slot again before answering withdraws the question.

### FR-7 Saving
Slot edits save with a **600 ms debounce per entry**, via `PUT /split-payments/{splitPaymentId}` with `{ occurrences }`. A failed save shows a "Could not save the change." toast on both Today and Split. The edited values stay on screen either way; reload to see what's stored.

### FR-8 Create and edit
A **bottom sheet** at column width (rounded top, grabber, safe-area padding), the same form for both:

| Field | Type | Constraints |
|---|---|---|
| Title | Text | Required |
| Date | Date | Defaults to today |
| Total amount | Number | Required, > 0 |
| Currency | Select | `RON` (default), `EUR`, `USD` |
| Occurrences | Integer | 1–36 |
| Track by | Select | `amount` or `date` |

On edit, **Track by** is locked once any slot is filled, and changing the count keeps existing values by position.

### FR-9 Delete
Two-step inline confirm: **Delete** → **Tap to confirm**, reverting after 4 s. No dialog.

### FR-10 Today widget
- Shows the **three newest open entries** (by `createdDate`).
- Same slot rules as FR-4, FR-6 and FR-7. No Cover rest or Clear all.

---

## Data

`SplitPayments` table, PK `splitPaymentId`, scoped by `userId`.

| Attribute | Type | Notes |
|---|---|---|
| `splitPaymentId` | String | UUID |
| `userId` | String | Cognito `sub` |
| `title` | String | Required |
| `totalAmount` | Number | Required |
| `currency` | String | `RON` \| `EUR` \| `USD`; default `RON` |
| `occurrenceCount` | Number | 1–36 |
| `occurrenceType` | String | `amount` \| `date` |
| `createdDate` | String | `YYYY-MM-DD`; defaults to today |
| `occurrences` | List | `{ index, value }`; `value` is an amount, a date, or `""` |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/split-payments` | The user's entries, newest `createdDate` first |
| `POST` | `/split-payments` | Create. 400 without title, totalAmount, occurrenceCount and occurrenceType |
| `PUT` | `/split-payments/{splitPaymentId}` | Update fields or `occurrences` |
| `DELETE` | `/split-payments/{splitPaymentId}` | Delete |

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | Persisted in DynamoDB through `SplitPaymentsFunction`. |
| NFR-2 | Design tokens only — no raw colours, radii or shadows. |
| NFR-3 | 16 px inputs and ≥ 44 px tap targets. |
| NFR-4 | Slot edits debounced at 600 ms. |
| NFR-5 | No native date inputs for slots. |

---

## Acceptance Tests

Covered by `features/money/split/splitSlots.test.tsx` (29 — every slot rule runs on both Today and Split).

| # | Test | Expected Result |
|---|---|---|
| 10.1 | Open Money → Split | Header, In progress and Settled groups; empty state when there are no entries |
| 10.2 | **+ New**, create 3 amount slots | `POST` called; card appears in In progress with 3 slots, two per row, coverage `0/3` |
| 10.3 | Type in the first slot | Coverage `1/3`; one `PUT` after 600 ms |
| 10.4 | Tap a date slot | The calendar sheet opens; picking a day fills the slot; dismissing without picking changes nothing |
| 10.5 | Fill the last empty slot | "Mark as settled?" appears; nothing is saved yet |
| 10.6 | Confirm | Saved; the entry moves to Settled |
| 10.7 | Cancel instead | The slot reverts; nothing is saved |
| 10.8 | **Cover rest** | Every empty slot filled; the slots sum to the total exactly |
| 10.9 | Entry whose stored array is short | Still shows `occurrenceCount` slots; the next save writes the full count |
| 10.10 | Delete, then tap again within 4 s | `DELETE` called on the second tap only |
| 10.11 | Today | Lists the 3 newest open entries with the same slot behaviour |
