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

const DAY_COLS = [
  { key: "dateISO", label: "Date" },
  { key: "dayName", label: "Day" },
  { key: "status", label: "Status" },
  { key: "towns", label: "Towns" },
  { key: "tripStartLabel", label: "Trip start" },
  { key: "tripEndLabel", label: "Trip end" },
  { key: "dailyTripHours", label: "Trip hrs" },
  { key: "prodStartLabel", label: "Prod start" },
  { key: "prodEndLabel", label: "Prod end" },
  { key: "dailyProdHours", label: "Prod hrs" },
  { key: "dailyTravelHours", label: "Travel hrs" },
  { key: "dayType", label: "Day type" },
  { key: "baseTownDayLabel", label: "Base town" },
  { key: "planDeviationText", label: "Plan deviation" },
  { key: "remarks", label: "Remarks" }
];

const RANK_COLS = [
  { key: "rmName", label: "RM" },
  { key: "region", label: "Region" },
  { key: "adjustedTarget", label: "Adj. target" },
  { key: "expectedByNow", label: "Expected by now" },
  { key: "achieved", label: "Achieved" },
  { key: "achievementPct", label: "Ach %" },
  { key: "pace", label: "Pace" },
  { key: "greenDays", label: "Green" },
  { key: "redDays", label: "Red" },
  { key: "invalidDays", label: "Invalid" },
  { key: "baseTownDays", label: "Base town" },
  { key: "otherTtyDays", label: "Other TTY" },
  { key: "leaveDays", label: "Leave" },
  { key: "holidayDays", label: "Holiday" },
  { key: "meetingDays", label: "Meeting" },
  { key: "officeworkDays", label: "Office Work" },
  { key: "missingDays", label: "Missing" },
  { key: "townsNotVisited", label: "Towns not vis. (3M)" },
  { key: "planAdherencePct", label: "Plan %" }
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

function paceColor(row) {
  if (!row) return COLOR.slate;
  if (row.paceClass === "ach-green") return COLOR.green;
  if (row.paceClass === "ach-amber") return COLOR.amber;
  if (row.paceClass === "ach-red") return COLOR.red;
  return COLOR.slate;
}

const DAY_CELL = {
  Green: { bg: "#34d399", label: "Green" },
  Red: { bg: "#fbbf24", label: "Red" },
  Invalid: { bg: "#f87171", label: "Invalid" },
  Leave: { bg: "#94a3b8", label: "Leave" },
  Holiday: { bg: "#64748b", label: "Holiday" },
  Meeting: { bg: "#a78bfa", label: "Meeting" },
  "Office Work": { bg: "#38bdf8", label: "Office Work" },
  OW: { bg: "#38bdf8", label: "Office Work" },
  Transit: { bg: "#fb7185", label: "Transit" },
  "No entry": { bg: "#334155", label: "Missing" },
  Missing: { bg: "#334155", label: "Missing" }
};

function dayTypeClass(type) {
  if (type === "Green") return "type-green";
  if (type === "Red") return "type-red";
  if (type === "Invalid") return "type-invalid";
  if (type === "No entry" || type === "Missing") return "type-missing";
  return "";
}

function formatDayVal(val) {
  if (val == null || val === "") return "—";
  if (typeof val === "number") return Number.isInteger(val) ? String(val) : formatHours(val);
  return String(val);
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
  const summaries = summarizeMonth(pack.month, pack.rows, dashCache.rms, dashCache.territory, dashCache.visits);
  dashCache.summaries = summaries;
  dashCache.pack = pack;
  fillDependentFilters(summaries);
  const filtered = applyFilters(summaries);
  dashCache.filtered = filtered;
  const dataUpTo = (filtered[0] && filtered[0].dataUpTo) || lastDateISO(pack.rows);
  dashCache.dataUpTo = dataUpTo;
  document.getElementById("dash-subtitle").textContent =
    monthPretty(pack.month) + " · Data up to " + (dataUpTo || "—") + " · " +
    filtered.length + " RM" + (filtered.length === 1 ? "" : "s");
  drawKpis(filtered);
  drawAlerts(filtered, pack);
  drawCharts(filtered, pack);
  drawDateGrid(filtered, pack);
  drawRmCards(filtered, pack);
  drawRanking(filtered);
  drawMonthComparison(filtered);
  fillDayRmSelect(filtered);
  drawDayDetail();
  wireCopyButtons();
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

  const townMiss = sum(rows, "townsNotVisited");
  const townTotal = sum(rows, "regionTownCount");

  const expected = sum(rows, "expectedByNow");
  const paceInfo = rows.length === 1 ? rows[0] : paceFrom(achieved, expected);
  const townNote = rows.length === 1 ? (rows[0].townsNotVisitedNote || "") : "Rolling 3 months, by region";
  const barCls = achievementClass(pctVal);
  const items = [
    kpiHtml("Achieved vs adj. target", (achieved + " / " + adj), formatPct(pctVal) + " · exp. " + expected, barCls, pctVal),
    kpiHtml("Valid visit days", String(valid), green + " green · " + red + " red"),
    kpiHtml("Invalid days", String(sum(rows, "invalidDays")), "Incomplete visit < 2 hrs", "kpi-bad"),
    kpiHtml("Total visits", String(visits), "Town visit rows"),
    kpiHtml("Base town days", String(sum(rows, "baseTownDays")), "Only base town that day"),
    kpiHtml("Other TTY days", String(sum(rows, "otherTtyDays")), "Valid days outside base town"),
    kpiHtml("Leave days", String(sum(rows, "leaveDays")), "Reduce adjusted target"),
    kpiHtml("Holiday days", String(sum(rows, "holidayDays")), "Weekly off · do not reduce target"),
    kpiHtml("Meeting days", String(sum(rows, "meetingDays")), "Do not reduce target"),
    kpiHtml("Pace", rows.length === 1 ? paceInfo.paceLabel : (paceInfo.paceLabel || "—"), "Achieved − expected by now", paceInfo.paceClass),
    kpiHtml("Plan adherence", formatPct(planPct), planOk + " of " + visits + " visits matched"),
    kpiHtml("Towns not visited (3M)", String(townMiss), (townMiss + " of " + townTotal + " towns") + (townNote ? " · " + townNote : ""))
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
  const missing = [];
  rows.filter((s) => !s.unmatched).forEach((s) => {
    (s.days || []).filter((d) => d.isMissing).forEach((d) => {
      missing.push({ rmName: s.rmName, dateISO: d.dateISO });
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
  const baseBad = rows.filter((s) => {
    if (s.unmatched || !s.baseTown) return false;
    return !townSet[norm(s.baseTown)];
  });

  const until = dashCache.dataUpTo || "Data Up To";
  document.getElementById("alert-grid").innerHTML =
    alertCard("Missing days", "No log row up to " + until + " (not today)", missing.length,
      missing.length ? missing.map((m) => alertLine(m.rmName, m.dateISO, "", m.rmName)).join("") : '<p class="empty">None in this view.</p>') +
    alertCard("Invalid days", "Field days under 2 productive hours", invalid.length,
      invalid.length ? invalid.map((m) => alertLine(m.rmName, m.dateISO + " · " + m.towns, m.hrs + " hrs", m.rmName)).join("") : '<p class="empty">None in this view.</p>') +
    alertCard("Base town mismatch", "Base town not found in territory structure", baseBad.length,
      baseBad.length ? baseBad.map((s) => alertLine(s.rmName, s.baseTown || "—", s.region, s.rmName)).join("") : '<p class="empty">None in this view.</p>');

  document.getElementById("alert-grid").querySelectorAll("[data-rm]").forEach((el) => {
    el.addEventListener("click", () => openRmDetail(el.dataset.rm));
  });
}

function alertCard(title, hint, count, body) {
  return '<article class="card alert-card" data-copy-title="' + escapeHtml(title) + '">' +
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

function refHourLines() {
  return {
    id: "refHourLines",
    afterDatasetsDraw: function (chart) {
      const xScale = chart.scales.x;
      const area = chart.chartArea;
      if (!xScale || !area) return;
      const ctx = chart.ctx;
      [[2, COLOR.amber, "2h"], [3, COLOR.green, "3h"]].forEach(function (item) {
        const x = xScale.getPixelForValue(item[0]);
        ctx.save();
        ctx.strokeStyle = item[1];
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, area.top);
        ctx.lineTo(x, area.bottom);
        ctx.stroke();
        ctx.fillStyle = item[1];
        ctx.font = "11px Segoe UI, sans-serif";
        ctx.fillText(item[2], x + 4, area.top + 12);
        ctx.restore();
      });
    }
  };
}

function drawCharts(rows, pack) {
  const ranked = rows.slice().sort((a, b) => (b.achievementPct || -1) - (a.achievementPct || -1));
  const names = ranked.map((s) => s.rmName);
  const h = Math.max(220, names.length * 36 + 56);
  ["chart-achieve", "chart-plan", "chart-tty", "chart-avgprod"].forEach((id) => setBoxHeight(id, h));

  upsertChart("chart-achieve", {
    type: "bar",
    data: {
      labels: names,
      datasets: [
        {
          label: "Adjusted target",
          data: ranked.map((s) => s.adjustedTarget),
          backgroundColor: "rgba(148,163,184,0.28)",
          borderRadius: 4,
          order: 2
        },
        {
          label: "Achieved",
          data: ranked.map((s) => s.achieved),
          backgroundColor: ranked.map((s) => paceColor(s)),
          borderRadius: 4,
          order: 1
        },
        {
          type: "line",
          label: "Expected by now",
          data: ranked.map((s) => s.expectedByNow),
          showLine: false,
          pointStyle: "rectRot",
          pointRadius: 7,
          pointHoverRadius: 8,
          backgroundColor: "#e8eef7",
          borderColor: "#0ea5e9",
          borderWidth: 2,
          order: 0
        }
      ]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: true, position: "bottom" } }
    }), rmClickPlugin())
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

  upsertChart("chart-tty", {
    type: "bar",
    data: {
      labels: names,
      datasets: [
        { label: "Base town", data: ranked.map((s) => s.baseTownDays || 0), backgroundColor: COLOR.accent, borderRadius: 3 },
        { label: "Other TTY", data: ranked.map((s) => s.otherTtyDays || 0), backgroundColor: COLOR.blue, borderRadius: 3 }
      ]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: true, position: "bottom" } },
      scales: {
        x: { stacked: true, beginAtZero: true, grid: { color: COLOR.grid }, ticks: { color: COLOR.text } },
        y: { stacked: true, grid: { display: false }, ticks: { color: COLOR.text } }
      }
    }), rmClickPlugin())
  });

  upsertChart("chart-avgprod", {
    type: "bar",
    data: {
      labels: names,
      datasets: [{
        label: "Avg prod hrs",
        data: ranked.map((s) => s.avgProdHours || 0),
        backgroundColor: COLOR.accent,
        borderRadius: 4
      }]
    },
    options: Object.assign(chartOpts({
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, suggestedMax: 4, grid: { color: COLOR.grid }, ticks: { color: COLOR.text } },
        y: { grid: { display: false }, ticks: { color: COLOR.text } }
      }
    }), rmClickPlugin()),
    plugins: [refHourLines()]
  });

  drawTrend3(ranked);
}

