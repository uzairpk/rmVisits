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
- One RM per region, one row per RM per month.
- **Base Town** may hold ONE or MORE towns, separated by commas, e.g. `FSD-3, FSD-4`.
  The app splits on commas and trims spaces. Each base town must exist in the territory structure (flag if not).
- Example: `10 | CEN | MR AFZAL CHEEMA | FSD-3, FSD-4 | 18`

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
| 17 | KMs | Number | No | 145 | TOTAL KMs for the whole DAY, entered on ONE row of that day only (others blank – do not repeat, or it is counted twice). Old files without this column still upload |

- A row counts as a visit only when Status = "Market Visit".
- Rows with Status other than Market Visit usually have blank times and towns – that is valid.
- Ignore fully empty rows, a "Total" row, and any extra columns not listed above (e.g. VISITS, SOP Visit, Unique Visit).
- `Prod.` = productive time (time actually working in the market, not travelling).
- Re-uploading the same month replaces that month's visit data. Multiple months are kept (needed for 3- and 6-month views).

### 3.4 Upload validation
- Show a preview of rows before saving.
- Flag rows with: unknown RM name, unknown town/territory, missing date, end time before start time.
- Warn (not block) when Prod. Start/End falls outside Trip Start/End on the same row – shows inconsistent time entry.
- RM names must match the RM master (current sheet has "Afzaal Cheema" vs "AFZAL CHEEMA" – matching must
  be case-insensitive and trimmed; show unmatched names so I can fix them).

## 4. Calculations (business rules – as per management SOP, Sep 2026)

### 4.0 SOP benchmarks (fixed constants – keep in one place in js/calculations.js so they are easy to change)
- Working days per month: **26**
- Market visit days: **18** (default target; actual target comes from RM master)
- Meetings: **3** · Planning / Office Work: **4** · Leaves: **1**
- Minimum productive hours **per town**: **2**
- Minimum productive hours **per day**: **5**
- Maximum **base-only days** counted toward target: **4**
- All territories of the region must be visited **once a month**
- All towns of the region must be visited **once in 6 months**

### 4.1 Per row
- **Total Trip Time (hrs)** = Trip End − Trip Start
- **Total Productive Time (hrs)** = Prod. End Time − Prod. Start Time (time working in the market, not travelling)
- **Visited Town** = Tracker Presence (final for all "visited" logic)
- **Plan Deviation** = Market Visit row where Planned Town ≠ Tracker Presence (case-insensitive, trimmed)
- Town names are always DISPLAYED as written in the territory structure (match case-insensitive), not as typed in the log.

### 4.2 Per RM per day
**Town level (Market Visit rows only):**
- **Town Productive Hrs** = sum of productive time of all rows for that town that day
  (same town on 2 rows is added together, e.g. 1.0 + 1.5 = 2.5 hrs)
- **Counted Town** = town with Town Productive Hrs ≥ 2. Towns under 2 hrs are shown but are NOT a market visit,
  and do NOT count as "visited" anywhere (coverage, territories, repeated towns, base town).

**Day level:**
- **Daily Productive Time** = sum of Town Productive Hrs of ALL towns that day (including towns under 2 hrs)
- **Valid Day** = Daily Productive Time ≥ 5 hrs AND at least one Counted Town
- **Invalid Day** = a Market Visit day that is not valid. Reason shown:
  "Under 5 hrs" and/or "No town ≥ 2 hrs"
- Examples:
  | Towns (hrs) | Daily total | Counted towns | Result |
  |---|---|---|---|
  | 2, 2, 1 | 5 | 2 | Valid |
  | 2, 3, 1 | 6 | 2 | Valid |
  | 2, 1, 1 | 4 | 1 | Invalid (under 5) |
  | 1.5, 1.5, 1.5, 1.5 | 6 | 0 | Invalid (no town ≥ 2) |
- No more Green / Red. Only **Valid** / **Invalid**.

**Base town:**
- **Base Town Visit** = a Valid Day where at least one Counted Town is one of the RM's base towns (info count)
- **Base-only Day** = a Valid Day where ALL Counted Towns are base towns
- **Other TTY Day** = a Valid Day with at least one Counted Town that is NOT a base town
  (counts toward target regardless of the base-town cap)

**Day label (one label per RM per date – never counted twice). Priority:**
1. Any Market Visit row → **Valid** or **Invalid** (as above). Other rows that day (Transit, Meeting, Officework)
   do not add to day counts; their trip time is included in the day's time span; their remarks are shown.
