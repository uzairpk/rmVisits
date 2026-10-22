const COLOR = {
  green: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  accent: "#2dd4bf",
  blue: "#60a5fa",
  purple: "#a78bfa",
  slate: "#94a3b8",
  sky: "#38bdf8",
  pink: "#fb7185",
  grid: "rgba(148, 163, 184, 0.12)",
  text: "#8b9bb4"
};

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

const RANK_COLS = [
  { key: "rmName", label: "RM" },
  { key: "region", label: "Region" },
  { key: "adjustedTarget", label: "Adj. target" },
  { key: "achieved", label: "Achieved" },
  { key: "achievementPct", label: "Achievement" },
  { key: "greenDays", label: "Green" },
  { key: "redDays", label: "Red" },
  { key: "invalidDays", label: "Invalid" },
  { key: "totalVisits", label: "Visits" },
  { key: "planAdherencePct", label: "Plan" },
  { key: "coveragePct", label: "Coverage" }
];

let dashCache = { visits: [], rms: [], territory: [], summaries: [], filtered: [] };
let chartStore = {};
let rankSort = { key: "achievementPct", dir: "desc" };

if (typeof Chart !== "undefined") {
  Chart.defaults.color = COLOR.text;
  Chart.defaults.borderColor = COLOR.grid;
  Chart.defaults.font.family = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.legend.labels.padding = 12;
  Chart.defaults.animation.duration = 350;
}

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

function achColor(pct) {
  if (pct == null) return COLOR.slate;
  if (pct >= 100) return COLOR.green;
  if (pct >= 70) return COLOR.amber;
  return COLOR.red;
}

function dayTypeClass(type) {
  if (type === "Green") return "type-green";
  if (type === "Red") return "type-red";
  if (type === "Invalid") return "type-invalid";
  return "";
}

function renderWideTable(container, columns, rows, emptyText, rowClassFn, cellClassFn, onRowClick) {
  if (!rows || !rows.length) {
    container.innerHTML = '<p class="empty">' + emptyText + "</p>";
    return;
  }
  const head = columns.map((c) => "<th>" + c.label + "</th>").join("");
  const body = rows.map((row, idx) => {
    const rc = rowClassFn ? rowClassFn(row) : "";
    const tds = columns.map((c) => {
      let val = row[c.key];
      if (typeof val === "number") val = Number.isInteger(val) ? val : formatHours(val);
      if (val == null || val === "") val = "—";
      const cc = cellClassFn ? cellClassFn(row, c.key) : "";
      return "<td" + (cc ? ' class="' + cc + '"' : "") + ">" + escapeHtml(val) + "</td>";
    }).join("");
    return "<tr data-idx=\"" + idx + "\"" + (rc ? ' class="' + rc + '"' : "") + ">" + tds + "</tr>";
  }).join("");
  container.innerHTML = '<table class="data data-wide"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  if (onRowClick) {
    container.querySelectorAll("tbody tr").forEach((tr) => {
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => onRowClick(rows[Number(tr.dataset.idx)]));
    });
  }
}

function datesInMonth(monthKey, untilToday) {
  const p = String(monthKey || "").split("-");
  if (p.length !== 2) return [];
  const y = Number(p[0]);
  const m = Number(p[1]);
  const last = new Date(y, m, 0).getDate();
  const today = new Date();
  const out = [];
  for (let d = 1; d <= last; d++) {
    if (untilToday) {
      const dt = new Date(y, m - 1, d);
      dt.setHours(0, 0, 0, 0);
      const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (dt > t) break;
    }
    out.push(isoDate(y, m, d));
  }
  return out;
}