function drawTrend3(ranked) {
  const card = document.getElementById("card-trend3");
  const months = dashCache.visits.map((v) => v.month).sort();
  if (months.length < 2) {
    card.hidden = true;
    if (chartStore["chart-trend3"]) {
      chartStore["chart-trend3"].destroy();
      delete chartStore["chart-trend3"];
    }
    return;
  }
  card.hidden = false;
  const last3 = months.slice(-3);
  const palettes = [COLOR.accent, COLOR.blue, COLOR.purple, COLOR.amber, COLOR.pink, COLOR.green, COLOR.sky];
  const datasets = ranked.map((s, i) => ({
    label: s.rmName,
    data: last3.map((m) => {
      const pack = dashCache.visits.find((v) => v.month === m);
      const list = summarizeMonth(m, pack.rows, dashCache.rms, dashCache.territory, dashCache.visits);
      const rec = list.find((r) => r.rmName === s.rmName);
      return rec && rec.achievementPct != null ? rec.achievementPct : null;
    }),
    borderColor: palettes[i % palettes.length],
    backgroundColor: palettes[i % palettes.length],
    tension: 0.25,
    spanGaps: true,
    pointRadius: 4
  }));
  upsertChart("chart-trend3", {
    type: "line",
    data: { labels: last3.map(monthPretty), datasets: datasets },
    options: chartOpts({
      plugins: { legend: { display: true, position: "bottom" } },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLOR.text } },
        y: { beginAtZero: true, suggestedMax: 100, grid: { color: COLOR.grid }, ticks: { color: COLOR.text, callback: (v) => v + "%" } }
      }
    })
  });
}

