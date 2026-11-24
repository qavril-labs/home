# Antigravity prompt: HRMS screens (HRM-01 to HRM-19)

**Lane:** frontend (Antigravity). **Backend and contracts:** Claude Code (see CLAUDE.md, "Layout"). **Design source:** [hrms-end-to-end-design.md](hrms-end-to-end-design.md). **Catalog:** [ERP-Product-Catalog.md](../ERP-Product-Catalog.md), HR and payroll section.

Paste the block below into Antigravity.

---

```
You are the frontend lane for the HRMS module of this ERP. Build the screens described in docs/hrms-antigravity-prompt.md. Read these first, in order:

1. AGENTS.md (your rules)
2. docs/build-plan.md
3. docs/ui-contract.md (components, layout, modals, words)
4. CLAUDE.md
5. docs/hrms-end-to-end-design.md (the process, states, rules and words behind every screen)
6. docs/ai-agent-readiness/BOT_BUILD_SPLIT.md (how screens hand over from backend parts)
7. ERP-Product-Catalog.md, HR and payroll section (IDs HRM-01 to HRM-19)

Work only in frontend/ (in your worktree, branch lane/frontend). Do not edit backend/ or contracts/. Where a screen needs an endpoint or field that is not in contracts/openapi.yaml, build against a mock shaped like the design doc, mark it clearly in code as MOCK, and open an issue for Claude Code. This prompt follows CLAUDE.md on ownership; AGENTS.md also permits edits to backend and contracts, but the backend lane is Claude Code's, so do not make those edits.

Hard rules (from AGENTS.md and the UI contract):
- Every figure comes from the API. Never compute money in the browser. Show the decimal strings the API returns, formatted as $1,234.50.
- Tokens only (frontend/design/). No raw hex, other fonts or shadows.
- Two fonts: Unbounded (titles and big numbers), Space Grotesk (everything else). Neo-brutal style, both themes.
- Use the components in the UI contract: AppHeader, KpiTile, Card, DataTable, QuickEntryForm, StatusChip, EmptyState, Gate, Modal, Drawer, Toast, ConfirmDialog. Build each once and reuse it.
- Responsive: 375px and 1280px, no horizontal page scroll, wide tables scroll inside their card.
- 3D is not needed for HRMS. Do not add it.
- No sample or invented numbers, names or dates in the app. Empty states say what is missing.
- Personal data: mask national ID, tax ID, bank account and date of birth in lists. A "Reveal" action asks for a reason and is audited on the server; show it as a confirmation with the reason field.

Screens to build (one route group per module, under the existing module pattern: header, title row with the main action on the right, KPI tiles, list card and detail card):

HRM-02 Org structure: org chart card (reports-to tree, no cycles shown), departments list, position list with status chip (open, filled, frozen, closed) and approved vs filled headcount.

HRM-16 Headcount and requisitions:
- Headcount plan table by department and period (planned, approved, filled).
- Requisition list with states draft, submitted, approved, open, on_hold, filled, closed, rejected, cancelled. Each shows its number from the API.
- "New requisition" Drawer: position, reason (new, backfill, replacement, conversion), target start date, priority, budgeted cost. Backfill shows the leaving employee's separation date if one exists.
- Requisition detail Drawer with its approval trail. Hide the approve action from the requester (show "Waiting for another approver").

HRM-09 Recruitment (minimal pipeline):
- Candidate pipeline board by stage: applied, screened, shortlisted, interviewing, selected, offer_stage, hired, rejected, withdrawn. Moving a card to rejected asks for a reason code from the API list (ConfirmDialog).
- Application Drawer: candidate details (sensitive fields masked), stage history, interviews.
- Scorecard form: structured competency ratings, submit once. Before a panel member submits, hide the other panel members' scores (the API returns them only after submit, so do not fetch them earlier).
- Duplicate candidate banner when the API flags one. Do not merge in the UI.

Offers (part of HRM-09):
- Offer Drawer: position, grade, pay structure lines (decimal strings), joining date, expiry date, status (draft, pending_approval, approved, sent, accepted, declined, expired, withdrawn).
- Band indicator: show "Within band" or "Outside band, needs HR and finance" from the API field, never from a calculation in the browser.
- Send and withdraw are ConfirmDialogs naming the candidate and the action.
- Expired offer: show the status and disable accept. Do not accept on the client.

HRM-01 Employees:
- Employee directory: code, name, department, status chip (pre_boarding, active, on_leave, suspended, notice, separated, no_show), branch. Filters by status and department.
- Employee profile Drawer with tabs: Employment (history as a timeline with effective dates), Documents (with expiry chips), Bank accounts (effective-dated; "Verify" is shown only to a user who is not the requester; the API decides, and the UI reads the flag).
- Employment history shows valid_from and valid_to exactly as the API returns them.

HRM-17 Lifecycle events:
- Event list per employee and company-wide queue: probation reviews due (14-day window), confirmations, transfers, promotions, status changes.
- "Record event" Modal: event type, effective date (YYYY-MM-DD), reason code, approvals shown as steps. Effective dates before a closed pay period show the API's warning text, not a client rule.

HRM-03 Attendance:
- Attendance day list for a date range with status chips (present, absent, half_day, on_leave, holiday, weekly_off, exception) and minutes right-aligned.
- Exceptions queue with "Regularise" Drawer (requested change, reason). Locked days show a lock icon and no edit action.

HRM-04 Leave:
- Leave balance card per employee: balance per type in days with half-day steps (the API returns half-day units; show 1.5 days, never a float rounding in the browser).
- Leave request Drawer: type, from, to, half-day flags, reason, attachment. Show the API's error text for insufficient balance or overlap.
- Approvals inbox entries for leave.

HRM-05 Payroll:
- Pay run list with state chips (draft, calculated, verified, approved, posted, paid, closed, cancelled).
- Pay run detail: totals per component, employee lines table (earnings, deductions, net, right-aligned), verification checks panel with each failed check named and the override action (needs a reason, ConfirmDialog).
- Approve, post and pay are ConfirmDialogs stating the run total and the period, for example "Approve $48,250.00 for March?". Labels read "Approve run", "Post to ledger", "Mark as paid". Never "OK".
- Payslip list per employee (posted runs only).

HRM-06 Statutory:
- Filing calendar with due dates, status (due, filed, late) and filing reference. Pack version in use is shown with its effective dates.

HRM-07 Self-service (employee view, same web app, separate route group):
- Payslips (posted only), leave balance and requests, attendance days, documents, profile change request, bank change request (sent for verification), expense claims link.
- Exit tasks card during notice.
- Employees never see other people's pay or records. Do not build any control that would show them.

HRM-10 Onboarding: checklist per joiner with owner, due date, status; overdue items flagged on the HR dashboard.

HRM-18 Separations and full and final:
- Exit case list by type and state (initiated, approved, notice, last_day, clearance, fnf_calculated, fnf_approved, fnf_paid, closed, cancelled).
- Exit Drawer: type, reason code, notice details with the computed notice shortfall or buy-out from the API, last working day, access removal date.
- Clearance checklist with items cleared, waived (waiver needs a reason) or pending. Show the completion count from the API.
- F&F statement: lines with label, amount (decimal string), source and calculation id, plus rule version. Net payable at the bottom. A BLOCKED banner names each missing input from the API and disables approve. A negative net shows "Receivable from employee".
- Approve and pay are ConfirmDialogs with the employee name masked to the initials, the net amount and the action.

HRM-19 Loans and advances:
- Loans list with state chips and outstanding balance.
- Loan detail: instalment schedule table (due period, principal, interest, status). Last instalment shows rounding absorbed.
- Request Drawer: type, principal, instalments, start month. Over-limit requests show the approver the API names.

HRM-14 Compliance expiries: card with work permits, licences and certificates due in 30, 60 and 90 days; expired items show "!" chip with the owner.

HR dashboard: KPI tiles from the API only: headcount, open requisitions, time to hire, offer acceptance, attrition, overdue probation reviews, leave awaiting approval, pay runs awaiting approval, F&F awaiting payment. Each tile links to its list.

Words and states:
- StatusChip uses the UI contract words (✓ All good, ! Worth a look, ● Needs you, … Waiting for data). Map each HRM state to one of these. BLOCKED and PARTIAL from the API always show as "! Worth a look" with the named missing inputs.
- Button labels name the action with a verb ("Send offer", "Approve run", "Record event"). Cancel is always "Cancel".

Accessibility and performance:
- Focus moves into the modal and back to the trigger. Escape closes except during a ConfirmDialog.
- Tables have labelled headers; status is never colour-only (icon and word).
- Lists paginate. No list loads every employee at once.

Testing:
- Playwright e2e in frontend/e2e/: one flow per module group. At least these journeys: requisition to approved; candidate to offer accepted (expired offer blocked); lifecycle event recorded; leave request rejected for insufficient balance; pay run approved by a different user from the preparer (the UI hides approve for the preparer); F&F blocked when a clearance item is pending; loan request over limit.
- Screenshots at 375 and 1280px, light and dark.

Before the pull request:
- npm --prefix frontend run build:web
- npm --prefix frontend run site:check
- npm --prefix frontend run test:e2e
- UI contract checklist
- Screenshots
- Branch and pull request name carry the IDs (for example: feat(HRM-16,HRM-17): requisition and lifecycle screens)

Report back with: the list of screens built, the mock endpoints you needed, the issues you opened for Claude Code, and any screen the contract could not describe.
```

---

## Notes for the owner

- Screens depend on endpoints that do not exist yet. Antigravity mocks them from the design doc until Claude Code publishes the HRM paths in `contracts/openapi.yaml`.
- The screen list follows the design doc. It assumes the open decisions in section 15 (country, ATS scope) are settled as the design proposes. If the ATS stays in P3, drop the HRM-09 and offer screens from this pass.
- Ownership conflict to fix: `AGENTS.md` says Antigravity may edit backend and contracts, but `CLAUDE.md` gives the backend lane and `contracts/` to Claude Code. The prompt follows CLAUDE.md. Decide which one stands and update the other.
