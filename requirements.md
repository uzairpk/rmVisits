# rmVisits – RM Visit Tracking & Performance Dashboard

## 1. Purpose
Replace the manual Excel sheet (RMs_Sheet) used to track Regional Managers' (RM) monthly field visits.
Admin uploads master data and monthly visit logs as Excel files; the system calculates KPIs automatically
and shows them in a sleek, professional dashboard with downloadable reports.

## 2. Users
- **Admin** (me): uploads all files, views dashboard and reports.
- **Viewer** (management, later phase): read-only dashboard access.
- Single company, desktop browser (Chrome/Edge). No login in this version.

## 3. Data uploads (all Excel .xlsx)

### 3.1 Territory structure (upload once, update when it changes)
Columns: `Zone | Region | Territory | Town`
- Hierarchy: Zone → Region → Territory → Town
- Re-uploading replaces the old structure (show a preview + confirm before saving).

### 3.2 RM master (upload monthly)
Columns: `Month | Region | RM Name | Base Town | Target Visits`
- One RM per region.
- Example: `10 | CEN | Afzal Cheema | FSD-1 | 18`

### 3.3 Visit log (upload monthly, may be re-uploaded during the month)
Columns (same as current "Raw Data" sheet):
`Region | Manager Name | Date | Territory | Planned Town | Tracker Presence | Trip Start Time | Trip End Time | Prod. Start Time | Prod. End Time | Status | Remarks`
- A row counts as a visit only when Status = "Market Visit". There is no separate VISITS column.
- If a column named VISITS exists in an uploaded file, ignore it.
- `Tracker Presence` = town where the RM actually was (from tracker).
- `Status` values: Market Visit, Meeting, Transit, Officework, Leave.
- Re-uploading the same month replaces that month's visit data.

### 3.4 Upload validation
- Show a preview of rows before saving.
- Flag rows with: unknown RM name, unknown town/territory, missing date, end time before start time.
- RM names must match the RM master (current sheet has "Afzaal Cheema" vs "AFZAL CHEEMA" – matching must
  be case-insensitive and trimmed; show unmatched names so I can fix them).

## 4. Calculations (business rules – from the current Excel formulas)
Per visit row:
- **Total Trip Time (hrs)** = Trip End − Trip Start
- **Total Prod Time (hrs)** = Prod End − Prod Start
- **Travel Time (hrs)** = Total Trip Time − Total Prod Time
- **Visit** = row where Status = Market Visit
- **Base Town Visit** = Visit where Tracker Presence = RM's Base Town
- **SOP Visit** = Visit with Prod Time ≥ 2 hrs
- **Red Visit** = SOP Visit with Prod Time < 3 hrs  *(confirm rule)*
- **Visit Day** = unique (Date + RM) combination with at least one visit

Per RM per month:
- **Target** = from RM master
- **Achieved** = count of Visit Days *(confirm: visit days or total visits?)*
- **Achievement %** = Achieved ÷ Target
- **Leaves** = count of days with Status = Leave
- **Meetings** = count of days with Status = Meeting
- **Officework days**, **Transit days**
- **Base Town Visits**, **SOP Visits**, **Red Visits**
- **Total / avg trip time, prod time, travel time**
- **Territories not visited** = territories in the RM's region with zero visits this month
- **Towns not visited** = towns in the RM's region with zero visits (based on Tracker Presence)
- **Visits per territory / per town**

## 5. Dashboard (main screen)
- Filters: Month, Zone, Region, RM
- KPI cards: Target vs Achieved (%), Total Visits, SOP Visits, Red Visits, Base Town Visits, Leaves, Meetings,
  Territories not visited, Towns not visited
- Charts:
  - Target vs Achieved by RM (bar)
  - Daily visit trend for the month (line)
  - Time split: Prod vs Travel time by RM (stacked bar)
  - Day status mix: Market Visit / Meeting / Leave / Officework / Transit (by RM)
  - Coverage: % of towns visited per region
- RM ranking table (sortable) with conditional colours (green ≥ 100%, amber 70–99%, red < 70%)
- Style: dark, clean, professional (similar to a modern Power BI dark theme)

## 6. Reports (each exportable to Excel and PDF)
1. **RM Monthly Summary** – one row per RM with all KPIs from section 4
2. **RM Day-wise Detail** – calendar-style view per RM: date, status, towns, trip/prod/travel time
3. **Not Visited Report** – territories and towns not visited, by region/RM
4. **Town Coverage Report** – visits per town and territory
5. **Leave & Meeting Report** – dates and remarks per RM

## 7. Tech (for Cursor)
- Plain HTML + CSS + JavaScript only. No Node.js server, no database, no build step.
- The app must run by double-clicking `index.html` (no install needed).
- Libraries saved locally in a `libs/` folder (not loaded from the internet), so it works offline:
  - SheetJS (xlsx) to read and write Excel
  - Chart.js for charts
  - jsPDF + jspdf-autotable for PDF export
- All Excel processing happens in the browser. Data never leaves the user's computer.
- Uploaded data is saved in the browser (IndexedDB) so it is still there after closing the browser.
- "Clear all data" button in settings.
- Keep code simple and readable, split into a few files: `index.html`, `css/style.css`, `js/upload.js`,
  `js/calculations.js`, `js/dashboard.js`, `js/reports.js`.
- Single-page app with a left sidebar: Dashboard, Uploads, Master Data, Reports.

### Sharing
- Option A: zip the folder and send it. Colleague unzips and opens `index.html`.
- Option B: host the folder on a free static host (Netlify / GitHub Pages) and share the link.
- Limitation: each person's data lives in their own browser. A colleague sees data only after
  uploading the files themselves. (Shared central data = later phase with a server.)

## 8. Build phases
1. Layout + sidebar + upload of Territory structure and RM master, shown in tables, saved in browser
2. Visit log upload + validation + calculations (section 4)
3. Dashboard (section 5)
4. Reports + Excel/PDF export (section 6)
5. Later (optional): shared online version with login and central database

## 9. Open questions
- Target achieved = number of visit days, or number of visits (a day can have 2 towns)?
- Red Visit rule: is it "SOP visit with prod time < 3 hrs", or something else?
- Do leaves/meetings reduce the RM's target (e.g. target 18, 2 leaves → 16)?
- Should "not visited" use Tracker Presence town or Planned Town?