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
Columns: `Month | Region | RM Name | Base Town | Target`
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
| 15 | Status | Text (list) | Yes | Market Visit | One of: Market Visit, Meeting, Transit, Officework, Leave, Holiday (= weekly off) |
| 16 | Remarks | Text | No | Monthly Meeting | Free text |

- A row counts as a visit only when Status = "Market Visit".
- Rows with Status other than Market Visit usually have blank times and towns – that is valid.
- Ignore fully empty rows, a "Total" row, and any extra columns not listed above (e.g. VISITS, SOP Visit, Unique Visit).
- `Prod.` = productive time (time actually working in the market, not travelling).
- Re-uploading the same month replaces that month's visit data. Multiple months are kept (needed for 3-month views).

### 3.4 Upload validation
- Show a preview of rows before saving.
- Flag rows with: unknown RM name, unknown town/territory, missing date, end time before start time.
- RM names must match the RM master (current sheet has "Afzaal Cheema" vs "AFZAL CHEEMA" – matching must
  be case-insensitive and trimmed; show unmatched names so I can fix them).

## 4. Calculations (business rules – final)

### 4.1 Per row
- **Total Trip Time (hrs)** = Trip End − Trip Start
- **Total Productive Time (hrs)** = Prod. End Time − Prod. Start Time (time working in the market, not travelling)
- **Travel Time (hrs)** = Total Trip Time − Total Productive Time
- **Visited Town** = Tracker Presence (final for all "visited" logic)
- **Plan Deviation** = Market Visit row where Planned Town ≠ Tracker Presence (case-insensitive, trimmed)
- Town names are always DISPLAYED as written in the territory structure (match case-insensitive), not as typed in the log.

### 4.2 Day classification (one label per RM per date – a day is never counted twice)
Priority order when an RM has several rows on the same date:
1. If any row is **Market Visit** → it is a **Field Day**, classified by Daily Productive Time:
   - **Green** = Daily Productive Time ≥ 3 hrs → counts toward target
   - **Red** = ≥ 2 and < 3 hrs → counts toward target, flagged
   - **Invalid** = < 2 hrs → does NOT count toward target ("Incomplete visit < 2 hrs")
   - Other rows that day (Transit, Meeting, Officework) do NOT add to those day counts.
     Their trip time (if entered) is added to that day's **Travel Time**. Their remarks are shown.
2. Else **Leave** → Leave Day
3. Else **Holiday** → Holiday Day (weekly off day)
4. Else **Meeting** → Meeting Day
5. Else **Officework** → OW Day
6. Else **Transit** → Transit Day (whole day travelling, no market visit)
7. No row at all for a date (up to the last date in the uploaded log) → **Missing Day**

- **Daily Productive Time** = sum of productive time of all Market Visit rows that day
- **Daily Travel Time** = sum of travel time of all rows that day (incl. Transit rows with times)
- **Base Town Day** = Green/Red day where the ONLY town visited all day is the RM's Base Town
- **Other TTY Day** = Green/Red day that is not a Base Town Day
  (Base Town Days + Other TTY Days = Achieved)

### 4.3 Per RM per month
- **Target** = from RM master
- **Adjusted Target** = Target − Leave Days (holidays do NOT reduce target)
- **Achieved** = Green Days + Red Days
- **Achievement %** = Achieved ÷ Adjusted Target
- **Data Up To** = last date present in the uploaded visit log for that month
- **Expected by Now** = Adjusted Target × (day number of Data Up To ÷ days in month), rounded
  (at month end this equals Adjusted Target)
- **Pace** = Achieved − Expected by Now →  ≥ 0 "On track" (green), −1 to −2 "Slightly behind" (amber), ≤ −3 "Behind" (red)
- Counts: Green, Red, Invalid, Base Town, Other TTY, Leave, Holiday, Meeting, OW, Transit, Missing days
- **Total Visits** = number of Market Visit rows; **Unique Towns Visited** = distinct Tracker Presence towns
- **Plan Adherence %** = Market Visit rows where Planned = Tracker ÷ Market Visit rows
- **Total / average** trip, productive, travel time (average per Field Day)

### 4.4 Towns not visited (rolling 3 months)
- For the selected month M, look at visit data of M, M−1 and M−2 together (whatever of these months is uploaded).
- A town in the RM's region is **Not Visited** if it does not appear as Tracker Presence in ANY of those months.
- Show count ("x of y towns in region") and the list of town names grouped by territory.
- Show which months were included (e.g. "Based on Aug–Oct" or "Based on Oct only – upload more months for a fuller view").