2. Else **Leave** → Leave Day
3. Else **Holiday** → Holiday Day (weekly off)
4. Else **Meeting** → Meeting Day
5. Else **Officework** → Office Work Day
6. Else **Transit** → Transit Day (whole day travelling)
7. No row at all for a date (up to Data Up To) → **Missing Day**

**Time and distance:**
- **Daily Total Hrs** = from the EARLIEST to the LATEST time that day across all Trip Start/End and Prod. Start/End
  times of all rows (Market Visit and Transit)
- **Daily Travel Time** = Daily Total Hrs − Daily Productive Time (never negative; if negative show 0 and flag)
- **Daily KMs** = sum of KMs of all rows that day; blank = no data (not zero)
- **# Towns (day)** = number of Counted Towns that day

### 4.3 Per RM per month
- **Target** = from RM master
- **Adjusted Target**:
  - Leaves ≤ 1 → Adjusted Target = Target (1 leave is already in the SOP plan)
  - Leaves > 1 → Adjusted Target = ROUND( Target × (26 − (Leaves − 1)) ÷ 26 )
  - Examples (Target 18): 2 leaves → 17 · 3 → 17 · 5 → 15 · 10 → 12
  - Holidays do NOT reduce target.
- **Base-only Days Counted** = MIN(Base-only Days, 4); **Base-only Days Not Counted** = the excess over 4
- **Achieved** = Other TTY Days + Base-only Days Counted
- **Achievement %** = Achieved ÷ Adjusted Target
- **Data Up To** = last date present in the uploaded visit log for that month
- **Expected by Now** = Adjusted Target × (day number of Data Up To ÷ days in month), rounded (calendar days)
- **Pace** = Achieved − Expected by Now → ≥ 0 "On track" (green), −1 to −2 "Slightly behind" (amber), ≤ −3 "Behind" (red)
- **Day counts**: Valid, Invalid, Base Town Visits, Base-only Days (counted / not counted), Other TTY Days,
  Leave, Holiday, Meeting, Office Work, Transit, Missing
- **SOP comparison** (shown as "actual / SOP", red when over): Meetings x / 3, Office Work x / 4, Leaves x / 1
- **Avg Productive Hrs / valid day**
- **Total Visits** = number of Counted Towns across all days (town visits); **Unique Towns Visited** = distinct Counted Towns
- **Plan Adherence %** = Market Visit rows where Planned = Tracker ÷ Market Visit rows
- **Total KMs**, **Avg KMs / visit day** (= KMs on Valid/Invalid days ÷ those days that have KMs data); "—" if no data

### 4.4 Coverage (Counted Towns only)
- **Territories Not Visited (month)** = territories in the RM's region with no Counted Town in the selected month.
  Show "x of y" and the territory names.
- **Towns Not Visited (6M)** = towns in the RM's region that are not a Counted Town in ANY of the last 6 months
  (selected month M and M−1 … M−5, whatever is uploaded). Show "x of y" and the list grouped by territory,
  plus which months were included (e.g. "Based on May–Oct" or "Based on Oct only").
- **Towns Repeated from Last Month** = Counted Towns this month that were also Counted Towns last month.
  Show "x of y towns" (y = distinct Counted Towns this month). "—" if last month not uploaded.

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
- Date format everywhere: "12-Oct Mon". Hours: 2 decimals. KMs: no decimals, thousands separator. Numbers right-aligned.
- Status label "Officework" is displayed as "Office Work" (never "OW").
- Copy image: captures only that block, tight crop with 12px padding, 2x resolution, no empty space.

### 5.1 KPI cards (keep current ones; replace Green/Red with Valid days; add Base-only not counted, Territories Not Visited)

### 5.2 Charts (only these)
1. **Achieved vs Adjusted Target by RM** (existing) – Achieved bar coloured by Pace (green/amber/red);
   show a marker for Expected by Now.
2. **Plan Adherence % by RM** (existing)
3. **RM × Date grid** – one row per RM, one column per date of the month, each cell coloured by day type
   (Valid, Invalid, Leave, Holiday, Meeting, Office Work, Transit, Missing, future = empty). Legend underneath.
   Hover shows towns and productive hours.
4. **Base-only (counted / not counted) vs Other TTY days by RM** – stacked horizontal bar, with a line at 4
5. **Average productive hrs per valid day by RM** – bar with a reference line at 5 hrs
6. **3-month Achievement % trend by RM** – line chart; only shown when 2+ months are uploaded
- Remove all other charts (daily trend, productive vs travel, day type mix, town coverage by region).

