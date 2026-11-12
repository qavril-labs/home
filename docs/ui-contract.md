# UI contract

Every screen in QAVRIL LABS, whether Claude Code or Antigravity builds it, follows this contract. A screen that breaks it is sent back, however good it looks. The working reference is the dashboard at `site/app.html` and its styles in `site/styles.css`.

## 1. Tokens only

- Colours, fonts, borders, shadows and spacing come from [design/tokens.css](../design/tokens.css) (CSS) or [design/tailwind.preset.cjs](../design/tailwind.preset.cjs) (Tailwind). [design/tokens.json](../design/tokens.json) is the source.
- No raw hex codes, no other fonts, no other shadows in component code. A new colour needs a token first, in the same pull request.
- Two fonts: **Unbounded** (800, uppercase) for page titles and big numbers, **Space Grotesk** for everything else.

## 2. Look

Neo-brutal and bright: flat panels, a 3px black outline, a hard offset shadow (8px for cards, 4px for small tiles), square card corners, 14px rounded buttons. Accents are lime, pink, violet, cyan and yellow. Hover lifts an element up and left with a bigger shadow. Both light and dark themes are required.

## 3. Layout

| Rule | Value |
|---|---|
| Page width | max 1240px, centred, 16px side gutter |
| Grid | 12 columns, 16px gap, cards packed with no empty space |
| App header | Sticky, 3px bottom border: logo left; workspace name, theme toggle, sign out right |
| Page order | Greeting and title, then 4 KPI tiles, then the main grid of cards |
| Card | Panel colour, 3px outline, 4px shadow, 16px padding, `h2` title at 1.15rem |
| Breakpoints | Below 960px every card spans 12 columns; below 520px KPI tiles and forms go to one column |
| No horizontal scroll | At any width down to 320px. Wide tables scroll inside their card |

Module pages (Sales, Purchasing, Inventory and so on) use the same frame: header, title row with the main action button on the right, KPI tiles for that module, then a list card and a detail card.

## 4. Components

Build each once and reuse it. Names are the same in every codebase.

| Component | Use |
|---|---|
| `AppHeader` | The sticky header above |
| `KpiTile` | Label (small caps) + big number; counts up on change; lime, yellow or panel background |
| `Card` | Every content block |
| `DataTable` | Lists; amounts right-aligned; sticky header; empty state inside the card |
| `QuickEntryForm` | Tabs for entry type, 2-column fields, one primary button, status line below |
| `StatusChip` | Status with icon and word: ✓ All good, ! Worth a look, ● Needs you, … Waiting for data |
| `BotCard` | Bot avatar in its colour, name, role, StatusChip, "found" line, "next" line, optional draft and action button |
| `TrendChart` | Grouped columns, violet for money in and orange for money out, hover tooltip, "Show as a table" toggle |
| `EmptyState` | What this is, why it is empty, the one action that fills it |
| `Gate` | Full-page message for signed-out or not-set-up states, with one primary action |
| `Modal` | Short tasks and confirmations (section 4a) |
| `Drawer` | Longer forms and record details that slide in from the right (section 4a) |
| `Toast` | Brief confirmation after an action, bottom right, 4 seconds |
| `ConfirmDialog` | A `Modal` for irreversible or money-moving actions |
| `Scene3D` | A 3D visual with its 2D twin (section 6a) |
| `CommandBar` | Ctrl+K search and actions; later the chat entry point for AI-09 |

## 4a. Modals, drawers and toasts

- **Modal** for one short task or a decision: up to 5 fields. Centred panel, max 560px wide, 3px outline, 8px shadow, title in Unbounded, a dimmed and blurred backdrop. Buttons bottom right: primary action named with a verb ("Post entry"), secondary "Cancel".
- **Drawer** for longer forms and record details: slides in from the right, 480px wide on desktop and full screen on phones, with the same header and button row.
- **ConfirmDialog** before anything irreversible or that moves money: says what will happen and to what ("Post $1,250.00 to Sales?"), and labels buttons with the action, never "OK".
- **Toast** after success: one line, bottom right, 4 seconds, with an Undo link when a reversal is possible.
- **Behaviour**: focus moves into the modal and returns to the trigger on close; Escape and the backdrop close it, except a ConfirmDialog in progress; the page behind does not scroll; open and close take 180ms (none with reduced motion).

## 5. Data display

- Money arrives from the API as decimal strings. Show it as `$1,234.50`, with a minus sign for negatives. Never do arithmetic on money in the browser; the API returns totals.
- Dates show as the API sends them (`2026-11-10`) in tables, and as `Nov` style month names on charts.
- Every number on a screen comes from the API. No sample or invented figures in the app.

## 6. Charts

Follow the dataviz rules already applied: one axis only, violet `series-in` and orange `series-out`, 4px rounded bar ends on a square baseline, recessive grid lines, a legend when there are two or more series, a hover tooltip, and a table view. Any new series colour must pass the palette validator first.

## 6a. 3D visualizations

3D shows real data in a way a flat chart cannot. Decoration alone is not a reason.

| Scene | Where | What it shows |
|---|---|---|
| **Money city** (built) | Dashboard header | Monthly sales and expense columns, a coin stack for cash |
| **Ledger core** (built) | Marketing home hero | Modules orbiting one ledger, data pulses flowing in |
| **Stock warehouse** | Inventory | Shelves per location, height by quantity, red glow below reorder point |
| **Pipeline funnel** | Sales | Deal stages as rings, width by value |
| **Cash river** | Forecast Finn page | Cash 30, 60 and 90 days ahead as a flowing ribbon, width by amount |
| **Fleet map** | Logistics pack | Vehicles on a tilted map, routes as arcs |

Rules for every scene:

- **Library**: three.js 0.160.0, loaded on demand (`import()`), only after the page is usable.
- **Data**: only from the API, the same figures as the 2D view. The 2D chart or table stays on the page for everyone.
- **Who sees it**: desktops with a fine pointer that allow motion and have WebGL. Phones, reduced motion and no WebGL get the 2D view only.
- **Colours**: token colours only; money in violet, money out orange, cash lime, bots in their own colour.
- **Interaction**: drag to rotate, gentle idle sway, hover tooltip with the exact figure, a one-line hint ("Drag to spin").
- **Performance**: under 50,000 triangles, pixel ratio capped at 1.5, rendering stops when off screen or the tab is hidden, first frame within 1 second of loading.
- **Change**: when data changes, shapes ease to new sizes over 600ms so the change is visible.

## 7. Bots on screen

Each bot keeps its colour from `tokens.json` everywhere. A bot never shows an action as done until the API says so. Drafts are labelled as drafts, with an Approve or Copy button. The crew panel shows "Live · updated hh:mm:ss".

## 8. Words

Plain, short and warm, in the voice of the site: "Record sale", "Customers owe you $650.00", "Nothing posted yet. Record your first sale and watch the dashboard light up." Buttons start with a verb. Errors say what happened and how to fix it. No jargon such as "tenant", "entity" or "journal" on customer screens; say "workspace", "business" and "entry".

## 9. Accessibility

Contrast at least 4.5:1 for text. Everything reachable by keyboard, with a visible focus ring. Status is never shown by colour alone. Respect reduced motion: no count-up, tilt or 3D. 3D scenes are extra; the same data is always on the page in 2D.

## 10. Review checklist

Before a screen merges: tokens only; light and dark checked; 375px, 768px and 1280px widths checked with no horizontal scroll; keyboard path works; empty, loading and error states exist; every figure comes from the API.