function isoDate(y, m, d) {
  return String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

async function refreshDashboard() {
  dashCache.visits = await getAllVisitLogs();
  dashCache.rms = await getAllRmMaster();
  const terr = await getTerritory();
  dashCache.territory = terr ? terr.rows : [];
  fillMonthOptions();
  drawDashboard();
}

function fillMonthOptions() {
  const sel = document.getElementById("dash-month");
  const months = dashCache.visits.map((v) => v.month);
  const prev = sel.value;
  if (!months.length) {
    sel.innerHTML = '<option value="">No months</option>';
    return;
  }
  sel.innerHTML = months.map((m) => "<option value=\"" + m + "\">" + monthPretty(m) + "</option>").join("");
  if (prev && months.indexOf(prev) >= 0) sel.value = prev;
  else sel.value = months[months.length - 1];
}

function selectedVisitPack() {
  const key = document.getElementById("dash-month").value;
  return dashCache.visits.find((v) => v.month === key) || null;
}

function fillDependentFilters(summaries) {
  const zoneSel = document.getElementById("filter-zone");
  const regionSel = document.getElementById("filter-region");
  const rmSel = document.getElementById("filter-rm");
  const prev = {
    zone: zoneSel.value,
    region: regionSel.value,
    rm: rmSel.value
  };
  const zones = uniqueSorted(summaries.map((s) => s.zone).filter(Boolean));
  zoneSel.innerHTML = '<option value="all">All zones</option>' +
    zones.map((z) => "<option>" + escapeHtml(z) + "</option>").join("");
  if (prev.zone && (prev.zone === "all" || zones.indexOf(prev.zone) >= 0)) zoneSel.value = prev.zone;

  const zone = zoneSel.value;
  const inZone = summaries.filter((s) => zone === "all" || s.zone === zone);
  const regions = uniqueSorted(inZone.map((s) => s.region).filter(Boolean));
  regionSel.innerHTML = '<option value="all">All regions</option>' +
    regions.map((r) => "<option>" + escapeHtml(r) + "</option>").join("");
  if (prev.region && (prev.region === "all" || regions.indexOf(prev.region) >= 0)) regionSel.value = prev.region;

  const region = regionSel.value;
  const inRegion = inZone.filter((s) => region === "all" || s.region === region);
  const rms = uniqueSorted(inRegion.map((s) => s.rmName).filter(Boolean));
  rmSel.innerHTML = '<option value="all">All RMs</option>' +
    rms.map((n) => "<option>" + escapeHtml(n) + "</option>").join("");
  if (prev.rm && (prev.rm === "all" || rms.indexOf(prev.rm) >= 0)) rmSel.value = prev.rm;
}

function applyFilters(summaries) {
  const zone = document.getElementById("filter-zone").value;
  const region = document.getElementById("filter-region").value;
  const rm = document.getElementById("filter-rm").value;
  return summaries.filter((s) => {
    if (zone !== "all" && s.zone !== zone) return false;
    if (region !== "all" && s.region !== region) return false;
    if (rm !== "all" && s.rmName !== rm) return false;
    return true;
  });
}

function drawDashboard() {
  const pack = selectedVisitPack();
  const empty = document.getElementById("dash-empty");
  const body = document.getElementById("dash-body");
  if (!pack) {
    empty.hidden = false;
    body.hidden = true;
    document.getElementById("dash-subtitle").textContent = "Upload a visit log to see performance for the month.";
    return;
  }
  empty.hidden = true;
  body.hidden = false;
  const summaries = summarizeMonth(pack.month, pack.rows, dashCache.rms, dashCache.territory);
  dashCache.summaries = summaries;
  dashCache.pack = pack;
  fillDependentFilters(summaries);
  const filtered = applyFilters(summaries);
  dashCache.filtered = filtered;
  document.getElementById("dash-subtitle").textContent =
    monthPretty(pack.month) + " · " + filtered.length + " RM" + (filtered.length === 1 ? "" : "s") +
    " · " + pack.rows.length + " visit-log rows";
  drawKpis(filtered);
  drawAlerts(filtered, pack);
  drawCharts(filtered, pack);
  drawRanking(filtered);
  drawSummaryTable(filtered);
  fillDayRmSelect(filtered);
  drawDayDetail();
}

function drawKpis(rows) {
  const achieved = sum(rows, "achieved");
  const adj = sum(rows, "adjustedTarget");
  const pctVal = adj > 0 ? round2((achieved / adj) * 100) : null;
  const green = sum(rows, "greenDays");
  const red = sum(rows, "redDays");
  const valid = sum(rows, "validVisitDays");
  const visits = sum(rows, "totalVisits");
  const planOk = sum(rows, "planMatchCount");
  const planPct = visits ? round2((planOk / visits) * 100) : null;

  let townTotal = 0;
  let townMiss = 0;
  let terrMiss = 0;
  const seenRegion = {};
  rows.forEach((s) => {
    const key = collapseSpaces(s.region).toLowerCase();
    if (!key || seenRegion[key]) return;
    seenRegion[key] = true;
    townTotal += s.regionTownCount || 0;
    townMiss += s.townsNotVisited || 0;
    terrMiss += s.territoriesNotVisited || 0;
  });
  if (rows.length === 1) {
    townTotal = rows[0].regionTownCount || 0;
    townMiss = rows[0].townsNotVisited || 0;
    terrMiss = rows[0].territoriesNotVisited || 0;
  } else {
    townMiss = 0;
    terrMiss = 0;
    townTotal = 0;
    const regions = uniqueSorted(rows.map((s) => s.region).filter(Boolean));
    regions.forEach((region) => {
      const towns = townsInRegion(dashCache.territory, region);
      const names = uniqueSorted(towns.map((t) => t.town));
      townTotal += names.length;
      const visited = {};
      rows.filter((s) => s.region === region).forEach((s) => {
        String(s.uniqueTownsList || "").split(",").forEach((t) => {
          const k = collapseSpaces(t).toLowerCase();
          if (k) visited[k] = true;
        });
      });
      townMiss += names.filter((t) => !visited[collapseSpaces(t).toLowerCase()]).length;
      const ters = uniqueSorted(towns.map((t) => t.territory));
      terrMiss += ters.filter((ter) => {
        const ts = towns.filter((t) => collapseSpaces(t.territory).toLowerCase() === collapseSpaces(ter).toLowerCase());
        return !ts.some((t) => visited[collapseSpaces(t.town).toLowerCase()]);
      }).length;
    });
  }

  const barCls = achievementClass(pctVal);
  const items = [
    kpiHtml("Achieved vs adj. target", (achieved + " / " + adj), formatPct(pctVal), barCls, pctVal),
    kpiHtml("Valid visit days", String(valid), green + " green · " + red + " red"),
    kpiHtml("Invalid days", String(sum(rows, "invalidDays")), "Do not count toward target", "kpi-bad"),
    kpiHtml("Total visits", String(visits), "Town visit rows"),
    kpiHtml("Base town days", String(sum(rows, "baseTownDays")), "Only base town that day"),
    kpiHtml("Leave days", String(sum(rows, "leaveDays")), "Reduce adjusted target"),
    kpiHtml("Meeting days", String(sum(rows, "meetingDays")), "Do not reduce target"),
    kpiHtml("Plan adherence", formatPct(planPct), planOk + " of " + visits + " visits matched"),
    kpiHtml("Towns not visited", String(townMiss), townMiss + " of " + townTotal + " towns"),
    kpiHtml("Territories not visited", String(terrMiss), "In the filtered regions")
  ];
  document.getElementById("kpi-grid").innerHTML = items.join("");
}

function kpiHtml(label, value, sub, extraClass, barPct) {
  let bar = "";
  if (barPct != null) {
    const w = Math.max(0, Math.min(100, barPct));
    bar = '<div class="kpi-bar"><span class="' + achievementClass(barPct) + '" style="width:' + w + '%"></span></div>';
  }
  return '<article class="kpi ' + (extraClass || "") + '">' +
    '<div class="kpi-value">' + escapeHtml(value) + "</div>" +
    '<div class="kpi-label">' + escapeHtml(label) + "</div>" +
    '<div class="kpi-sub">' + escapeHtml(sub) + "</div>" + bar +
    "</article>";
}

function sum(rows, key) {
  return rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
}

function drawAlerts(rows, pack) {
  const monthKey = pack.month;
  const calendar = datesInMonth(monthKey, true);
  const missing = [];
  rows.filter((s) => !s.unmatched).forEach((s) => {
    const have = {};
    (s.days || []).forEach((d) => { have[d.dateISO] = true; });
    calendar.forEach((iso) => {
      if (!have[iso]) missing.push({ rmName: s.rmName, dateISO: iso });
    });
  });

  const invalid = [];
  rows.forEach((s) => {
    (s.days || []).filter((d) => d.isInvalid).forEach((d) => {
      invalid.push({
        rmName: s.rmName,
        dateISO: d.dateISO,
        towns: d.towns || "—",
        hrs: d.dailyProdHours == null ? "—" : formatHours(d.dailyProdHours)
      });
    });
  });

  const townSet = {};
  (dashCache.territory || []).forEach((t) => { townSet[norm(t.town)] = true; });
  const visitTowns = {};
  (pack.rows || []).forEach((r) => {
    if (r.trackerPresence) visitTowns[norm(r.trackerPresence)] = true;
  });
  const baseBad = rows.filter((s) => {
    if (s.unmatched || !s.baseTown) return false;
    const k = norm(s.baseTown);
    return !townSet[k] && !visitTowns[k];
  });

  document.getElementById("alert-grid").innerHTML =
    alertCard("Missing days", "No visit-log row at all (future dates excluded)", missing.length,
      missing.length ? missing.map((m) => alertLine(m.rmName, m.dateISO, "", m.rmName)).join("") : '<p class="empty">None in this view.</p>') +
    alertCard("Invalid days", "Field days under 2 productive hours", invalid.length,
      invalid.length ? invalid.map((m) => alertLine(m.rmName, m.dateISO + " · " + m.towns, m.hrs + " hrs", m.rmName)).join("") : '<p class="empty">None in this view.</p>') +
    alertCard("Base town mismatch", "Base town not in territory or visit towns", baseBad.length,
      baseBad.length ? baseBad.map((s) => alertLine(s.rmName, s.baseTown || "—", s.region, s.rmName)).join("") : '<p class="empty">None in this view.</p>');

  document.getElementById("alert-grid").querySelectorAll("[data-rm]").forEach((el) => {
    el.addEventListener("click", () => openRmDetail(el.dataset.rm));
  });
}

function alertCard(title, hint, count, body) {
  return '<article class="card alert-card">' +
    '<div class="alert-head"><h2>' + escapeHtml(title) + '</h2><span class="badge ' +
    (count ? "badge-bad" : "badge-ok") + '">' + count + "</span></div>" +
    '<p class="muted tiny alert-hint">' + escapeHtml(hint) + "</p>" +
    '<div class="alert-list">' + body + "</div></article>";
}

function alertLine(title, sub, extra, rm) {
  return '<button type="button" class="alert-line" data-rm="' + escapeHtml(rm) + '">' +
    '<span class="alert-title">' + escapeHtml(title) + "</span>" +
    '<span class="alert-sub">' + escapeHtml(sub) + (extra ? " · " + escapeHtml(extra) : "") + "</span></button>";
}

function chartOpts(extra) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { color: COLOR.grid }, ticks: { color: COLOR.text, maxRotation: 0 } },
      y: { grid: { color: COLOR.grid }, ticks: { color: COLOR.text } }
    }
  }, extra || {});
}