### 5.3 RM Ranking table
- ONE table, sortable.
- Columns: RM, Region, Adj. Target, Expected by Now, Achieved, Ach %, Pace, Valid, Invalid, Base-only (counted/over),
  Other TTY, Leave, Holiday, Meeting, Office Work, Missing, Territories Not Visited, Towns Not Visited (6M),
  Towns Repeated, Plan %, Avg Prod Hrs, Total KMs, Avg KMs / day.

### 5.4 RM Cards (one per RM, in a grid – WhatsApp-ready)
- Fixed width 560px (never stretched); 2–3 cards per row on a big screen.
- Coloured header only: RM name, Region · Month, Base town(s), "Data up to <date>".
  Header colour follows Pace (green On track, amber Slightly behind, red Behind).
  At month end (Data Up To = last day of month) colour by Ach %: green ≥ 100%, amber 70–99%, red < 70%.
- KPI block in 2 columns (label | value), equal number of rows on each side:
  - Left: Target, Adjusted Target, Expected by Now, **Achieved**, **Ach %**, **Pace**, Other TTY Days,
    Base-only Days (e.g. "5 · 4 counted"), Base Town Visits, Avg Prod Hrs / day, Total KMs
  - Right: Invalid Days, Leaves (x / 1), Holidays, Office Work (x / 4), Meetings (x / 3), Transit, Missing Days,
    Territories Not Visited (x / y), Towns Not Visited 6M (x / y), Towns Repeated (x / y), Avg KMs / visit day
  - "actual / SOP" values turn red when actual is over SOP.
  - Achieved, Ach % and Pace bold and slightly larger.
- Day table (Market Visit days only – Valid / Invalid):
  Date | Towns | # | KMs | Prod | Travel | Total   (short headers on ONE line; no note under the table)
  - Towns: show each town with its hours, e.g. "FSD-3 (2.5), Chiniot (3.0), Dijkot (1.0)".
    Towns under 2 hrs shown greyed out. Base towns marked with a small "B".
  - # = Counted Towns that day.
  - Prod coloured green if the day is Valid, red if Invalid.
  - Headers and numbers never wrap; only Towns may wrap and gets the remaining width.
  - Bold Totals row: # = DISTINCT Counted Towns in the month; KMs and hours = sums.
- Own Copy image button.

### 5.5 Day Detail table (per selected RM – keep current table, add columns)
Columns: Date, Day, Status (day label from 4.2), Towns, Trip Start, Trip End, Total Trip hrs, Prod Start, Prod End,
Productive hrs, Travel hrs, Total hrs, KMs, Counted Towns, Day Type (Valid/Invalid + reason, or Leave/Holiday/…),
Base Town (Base-only / Base + Other / No), Plan Deviation (planned town if different), Remarks.
- Towns column shows each town with its hours; towns under 2 hrs greyed out.
- Show EVERY date of the month up to Data Up To, including Missing days as "No entry" rows.
- Multi-town days: one row per day; towns comma-separated; times = first start / last end; hours = sums.
- Totals row at the bottom.

### 5.6 Month Comparison table (separate block)
- Rows = RMs, grouped by metric OR per-RM mini table – columns = last 3 uploaded months (e.g. Aug | Sep | Oct).
- Metrics: Target, Adjusted Target, Achieved, Ach %, Valid, Invalid, Base-only, Other TTY, Leaves, Holidays,
  Office Work, Meetings, Territories Not Visited, Towns Not Visited (6M), Towns Repeated, Avg Prod Hrs, Total KMs.
- Change vs previous month shown with ▲ / ▼ in green/red.

### 5.7 Alerts panel
- One title per panel with count badge, month and "Data up to" date (no duplicate titles).
- **Missing days**: only up to Data Up To, never up to today.
- **Invalid days**: each line = RM name, then "12-Oct Mon · Towns (hrs each) · 4.2 hrs productive · 3.1 hrs travel",
  the reason ("Under 5 hrs" / "No town ≥ 2 hrs"), and Remarks in italics underneath if any.
- **Base-only days over 4**: RM, count, dates not counted.
- **Territories not visited this month**: RM and territory names.
- **Over SOP**: RMs with Meetings > 3, Office Work > 4 or Leaves > 1.
- **Base town mismatch**: any base town in RM master not found in territory structure.

## 6. Reports (each exportable to Excel; PDF later)
1. RM Monthly Summary (same as Ranking table, incl. Total KMs and Avg KMs / day)
2. RM Day-wise Detail (same as Day Detail incl. KMs, all RMs)
3. Coverage report – Territories Not Visited (month) and Towns Not Visited (6M) by RM / territory
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