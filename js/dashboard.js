const SUMMARY_COLS = [
  { key: "rmName", label: "RM Name" },
  { key: "region", label: "Region" },
  { key: "target", label: "Target" },
  { key: "leaveDays", label: "Leave Days" },
  { key: "adjustedTarget", label: "Adj. Target" },
  { key: "achieved", label: "Achieved" },
  { key: "achievementPctLabel", label: "Achievement %" },
  { key: "totalVisits", label: "Total Visits" },
  { key: "uniqueTownsVisited", label: "Unique Towns" },
  { key: "fieldDays", label: "Field Days" },
  { key: "validVisitDays", label: "Valid Visit Days" },
  { key: "greenDays", label: "Green Days" },
  { key: "redDays", label: "Red Days" },
  { key: "invalidDays", label: "Invalid Days" },
  { key: "baseTownDays", label: "Base Town Days" },
  { key: "meetingDays", label: "Meetings" },
  { key: "officeworkDays", label: "Officework" },
  { key: "transitDays", label: "Transit" },
  { key: "planAdherenceLabel", label: "Plan Adherence" },
  { key: "planDeviationLabel", label: "Plan Deviation" },
  { key: "totalTripHours", label: "Total Trip Hrs" },
  { key: "avgTripHours", label: "Avg Trip Hrs" },
  { key: "totalProdHours", label: "Total Prod Hrs" },
  { key: "avgProdHours", label: "Avg Prod Hrs" },
  { key: "totalTravelHours", label: "Total Travel Hrs" },
  { key: "avgTravelHours", label: "Avg Travel Hrs" },
  { key: "territoriesNotVisited", label: "Terr. not visited" },
  { key: "townsNotVisited", label: "Towns not visited" },
  { key: "coverageLabel", label: "Coverage %" },
  { key: "visitsPerTerritory", label: "Visits / territory" },
  { key: "visitsPerTown", label: "Visits / town" }
];

const DAY_COLS = [
  { key: "dateISO", label: "Date" },
  { key: "dayName", label: "Day" },
  { key: "status", label: "Status" },
  { key: "towns", label: "Towns" },
  { key: "dailyProdHours", label: "Daily prod hrs" },
  { key: "dayType", label: "Day type" },
  { key: "baseTownDayLabel", label: "Base town day" }
];

let dashCache = { visits: [], rms: [], territory: null, summaries: [] };

function monthPretty(key) {
  const p = String(key || "").split("-");
  if (p.length !== 2) return key;
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return names[Number(p[1]) - 1] + " " + p[0];
}

function achievementClass(pct) {
  if (pct == null) return "";
  if (pct >= 100) return "ach-green";
  if (pct >= 70) return "ach-amber";
  return "ach-red";
}

function dayTypeClass(type) {
  if (type === "Green") return "type-green";
  if (type === "Red") return "type-red";
  if (type === "Invalid") return "type-invalid";
  return "";
}

function renderWideTable(container, columns, rows, emptyText, rowClassFn, cellClassFn) {
  if (!rows || !rows.length) {
    container.innerHTML = '<p class="empty">' + emptyText + "</p>";
    return;
  }
  const head = columns.map((c) => "<th>" + c.label + "</th>").join("");
  const body = rows.map((row) => {
    const rc = rowClassFn ? rowClassFn(row) : "";
    const tds = columns.map((c) => {
      let val = row[c.key];
      if (typeof val === "number") val = Number.isInteger(val) ? val : formatHours(val);
      if (val == null || val === "") val = "—";
      const cc = cellClassFn ? cellClassFn(row, c.key) : "";
      return "<td" + (cc ? ' class="' + cc + '"' : "") + ">" + escapeHtml(val) + "</td>";
    }).join("");
    return "<tr" + (rc ? ' class="' + rc + '"' : "") + ">" + tds + "</tr>";
  }).join("");
  container.innerHTML = '<table class="data data-wide"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
}

async function refreshDashboard() {
  dashCache.visits = await getAllVisitLogs();
  dashCache.rms = await getAllRmMaster();
  const terr = await getTerritory();
  dashCache.territory = terr ? terr.rows : [];
  fillDashMonth();
  drawSummary();
}

function fillDashMonth() {
  const sel = document.getElementById("dash-month");
  const months = dashCache.visits.map((v) => v.month);
  if (!months.length) {
    sel.hidden = true;
    sel.innerHTML = "";
    return;
  }
  const prev = sel.value;
  sel.hidden = false;
  sel.innerHTML = months.map((m) => "<option value=\"" + m + "\">" + monthPretty(m) + "</option>").join("");
  if (prev && months.indexOf(prev) >= 0) sel.value = prev;
  else sel.value = months[months.length - 1];
}

function selectedVisitPack() {
  const key = document.getElementById("dash-month").value;
  return dashCache.visits.find((v) => v.month === key) || null;
}

function drawSummary() {
  const pack = selectedVisitPack();
  const meta = document.getElementById("summary-meta");
  const rmSel = document.getElementById("dash-rm");
  if (!pack) {
    meta.textContent = "Upload a visit log to see monthly KPIs.";
    rmSel.hidden = true;
    renderWideTable(document.getElementById("table-summary"), [], [], "No visit data saved yet.");
    renderWideTable(document.getElementById("table-days"), [], [], "No day detail yet.");
    document.getElementById("day-meta").textContent = "Pick an RM to see each day.";
    return;
  }
  const summaries = summarizeMonth(pack.month, pack.rows, dashCache.rms, dashCache.territory);
  dashCache.summaries = summaries;
  meta.textContent = summaries.length + " RM(s) · " + pack.rows.length + " visit-log rows · " + monthPretty(pack.month);
  renderWideTable(
    document.getElementById("table-summary"),
    SUMMARY_COLS,
    summaries,
    "No RM master for this month.",
    (row) => (row.unmatched ? "row-error " : "") + achievementClass(row.achievementPct),
    (row, key) => (key === "achievementPctLabel" ? achievementClass(row.achievementPct) : "")
  );
  const prevRm = rmSel.value;
  rmSel.hidden = false;
  rmSel.innerHTML = summaries.map((s) => "<option>" + escapeHtml(s.rmName) + "</option>").join("");
  if (prevRm && summaries.some((s) => s.rmName === prevRm)) rmSel.value = prevRm;
  drawDayDetail();
}

function drawDayDetail() {
  const name = document.getElementById("dash-rm").value;
  const summary = dashCache.summaries.find((s) => s.rmName === name);
  const meta = document.getElementById("day-meta");
  if (!summary) {
    meta.textContent = "Pick an RM to see each day.";
    renderWideTable(document.getElementById("table-days"), [], [], "No days to show.");
    return;
  }
  meta.textContent = summary.rmName + " · " + summary.days.length + " day(s)";
  const rows = summary.days.map((d) => Object.assign({}, d, {
    dailyProdHours: d.dailyProdHours == null ? "—" : formatHours(d.dailyProdHours),
    baseTownDayLabel: d.baseTownDay ? "Yes" : "No"
  }));
  renderWideTable(
    document.getElementById("table-days"),
    DAY_COLS,
    rows,
    "No days to show.",
    (row) => dayTypeClass(row.dayType),
    (row, key) => (key === "dayType" ? dayTypeClass(row.dayType) : "")
  );
}

document.getElementById("dash-month").addEventListener("change", drawSummary);
document.getElementById("dash-rm").addEventListener("change", drawDayDetail);
refreshDashboard();