function upsertChart(id, config) {
  if (chartStore[id]) chartStore[id].destroy();
  const el = document.getElementById(id);
  chartStore[id] = new Chart(el, config);
}

function setBoxHeight(canvasId, px) {
  document.getElementById(canvasId).parentElement.style.height = px + "px";
}

function rmClickPlugin() {
  return {
    onClick: function (evt, elements, chart) {
      if (!elements.length) return;
      const label = chart.data.labels[elements[0].index];
      if (label) openRmDetail(label);
    },
    onHover: function (evt, elements) {
      const native = evt && (evt.native || evt);
      if (native && native.target) native.target.style.cursor = elements.length ? "pointer" : "default";
    }
  };
}

function drawCharts(rows, pack) {
  const ranked = rows.slice().sort((a, b) => (b.achievementPct || -1) - (a.achievementPct || -1));
  const names = ranked.map((s) => s.rmName);
  const h = Math.max(220, names.length * 34 + 48);
  setBoxHeight("chart-achieve", h);
  setBoxHeight("chart-time", h);
  setBoxHeight("chart-mix", h);
  setBoxHeight("chart-plan", h);

  upsertChart("chart-achieve", {
    type: "bar",
    data: {
      labels: names,
      datasets: [
        {
          label: "Adjusted target",
          data: ranked.map((s) => s.adjustedTarget),
          backgroundColor: "rgba(148,163,184,0.28)",
          borderRadius: 4
        },
        {
          label: "Achieved",
          data: ranked.map((s) => s.achieved),
          backgroundColor: ranked.map((s) => achColor(s.achievementPct)),
          borderRadius: 4
        }
      ]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: true, position: "bottom" } }
    }), rmClickPlugin())
  });

  const days = datesInMonth(pack.month, false);
  const trend = days.map((iso) => rows.reduce((n, s) => n + ((s.days || []).some((d) => d.dateISO === iso && d.isValidVisitDay) ? 1 : 0), 0));
  upsertChart("chart-trend", {
    type: "line",
    data: {
      labels: days.map((iso) => iso.slice(8)),
      datasets: [{
        label: "Valid visit days",
        data: trend,
        borderColor: COLOR.accent,
        backgroundColor: "rgba(45, 212, 191, 0.12)",
        fill: true,
        tension: 0.25,
        pointRadius: 3,
        pointBackgroundColor: COLOR.accent
      }]
    },
    options: chartOpts({
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLOR.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: COLOR.text }, grid: { color: COLOR.grid } }
      }
    })
  });

  upsertChart("chart-time", {
    type: "bar",
    data: {
      labels: names,
      datasets: [
        { label: "Productive", data: ranked.map((s) => s.totalProdHours || 0), backgroundColor: COLOR.accent, borderRadius: 3 },
        { label: "Travel", data: ranked.map((s) => s.totalTravelHours || 0), backgroundColor: COLOR.blue, borderRadius: 3 }
      ]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: true, position: "bottom" } },
      scales: {
        x: { stacked: true, grid: { color: COLOR.grid }, ticks: { color: COLOR.text } },
        y: { stacked: true, grid: { display: false }, ticks: { color: COLOR.text } }
      }
    }), rmClickPlugin())
  });

  upsertChart("chart-mix", {
    type: "bar",
    data: {
      labels: names,
      datasets: [
        { label: "Green", data: ranked.map((s) => s.greenDays), backgroundColor: COLOR.green },
        { label: "Red", data: ranked.map((s) => s.redDays), backgroundColor: COLOR.amber },
        { label: "Invalid", data: ranked.map((s) => s.invalidDays), backgroundColor: COLOR.red },
        { label: "Meeting", data: ranked.map((s) => s.meetingDays), backgroundColor: COLOR.purple },
        { label: "Leave", data: ranked.map((s) => s.leaveDays), backgroundColor: COLOR.slate },
        { label: "Officework", data: ranked.map((s) => s.officeworkDays), backgroundColor: COLOR.sky },
        { label: "Transit", data: ranked.map((s) => s.transitDays), backgroundColor: COLOR.pink }
      ]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: true, position: "bottom" } },
      scales: {
        x: { stacked: true, grid: { color: COLOR.grid }, ticks: { color: COLOR.text } },
        y: { stacked: true, grid: { display: false }, ticks: { color: COLOR.text } }
      }
    }), rmClickPlugin())
  });

  const regions = uniqueSorted(rows.map((s) => s.region).filter(Boolean));
  const cov = regions.map((region) => {
    const towns = townsInRegion(dashCache.territory, region);
    const namesT = uniqueSorted(towns.map((t) => t.town));
    const visited = {};
    rows.filter((s) => s.region === region).forEach((s) => {
      String(s.uniqueTownsList || "").split(",").forEach((t) => {
        const k = collapseSpaces(t).toLowerCase();
        if (k) visited[k] = true;
      });
    });
    const hit = namesT.filter((t) => visited[collapseSpaces(t).toLowerCase()]).length;
    return namesT.length ? round2((hit / namesT.length) * 100) : 0;
  });
  upsertChart("chart-coverage", {
    type: "bar",
    data: {
      labels: regions,
      datasets: [{
        label: "Coverage %",
        data: cov,
        backgroundColor: COLOR.accent,
        borderRadius: 6
      }]
    },
    options: chartOpts({
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLOR.text } },
        y: { beginAtZero: true, max: 100, grid: { color: COLOR.grid }, ticks: { color: COLOR.text, callback: (v) => v + "%" } }
      }
    })
  });

  upsertChart("chart-plan", {
    type: "bar",
    data: {
      labels: names,
      datasets: [{
        label: "Plan adherence %",
        data: ranked.map((s) => s.planAdherencePct == null ? 0 : s.planAdherencePct),
        backgroundColor: ranked.map((s) => achColor(s.planAdherencePct)),
        borderRadius: 4
      }]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 100, grid: { color: COLOR.grid }, ticks: { color: COLOR.text, callback: (v) => v + "%" } },
        y: { grid: { display: false }, ticks: { color: COLOR.text } }
      }
    }), rmClickPlugin())
  });
}