function drawDateGrid(rows, pack) {
  const wrap = document.getElementById("date-grid");
  const dates = datesInMonth(pack.month, false);
  const dataUpTo = dashCache.dataUpTo || "";
  const head = '<th class="rm-name">RM</th>' + dates.map((iso) => "<th>" + Number(iso.slice(8)) + "</th>").join("");
  const body = rows.map((s) => {
    const byDate = {};
    (s.days || []).forEach((d) => { byDate[d.dateISO] = d; });
    const cells = dates.map((iso) => {
      if (dataUpTo && iso > dataUpTo) {
        return '<td class="dg-future" title="Future"></td>';
      }
      const d = byDate[iso];
      const type = d ? d.dayType : "No entry";
      const spec = DAY_CELL[type] || DAY_CELL["No entry"];
      const tip = (d && d.isFieldDay)
        ? (s.rmName + " · " + iso + " · " + type + " · " + (d.towns || "—") + " · " + formatHours(d.dailyProdHours) + " hrs")
        : (s.rmName + " · " + iso + " · " + type);
      return '<td class="dg-cell" style="background:' + spec.bg + '" title="' + escapeHtml(tip) + '" data-rm="' +
        escapeHtml(s.rmName) + '"></td>';
    }).join("");
    return '<tr><th class="rm-name">' + escapeHtml(s.rmName) + "</th>" + cells + "</tr>";
  }).join("");
  const legend = ["Green","Red","Invalid","Leave","Holiday","Meeting","Office Work","Transit","Missing"].map((k) => {
    const spec = DAY_CELL[k] || DAY_CELL["No entry"];
    return '<span class="dg-leg"><i style="background:' + spec.bg + '"></i>' + spec.label + "</span>";
  }).join("") + '<span class="dg-leg"><i class="dg-future-swatch"></i>Future</span>';
  wrap.innerHTML = '<div class="date-grid-scroll"><table class="date-grid"><thead><tr>' + head +
    "</tr></thead><tbody>" + body + "</tbody></table></div><div class=\"dg-legend\">" + legend + "</div>";
  wrap.querySelectorAll("td[data-rm]").forEach((td) => {
    td.addEventListener("click", () => openRmDetail(td.dataset.rm));
  });
}

