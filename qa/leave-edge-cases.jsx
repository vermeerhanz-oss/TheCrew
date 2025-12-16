# Manual QA Checklist: Leave Management Edge Cases

Version: 1.0
Last Updated: 2025-11-30

This checklist covers critical edge cases for the Leave Management system in EasyHR / FoundersCreW. These scenarios must be tested manually before onboarding new founder workspaces to ensure data integrity and correct behavior.

---

## 1. Cross-year leave (December → January)

**Goal**: Ensure leave spanning across years is calculated and reported correctly.

- **Scenario**:
  - Employee with standard AU Annual Leave accrual.
  - Book Annual Leave from e.g. 20 December YYYY to 5 January (YYYY+1).
- **Steps**:
  1. Confirm initial Annual Leave balance for the employee.
  2. Create the leave request spanning the year-end (e.g., Dec 20 - Jan 5).
  3. Approve the request.
  4. Check:
     - Employee leave balance decreases by the correct number of working days (excluding public holidays like Christmas, Boxing Day, New Year's Day).
     - `LeaveSummaryReport` shows the leave in the correct period(s).
     - No negative or duplicated accruals (e.g. not double-counted across years).
- **Expected Results**:
  - Balances match the number of chargeable days exactly.
  - Reports reflect the leave correctly split or aggregated depending on the view.
  - Dashboard tiles reflect the updated balance immediately.

---

## 2. Partial days and transitions (AM/PM → full day)

**Goal**: Verify partial day calculations and updates are robust.

### Scenario A: AM / PM on consecutive days
- **Steps**:
  1. Create one request for "Annual Leave – AM only" on Day 1.
  2. Create one request for "Annual Leave – PM only" on Day 1 (or Day 2 if same-day overlap is blocked).
  3. Approve both.
  4. Check that:
     - Total chargeable leave equals the sum (e.g. 0.5 + 0.5 = 1.0).
     - Balances and tiles reflect that correctly.
     - Leave calendars render correctly (showing half-day markers).

### Scenario B: Changing from partial to full day
- **Steps**:
  1. Create a partial-day request (AM only) for a specific date.
  2. Edit (or cancel + re-create) to make it a full-day request for the same date.
  3. Verify balances and reports:
     - Neither undercount nor double-count the same date.
     - Final deduction should be 1.0 day (not 1.5).

---

## 3. Change of employment terms mid-year (FTE/hours)

**Goal**: Verify accruals and calculations handle FTE changes.

- **Scenario**:
  - Employee starts as 0.6 FTE (or reduced hours per week, e.g., 22.8 hrs).
  - Partway through the year, update to 1.0 FTE (38 hrs).
  - Request Annual Leave before and after the change.
- **Steps**:
  1. Record initial balance and accrual settings.
  2. Request and approve leave for a date *before* the change.
  3. Change the employee’s FTE/hours in their profile.
  4. Request and approve leave for a date *after* the change.
- **Expected Results**:
  - Accrual logic behaves as intended (pro-rata accumulation).
  - Deduction logic uses the correct "hours per day" for the specific dates of leave.
  - Reports and balances match expectations.
  - No retroactive corruption from the FTE change.

---

## 4. Recall and cancel flows

**Goal**: Ensure state transitions are strict and clean up balances.

- **Scenario**:
  - Employee creates a pending leave request.
  - Employee cancels the request.
  - Employee creates a new request, gets it approved, then recalls it (if in the future).
- **Steps**:
  1. Create a pending request. Verify "Cancel" button is available.
  2. Cancel it. Verify status changes to 'cancelled' and balance is untouched/restored.
  3. Create a new request. Have manager approve it.
  4. As employee (or manager), recall/cancel the approved request.
  5. Confirm:
     - Buttons and actions (Cancel / Recall) appear only when allowed by permissions.
     - Balances and dashboard tiles update after each state change (deducted on approval, restored on recall).
     - Leave calendar reflects the cancelled / recalled state correctly.
- **Expected Results**:
  - No orphaned balances (hours deducted but never returned).
  - Status transitions strictly follow: `pending` → `cancelled` or `approved` → `cancelled`.
  - All transitions invalidate cache and refresh balances immediately.

---

## 5. Multiple employees and team calendar

**Goal**: Verify scope and visibility rules for managers.

- **Scenario**:
  - Two employees in the same entity, with the same manager.
  - Each has multiple leave requests across different types (Annual, Personal).
- **Steps**:
  1. As manager, view the Team calendar.
  2. Verify visibility: Only direct reports (and their reports) should show.
  3. Approve/reject some requests from the calendar or approval list.
  4. Use "leave on behalf of" (Manager creating leave for employee) if supported.
- **Expected Results**:
  - Only relevant employees show in the calendar.
  - Approvals update balances for the correct employee.
  - Manager cannot see or act on employees outside their scope.