function drawRanking(rows) {
  const key = rankSort.key;
  const dir = rankSort.dir === "asc" ? 1 : -1;
  const sorted = rows.slice().sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (va == null) va = -999;
    if (vb == null) vb = -999;
    if (typeof va === "string") return dir * String(va).localeCompare(String(vb));
    return dir * (va - vb);
  });
  const head = RANK_COLS.map((c) => {
    const mark = c.key === rankSort.key ? (rankSort.dir === "asc" ? " ↑" : " ↓") : "";
    return '<th data-key="' + c.key + '" class="sortable">' + c.label + mark + "</th>";
  }).join("");
  const body = sorted.map((row) => {
    const tds = RANK_COLS.map((c) => {
      if (c.key === "achievementPct") {
        const pill = achievementClass(row.achievementPct);
        return '<td><span class="pill ' + pill + '">' + escapeHtml(row.achievementPctLabel) + "</span></td>";
      }
      if (c.key === "planAdherencePct") return "<td>" + escapeHtml(row.planAdherenceLabel) + "</td>";
      if (c.key === "coveragePct") return "<td>" + escapeHtml(row.coverageLabel) + "</td>";
      let val = row[c.key];
      if (val == null || val === "") val = "—";
      return "<td>" + escapeHtml(val) + "</td>";
    }).join("");
    return '<tr class="rank-row" data-rm="' + escapeHtml(row.rmName) + '">' + tds + "</tr>";
  }).join("");
  const wrap = document.getElementById("table-ranking");
  if (!sorted.length) {
    wrap.innerHTML = '<p class="empty">No RMs in this filter.</p>';
    return;
  }
  wrap.innerHTML = '<table class="data rank-table"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  wrap.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.dataset.key;
      if (rankSort.key === k) rankSort.dir = rankSort.dir === "desc" ? "asc" : "desc";
      else { rankSort.key = k; rankSort.dir = k === "rmName" || k === "region" ? "asc" : "desc"; }
      drawRanking(dashCache.filtered);
    });
  });
  wrap.querySelectorAll("tr.rank-row").forEach((tr) => {
    tr.addEventListener("click", () => openRmDetail(tr.dataset.rm));
  });
}

