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
One row per RM per town visited per day (or one row per day for Leave / Meeting / Officework / Transit).
The header row may not be row 1 – detect the row that contains these headers. Match headers ignoring case and extra spaces
(e.g. "Remarks " with a trailing space).

| # | Column | Data type | Required | Example | Notes |
|---|--------|-----------|----------|---------|-------|
| 1 | Region | Text | Yes | CEN | Must exist in territory structure |
| 2 | Manager Name | Text | Yes | AFZAL CHEEMA | RM name; must match RM master (fuzzy, case-insensitive) |
| 3 | Date | Date | Yes | 01-Oct-2026 | Excel date; month of upload is taken from this |
| 4 | Day | Text | No | Thu | Ignored – app derives it from Date |
| 5 | Territory | Text | For Market Visit | GOR | Territory code |
| 6 | Planned Town | Text | For Market Visit | Samundari | Town the RM planned to visit |
| 7 | Tracker Presence | Text | For Market Visit | Dijkot | Town where tracker shows RM actually was – FINAL for visits |
| 8 | Trip Start Time | Time (hh:mm) | For Market Visit | 12:13 | Excel time value |
| 9 | Trip End Time | Time (hh:mm) | For Market Visit | 17:09 | Must be after Trip Start |
| 10 | Total Trip Time | Number (hrs) | No | 4.93 | Ignored – app recalculates |
| 11 | Prod. Start Time | Time (hh:mm) | For Market Visit | 12:41 | Start of productive time in market |
| 12 | Prod. End Time | Time (hh:mm) | For Market Visit | 13:55 | Must be after Prod. Start |
| 13 | Total Prod Time | Number (hrs) | No | 1.23 | Ignored – app recalculates |
| 14 | Travel Time | Number (hrs) | No | 3.70 | Ignored – app recalculates |
| 15 | Status | Text (list) | Yes | Market Visit | One of: Market Visit, Meeting, Transit, Officework, Leave |
| 16 | Remarks | Text | No | Monthly Meeting | Free text |

- A row counts as a visit only when Status = "Market Visit".
- Rows with Status other than Market Visit usually have blank times and towns – that is valid.
- Ignore fully empty rows, a "Total" row, and any extra columns not listed above (e.g. VISITS, SOP Visit, Unique Visit).
- `Prod.` = productive time (time actually working in the market, not travelling).
- Re-uploading the same month replaces that month's visit data.

### 3.4 Upload validation
- Show a preview of rows before saving.
- Flag rows with: unknown RM name, unknown town/territory, missing date, end time before start time.
- RM names must match the RM master (current sheet has "Afzaal Cheema" vs "AFZAL CHEEMA" – matching must
  be case-insensitive and trimmed; show unmatched names so I can fix them).

## 4. Calculations (business rules – confirmed)

### 4.1 Per visit row
- **Visit** = row where Status = Market Visit
- **Total Trip Time (hrs)** = Trip End − Trip Start
- **Total Productive Time (hrs)** = Prod. End Time − Prod. Start Time
  (productive = time actually spent working in the market, not travelling)
- **Travel Time (hrs)** = Total Trip Time − Total Productive Time
- **Visited Town** = Tracker Presence (this is final for all "visited" logic)
- **Plan Deviation** = Visit where Planned Town ≠ Tracker Presence (compare case-insensitive, trimmed)

### 4.2 Per RM per day (a "Field Day")
- **Field Day** = a date where the RM has at least one Visit (Market Visit row)
- **Towns visited that day** = list of distinct Tracker Presence towns on that day
- **Daily Productive Time** = sum of Total Productive Time of all visits that day
- **Valid Visit Day (SOP Day)** = Field Day with Daily Productive Time ≥ 2 hrs. ONLY these days count toward target.
- **Red Day** = Valid Visit Day with Daily Productive Time ≥ 2 and < 3 hrs (counts toward target, but flagged red)
- **Green Day** = Valid Visit Day with Daily Productive Time ≥ 3 hrs
- **Invalid Day** = Field Day with Daily Productive Time < 2 hrs. Does NOT count toward target; shown separately.
- **Base Town Day** = Valid Visit Day where the ONLY town visited all day is the RM's Base Town.
  If the RM visited the base town plus any other town that day, it is NOT a Base Town Day.
- **Leave Day** = date with Status = Leave
- **Meeting Day** = date with Status = Meeting
- **Officework Day** = date with Status = Officework
- **Transit Day** = date with Status = Transit

### 4.3 Per RM per month
- **Target** = Target Visits from RM master
- **Adjusted Target** = Target − Leave Days  (only leaves reduce target; meetings do not)
- **Achieved** = number of Valid Visit Days (productive time ≥ 2 hrs that day)
- **Achievement %** = Achieved ÷ Adjusted Target
- **Total Visits** = number of visit rows (town visits)
- **Unique Towns Visited** = distinct Tracker Presence towns
- **Field Days**, **Valid Visit Days**, **Green Days**, **Red Days**, **Invalid Days**, **Base Town Days**
- Base Town Days are included in Achieved; they are also shown separately
- **Leave Days**, **Meeting Days**, **Officework Days**, **Transit Days**
- **Plan Adherence %** = visits where Planned Town = Tracker Presence ÷ Total Visits
- **Plan Deviation %** = 100% − Plan Adherence %
- **Total and average** trip time, productive time, travel time (average per Field Day)
- **Territories not visited** = territories in the RM's region with zero visits this month
  (a territory is visited if any of its towns appears in Tracker Presence)
- **Towns not visited** = towns in the RM's region with no visit (by Tracker Presence)
- **Coverage %** = towns visited ÷ total towns in RM's region
- **Visits per territory / per town**

## 5. Dashboard (main screen)
- Filters: Month, Zone, Region, RM
- KPI cards: Adjusted Target vs Achieved (%), Valid Visit Days, Total Visits, Green Days, Red Days, Invalid Days, Base Town Days, Leaves, Meetings, Plan Adherence %,
  Territories not visited, Towns not visited
- Charts:
  - Target vs Achieved by RM (bar)
  - Daily visit trend for the month (line)
  - Time split: Productive vs Travel time by RM (stacked bar)
  - Day status mix: Market Visit / Meeting / Leave / Officework / Transit (by RM)
  - Coverage: % of towns visited per region
  - Plan vs Actual: Plan Adherence % by RM, plus a table of deviations (date, planned town, actual town)
- RM ranking table (sortable) with conditional colours (green ≥ 100%, amber 70–99%, red < 70%)
- Style: dark, clean, professional (similar to a modern Power BI dark theme)

## 6. Reports (each exportable to Excel and PDF)
1. **RM Monthly Summary** – one row per RM with all KPIs from section 4
2. **RM Day-wise Detail** – calendar-style view per RM: date, status, towns, trip/productive/travel time
3. **Not Visited Report** – territories and towns not visited, by region/RM
4. **Town Coverage Report** – visits per town and territory
5. **Leave & Meeting Report** – dates and remarks per RM
6. **Plan Deviation Report** – every visit where planned town ≠ tracker town

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