function formatCardDate(iso, dayName) {
  const p = String(iso || "").split("-");
  if (p.length !== 3) return iso || "";
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return p[2] + "-" + names[Number(p[1]) - 1] + (dayName ? " " + dayName : "");
}

function formatDmy(iso) {
  const p = String(iso || "").split("-");
  if (p.length !== 3) return iso || "";
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return p[2] + "-" + names[Number(p[1]) - 1] + "-" + p[0];
}

function isMonthComplete(monthKey, dataUpTo) {
  if (!monthKey || !dataUpTo) return false;
  const last = daysInMonthKey(monthKey);
  const day = Number(String(dataUpTo).split("-")[2]);
  return last > 0 && day === last;
}

function rmCardHeadClass(row, monthKey) {
  const upto = row.dataUpTo || dashCache.dataUpTo;
  if (isMonthComplete(monthKey, upto)) return achievementClass(row.achievementPct) || "ach-red";
  return row.paceClass || "ach-red";
}

function kpiPair(label, value, hi) {
  return '<div class="rm-kpi-row' + (hi ? " hi" : "") + '"><dt>' + escapeHtml(label) +
    "</dt><dd>" + escapeHtml(value == null || value === "" ? "—" : value) + "</dd></div>";
}

function hrsTone(hours) {
  if (hours == null || hours === "") return "";
  const n = Number(hours);
  if (n >= 3) return "hrs-green";
  if (n >= 2) return "hrs-amber";
  return "";
}