## 5. Dashboard

### 5.0 General
- Filters: Month, Zone, Region, RM
- Dark theme (keep current look).
- Every card, table and chart has a **Copy image** button (top-right icon). It copies a clean PNG of just that block
  to the clipboard so it can be pasted straight into WhatsApp. Show a small "Copied ✓" message.
  If clipboard copy is not allowed by the browser, download the PNG instead.
- The copied image must include the block title, the month and "Data up to <date>", with nothing cut off
  (no scrollbars, full table height, no truncated names).
- No horizontal scroll: tables must fit; wrap text, never truncate RM names with "...".

### 5.1 KPI cards (keep current ones, add Holiday Days and Pace)

### 5.2 Charts (only these)
1. **Achieved vs Adjusted Target by RM** (existing) – Achieved bar coloured by Pace (green/amber/red);
   show a marker for Expected by Now.
2. **Plan Adherence % by RM** (existing)
3. **RM × Date grid** – one row per RM, one column per date of the month, each cell coloured by day type
   (Green, Red, Invalid, Leave, Holiday, Meeting, OW, Transit, Missing, future = empty). Legend underneath.
   Hover shows towns and productive hours.
4. **Base Town vs Other TTY by RM** – stacked horizontal bar
5. **Average productive hrs per visit day by RM** – bar with reference lines at 2 hrs and 3 hrs
6. **3-month Achievement % trend by RM** – line chart; only shown when 2+ months are uploaded
- Remove all other charts (daily trend, productive vs travel, day type mix, town coverage by region).

### 5.3 RM Ranking table
- Merge "RM Ranking" and "RM Summary" into ONE table, sortable.
- Columns: RM, Region, Adj. Target, Expected by Now, Achieved, Ach %, Pace, Green, Red, Invalid, Base Town,
  Other TTY, Leave, Holiday, Meeting, OW, Missing, Towns Not Visited (3M), Plan %.

### 5.4 RM Cards (one per RM, in a grid – like the current WhatsApp report)
Header bar with RM name, Region and Month, coloured green if Ach % ≥ 100%, amber 70–99%, red < 70%.
KPI block (2 columns: label | value):
Target · Adjusted Target · Expected by Now · Achieved · Ach % · Pace · Base Town Visits · Other TTY Visits ·
Incomplete Visits < 2 hrs · Leaves · Holidays · OW · Meetings · Transit · Missing Days · Towns Not Visited (3M)
Below the KPI block: compact day list – Date | Towns | Productive hrs (Green/Red/Invalid days only).
Each card has its own Copy image button.

### 5.5 Day Detail table (per selected RM – keep current table, add columns)
Columns: Date, Day, Status (day label from 4.2), Towns, Trip Start, Trip End, Total Trip hrs, Prod Start, Prod End,
Productive hrs, Travel hrs, Day Type, Base Town (Yes/No), Plan Deviation (planned town if different), Remarks.
- Show EVERY date of the month up to Data Up To, including Missing days as "No entry" rows.
- Multi-town days: one row per day; towns comma-separated; times = first start / last end; hours = sums.
- Totals row at the bottom.

### 5.6 Month Comparison table (separate block)
- Rows = RMs, grouped by metric OR per-RM mini table – columns = last 3 uploaded months (e.g. Aug | Sep | Oct).
- Metrics: Target, Achieved, Ach %, Base Town, Other TTY, Incomplete < 2 hrs, Leaves, Holidays, OW, Meetings,
  Towns Not Visited.
- Change vs previous month shown with ▲ / ▼ in green/red.

### 5.7 Alerts panel
- Missing days (only up to Data Up To, never up to today)
- Invalid days (RM, date, towns, productive hrs)
- Base town in RM master not found in territory structure

## 6. Reports (each exportable to Excel; PDF later)
1. RM Monthly Summary (same as Ranking table)
2. RM Day-wise Detail (same as Day Detail, all RMs)
3. Towns Not Visited (3M) by RM / territory
4. Leave, Holiday & Meeting report – dates and remarks per RM
5. Plan Deviation report – every visit where planned town ≠ tracker town

## 7. Tech (for Cursor)
- Plain HTML + CSS + JavaScript only. No Node.js server, no database, no build step.
- The app must run by double-clicking `index.html` (no install needed).
- Libraries saved locally in a `libs/` folder (not loaded from the internet), so it works offline:
  - SheetJS (xlsx) to read and write Excel
  - Chart.js for charts
  - html2canvas for the Copy image buttons
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