function drawSummaryTable(rows) {
  const meta = document.getElementById("summary-meta");
  meta.textContent = rows.length + " RM(s) in the current filters";
  renderWideTable(
    document.getElementById("table-summary"),
    SUMMARY_COLS,
    rows,
    "No RM rows in this filter.",
    (row) => (row.unmatched ? "row-error " : "") + achievementClass(row.achievementPct),
    (row, key) => (key === "achievementPctLabel" ? achievementClass(row.achievementPct) : ""),
    (row) => openRmDetail(row.rmName)
  );
}

function fillDayRmSelect(rows) {
  const sel = document.getElementById("dash-rm");
  const prev = sel.value;
  const filterRm = document.getElementById("filter-rm").value;
  sel.innerHTML = rows.map((s) => "<option>" + escapeHtml(s.rmName) + "</option>").join("");
  if (filterRm !== "all" && rows.some((s) => s.rmName === filterRm)) sel.value = filterRm;
  else if (prev && rows.some((s) => s.rmName === prev)) sel.value = prev;
}

function drawDayDetail() {
  const name = document.getElementById("dash-rm").value;
  const summary = dashCache.filtered.find((s) => s.rmName === name) ||
    dashCache.summaries.find((s) => s.rmName === name);
  const meta = document.getElementById("day-meta");
  if (!summary) {
    meta.textContent = "Pick an RM to see each day.";
    renderWideTable(document.getElementById("table-days"), [], [], "No days to show.");
    return;
  }
  meta.textContent = summary.rmName + " · " + summary.days.length + " day(s) with a log entry";
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

function openRmDetail(name) {
  const sel = document.getElementById("dash-rm");
  if (![...sel.options].some((o) => o.value === name)) {
    const all = document.getElementById("filter-rm");
    if (all) {
      document.getElementById("filter-zone").value = "all";
      document.getElementById("filter-region").value = "all";
      all.value = "all";
      drawDashboard();
    }
  }
  const sel2 = document.getElementById("dash-rm");
  if ([...sel2.options].some((o) => o.value === name)) sel2.value = name;
  drawDayDetail();
  const card = document.getElementById("card-days");
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  card.classList.add("flash");
  setTimeout(() => card.classList.remove("flash"), 1200);
}

document.getElementById("dash-month").addEventListener("change", drawDashboard);
document.getElementById("filter-zone").addEventListener("change", drawDashboard);
document.getElementById("filter-region").addEventListener("change", drawDashboard);
document.getElementById("filter-rm").addEventListener("change", drawDashboard);
document.getElementById("dash-rm").addEventListener("change", drawDayDetail);
refreshDashboard();