function drawRmCards(rows, pack) {
  const grid = document.getElementById("rm-card-grid");
  const month = monthPretty(pack.month);
  grid.innerHTML = rows.filter((s) => !s.unmatched).map((s) => {
    const headCls = rmCardHeadClass(s, pack.month);
    const upto = s.dataUpTo || dashCache.dataUpTo;
    const left = [
      kpiPair("Target", s.target),
      kpiPair("Adjusted Target", s.adjustedTarget),
      kpiPair("Expected by Now", s.expectedByNow),
      kpiPair("Achieved", s.achieved, true),
      kpiPair("Ach %", s.achievementPctLabel, true),
      kpiPair("Pace", s.paceLabel, true),
      kpiPair("Base Town Visits", s.baseTownDays),
      kpiPair("Other TTY Visits", s.otherTtyDays)
    ].join("");
    const right = [
      kpiPair("Incomplete < 2 hrs", s.invalidDays),
      kpiPair("Leaves", s.leaveDays),
      kpiPair("Holidays", s.holidayDays),
      kpiPair("Office Work", s.officeworkDays),
      kpiPair("Meetings", s.meetingDays),
      kpiPair("Transit", s.transitDays),
      kpiPair("Missing Days", s.missingDays),
      kpiPair("Towns Not Visited (3M)", (s.townsNotVisited ?? "—") + (s.regionTownCount ? " / " + s.regionTownCount : ""))
    ].join("");
    const dayRows = (s.days || []).filter((d) => d.isGreen || d.isRed || d.isInvalid).map((d) => {
      const tone = hrsTone(d.dailyProdHours);
      return "<tr><td class=\"rm-day-date\">" + escapeHtml(formatCardDate(d.dateISO, d.dayName)) +
        "</td><td class=\"rm-day-towns\">" + escapeHtml(d.towns || "—") +
        "</td><td class=\"rm-day-hrs" + (tone ? " " + tone : "") + "\">" +
        escapeHtml(formatHours(d.dailyProdHours)) + "</td></tr>";
    }).join("");
    return '<article class="card rm-report-card" data-copy-title="' + escapeHtml(s.rmName) + '">' +
      '<header class="rm-card-head ' + headCls + '"><div class="rm-card-name">' + escapeHtml(s.rmName) +
      "</div><div class=\"rm-card-sub\">" + escapeHtml(s.region || "—") + " · " + escapeHtml(month) +
      "</div><div class=\"rm-card-upto\">Data up to " + escapeHtml(upto ? formatDmy(upto) : "—") +
      "</div></header><div class=\"rm-card-body\"><div class=\"rm-kpis\"><div class=\"rm-kpi-col\">" +
      left + "</div><div class=\"rm-kpi-col\">" + right + "</div></div>" +
      '<table class="rm-days"><thead><tr><th>Date</th><th>Towns</th><th>Prod hrs</th></tr></thead><tbody>' +
      (dayRows || '<tr><td colspan="3" class="rm-day-empty">No field days</td></tr>') +
      "</tbody></table></div></article>";
  }).join("");
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
      if (c.key === "rmName") return '<td class="rm-name">' + escapeHtml(row.rmName) + "</td>";
      if (c.key === "achievementPct") {
        const pill = achievementClass(row.achievementPct);
        return '<td><span class="pill ' + pill + '">' + escapeHtml(row.achievementPctLabel) + "</span></td>";
      }
      if (c.key === "pace") {
        return '<td><span class="pill ' + (row.paceClass || "") + '">' + escapeHtml(row.paceLabel || "—") + "</span></td>";
      }
      if (c.key === "planAdherencePct") return "<td>" + escapeHtml(row.planAdherenceLabel) + "</td>";
      if (c.key === "townsNotVisited") {
        return "<td>" + escapeHtml(String(row.townsNotVisited ?? "—")) +
          (row.regionTownCount ? " / " + row.regionTownCount : "") + "</td>";
      }
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
  wrap.innerHTML = '<table class="data rank-fit"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table>";
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

function drawMonthComparison(filtered) {
  const wrap = document.getElementById("table-compare");
  const meta = document.getElementById("compare-meta");
  const months = dashCache.visits.map((v) => v.month).sort();
  const last3 = months.slice(-3);
  if (last3.length < 2) {
    meta.textContent = "Upload a second month to compare.";
    wrap.innerHTML = '<p class="empty">Need at least two uploaded months.</p>';
    return;
  }
  meta.textContent = last3.map(monthPretty).join(" · ");
  const byMonth = {};
  last3.forEach((key) => {
    const pack = dashCache.visits.find((v) => v.month === key);
    byMonth[key] = summarizeMonth(key, pack.rows, dashCache.rms, dashCache.territory, dashCache.visits);
  });
  const names = uniqueSorted(filtered.map((s) => s.rmName));
  const metrics = [
    { key: "target", label: "Target", invert: false },
    { key: "achieved", label: "Achieved", invert: false },
    { key: "achievementPct", label: "Ach %", invert: false, pct: true },
    { key: "baseTownDays", label: "Base Town", invert: false },
    { key: "otherTtyDays", label: "Other TTY", invert: false },
    { key: "invalidDays", label: "Incomplete < 2 hrs", invert: true },
    { key: "leaveDays", label: "Leaves", invert: true },
    { key: "holidayDays", label: "Holidays", invert: false },
    { key: "officeworkDays", label: "Office Work", invert: false },
    { key: "meetingDays", label: "Meetings", invert: false },
    { key: "townsNotVisited", label: "Towns not visited", invert: true }
  ];
  function findRm(list, name) {
    return (list || []).find((s) => s.rmName === name);
  }
  function cell(val, pctMode) {
    if (val == null || val === "") return "—";
    if (pctMode) return formatPct(val);
    return String(val);
  }
  function deltaHtml(curr, prev, invert) {
    if (curr == null || prev == null) return "";
    const diff = curr - prev;
    if (diff === 0) return '<span class="delta same">0</span>';
    const up = diff > 0;
    const good = invert ? !up : up;
    const shown = Number.isInteger(diff) ? Math.abs(diff) : Math.abs(round2(diff));
    return '<span class="delta ' + (good ? "up" : "down") + '">' + (up ? "▲" : "▼") + shown + "</span>";
  }
  let html = "";
  names.forEach((name) => {
    html += '<div class="compare-rm"><h3>' + escapeHtml(name) + "</h3>";
    html += '<table class="data rank-fit compare-table"><thead><tr><th>Metric</th>' +
      last3.map((m) => "<th>" + monthPretty(m) + "</th>").join("") +
      "<th>vs prev</th></tr></thead><tbody>";
    metrics.forEach((met) => {
      const vals = last3.map((m) => {
        const rec = findRm(byMonth[m], name);
        return rec ? rec[met.key] : null;
      });
      const tds = vals.map((v) => "<td>" + escapeHtml(cell(v, met.pct)) + "</td>").join("");
      const prev = vals.length >= 2 ? vals[vals.length - 2] : null;
      const curr = vals[vals.length - 1];
      html += "<tr><td>" + escapeHtml(met.label) + "</td>" + tds + "<td>" + deltaHtml(curr, prev, met.invert) + "</td></tr>";
    });
    html += "</tbody></table></div>";
  });
  wrap.innerHTML = html;
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
  const wrap = document.getElementById("table-days");
  if (!summary) {
    meta.textContent = "Pick an RM to see each day.";
    wrap.innerHTML = '<p class="empty">No days to show.</p>';
    return;
  }
  meta.textContent = summary.rmName + " · Data up to " + (summary.dataUpTo || "—") +
    " · " + summary.days.length + " date(s)";
  const rows = summary.days.map((d) => Object.assign({}, d, {
    dailyProdHours: d.dailyProdHours == null ? "" : formatHours(d.dailyProdHours),
    dailyTripHours: d.dailyTripHours == null ? "" : formatHours(d.dailyTripHours),
    dailyTravelHours: d.dailyTravelHours == null ? "" : formatHours(d.dailyTravelHours),
    baseTownDayLabel: d.isValidVisitDay ? (d.baseTownDay ? "Yes" : "No") : "—"
  }));
  const head = DAY_COLS.map((c) => "<th>" + c.label + "</th>").join("");
  const body = rows.map((row) => {
    const tds = DAY_COLS.map((c) => {
      const cls = c.key === "dayType" || c.key === "status" ? dayTypeClass(row.dayType) : "";
      let val = row[c.key];
      if (val == null || val === "") val = "—";
      return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + escapeHtml(val) + "</td>";
    }).join("");
    return '<tr class="' + dayTypeClass(row.dayType) + '">' + tds + "</tr>";
  }).join("");
  const totTrip = round2(summary.days.reduce((s, d) => s + (d.dailyTripHours || 0), 0));
  const totProd = round2(summary.days.reduce((s, d) => s + (d.dailyProdHours || 0), 0));
  const totTravel = round2(summary.days.reduce((s, d) => s + (d.dailyTravelHours || 0), 0));
  const footCells = DAY_COLS.map((c) => {
    if (c.key === "dateISO") return "<td>Totals</td>";
    if (c.key === "status") return "<td>A " + summary.achieved + " · Inv " + summary.invalidDays + " · Miss " + summary.missingDays + "</td>";
    if (c.key === "dailyTripHours") return "<td>" + formatHours(totTrip) + "</td>";
    if (c.key === "dailyProdHours") return "<td>" + formatHours(totProd) + "</td>";
    if (c.key === "dailyTravelHours") return "<td>" + formatHours(totTravel) + "</td>";
    return "<td></td>";
  }).join("");
  wrap.innerHTML = '<table class="data rank-fit day-fit"><thead><tr>' + head +
    "</tr></thead><tbody>" + body + "</tbody><tfoot><tr class=\"totals-row\">" + footCells + "</tr></tfoot></table>";
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

function captureMeta() {
  const sel = document.getElementById("dash-month");
  const month = sel && sel.value ? monthPretty(sel.value) : "";
  const upto = dashCache.dataUpTo || "";
  return (month || "rmVisits") + (upto ? " · Data up to " + formatDmy(upto) : "");
}

function padCapturedCanvas(src, padCss, scale) {
  const pad = Math.round(padCss * scale);
  const out = document.createElement("canvas");
  out.width = src.width + pad * 2;
  out.height = src.height + pad * 2;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#0e1522";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, pad, pad);
  return out;
}

function wireCopyButtons() {
  document.querySelectorAll("#dash-body .card").forEach((card) => {
    if (card.querySelector(".copy-img-btn")) return;
    card.classList.add("has-copy");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-img-btn";
    btn.title = "Copy image for WhatsApp";
    btn.textContent = "Copy image";
    btn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      copyCardImage(card, btn);
    });
    card.appendChild(btn);
  });
}

function exportPng(canvas, title) {
  const fileName = String(title || "rmvisits").replace(/[^\w\-]+/g, "_") + ".png";
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (blob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          resolve("copied");
          return;
        } catch (err) { /* fall through to download */ }
      }
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = fileName;
      link.click();
      resolve("downloaded");
    }, "image/png");
  });
}

function cloneCardForCapture(card) {
  const clone = card.cloneNode(true);
  clone.querySelectorAll(".copy-img-btn").forEach((el) => el.remove());
  const srcCanvas = card.querySelectorAll("canvas");
  const dstCanvas = clone.querySelectorAll("canvas");
  srcCanvas.forEach((src, i) => {
    const dst = dstCanvas[i];
    if (!dst) return;
    dst.width = src.width;
    dst.height = src.height;
    dst.style.width = src.style.width || src.clientWidth + "px";
    dst.style.height = src.style.height || src.clientHeight + "px";
    dst.getContext("2d").drawImage(src, 0, 0);
  });
  clone.classList.add("capturing");
  clone.style.boxShadow = "none";
  clone.style.margin = "0";
  clone.style.position = "static";
  clone.style.transform = "none";
  return clone;
}

async function copyCardImage(card, btn) {
  if (typeof html2canvas !== "function") {
    showToast("Copy tool is missing. Re-open the app folder with libs/html2canvas.min.js.", true);
    return;
  }
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Copying…";
  const wraps = card.querySelectorAll(".table-wrap, .date-grid-scroll, .alert-list");
  wraps.forEach((w) => w.classList.add("capture-expand"));
  const isRmCard = card.classList.contains("rm-report-card");
  const title = card.getAttribute("data-copy-title") ||
    ((card.querySelector("h2") && card.querySelector("h2").textContent) || "rmVisits");
  let banner = null;
  if (!isRmCard) {
    banner = document.createElement("div");
    banner.className = "capture-banner";
    banner.innerHTML = "<strong>" + escapeHtml(title) + "</strong><span>" + escapeHtml(captureMeta()) + "</span>";
    card.insertBefore(banner, card.firstChild);
  }
  card.classList.add("capturing");
  const scale = 2;
  const stage = document.createElement("div");
  stage.className = "copy-stage";
  const clone = cloneCardForCapture(card);
  stage.appendChild(clone);
  document.body.appendChild(stage);
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const raw = await html2canvas(clone, {
      backgroundColor: "#0e1522",
      scale: scale,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0
    });
    const canvas = padCapturedCanvas(raw, 12, scale);
    const how = await exportPng(canvas, title);
    btn.textContent = how === "copied" ? "Copied ✓" : "Downloaded";
    if (how === "downloaded") showToast("Browser blocked clipboard copy, so the PNG was downloaded instead.");
  } catch (err) {
    showToast("Could not copy this block.", true);
    btn.textContent = oldLabel;
  }
  stage.remove();
  if (banner) banner.remove();
  card.classList.remove("capturing");
  wraps.forEach((w) => w.classList.remove("capture-expand"));
  btn.disabled = false;
  setTimeout(() => { btn.textContent = oldLabel; }, 2000);
}

document.getElementById("dash-month").addEventListener("change", drawDashboard);
document.getElementById("filter-zone").addEventListener("change", drawDashboard);
document.getElementById("filter-region").addEventListener("change", drawDashboard);
document.getElementById("filter-rm").addEventListener("change", drawDashboard);
document.getElementById("dash-rm").addEventListener("change", drawDayDetail);
refreshDashboard();
