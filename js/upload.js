function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function sheetRows(buffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

function cell(row, names) {
  const keys = Object.keys(row);
  for (let i = 0; i < names.length; i++) {
    const want = names[i].toLowerCase();
    const found = keys.find((k) => k.trim().toLowerCase() === want);
    if (found) return String(row[found] ?? "").trim();
  }
  return "";
}

function territoryLookup(territoryRec) {
  const regions = new Set();
  const towns = new Set();
  const territories = new Set();
  if (!territoryRec) return { regions, towns, territories };
  territoryRec.rows.forEach((r) => {
    regions.add(norm(r.region));
    towns.add(norm(r.town));
    territories.add(norm(r.territory));
  });
  return { regions, towns, territories };
}

function parseTerritory(rawRows) {
  return rawRows.map((raw, index) => {
    const zone = cell(raw, ["Zone"]);
    const region = cell(raw, ["Region"]);
    const territory = cell(raw, ["Territory"]);
    const town = cell(raw, ["Town"]);
    const errors = {};
    if (!zone) errors.zone = "Missing zone";
    if (!region) errors.region = "Missing region";
    if (!territory) errors.territory = "Missing territory";
    if (!town) errors.town = "Missing town";
    return { zone, region, territory, town, errors, rowNum: index + 2 };
  });
}

function parseRmMaster(rawRows, lookup) {
  return rawRows.map((raw, index) => {
    const month = cell(raw, ["Month"]);
    const region = cell(raw, ["Region"]);
    const rmName = cell(raw, ["RM Name", "RMName", "Manager Name"]);
    const baseTown = cell(raw, ["Base Town", "BaseTown"]);
    const targetRaw = cell(raw, ["Target Visits", "TargetVisits", "Target"]);
    const errors = {};
    if (!month) errors.month = "Missing month";
    if (!region) errors.region = "Missing region";
    if (!rmName) errors.rmName = "Missing RM name";
    if (!baseTown) errors.baseTown = "Missing base town";
    const targetVisits = Number(targetRaw);
    if (targetRaw === "" || Number.isNaN(targetVisits) || targetVisits < 0) {
      errors.targetVisits = "Target must be a number";
    }
    if (lookup.regions.size) {
      if (region && !lookup.regions.has(norm(region))) errors.region = "Unknown region";
      if (baseTown && !lookup.towns.has(norm(baseTown))) errors.baseTown = "Unknown town";
    }
    return {
      month,
      region,
      rmName,
      baseTown,
      targetVisits: Number.isNaN(targetVisits) ? targetRaw : targetVisits,
      errors,
      rowNum: index + 2
    };
  });
}

function errorCount(rows) {
  return rows.filter((r) => Object.keys(r.errors).length).length;
}

function previewTableHtml(columns, rows) {
  const head = columns.map((c) => "<th>" + c.label + "</th>").join("");
  const body = rows.map((row) => {
    const bad = Object.keys(row.errors).length > 0;
    const tds = columns.map((c) => {
      const cls = row.errors[c.key] ? ' class="cell-error"' : "";
      const title = row.errors[c.key] ? ' title="' + escapeHtml(row.errors[c.key]) + '"' : "";
      return "<td" + cls + title + ">" + escapeHtml(row[c.key] ?? "") + "</td>";
    }).join("");
    return '<tr class="' + (bad ? "row-error" : "") + '">' + tds + "</tr>";
  }).join("");
  const wide = columns.length > 6 ? " data-wide" : "";
  return '<div class="table-wrap"><table class="data' + wide + '"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
}

function showPreview(containerId, title, columns, rows, onSave, extraHtml) {
  const el = document.getElementById(containerId);
  const bad = errorCount(rows);
  const ok = rows.length - bad;
  el.hidden = false;
  el.innerHTML =
    '<div class="preview-bar">' +
      "<div>" +
        "<strong>" + title + "</strong> · " + rows.length + " rows " +
        '<span class="badge badge-ok">' + ok + " ok</span> " +
        (bad ? '<span class="badge badge-bad">' + bad + " with issues</span>" : "") +
      "</div>" +
      '<button type="button" class="btn btn-primary save-btn">Save</button>' +
    "</div>" +
    (extraHtml || "") +
    previewTableHtml(columns, rows);
  el.querySelector(".save-btn").addEventListener("click", onSave);
}

const TERRITORY_COLS = [
  { key: "zone", label: "Zone" },
  { key: "region", label: "Region" },
  { key: "territory", label: "Territory" },
  { key: "town", label: "Town" }
];

const RM_COLS = [
  { key: "month", label: "Month" },
  { key: "region", label: "Region" },
  { key: "rmName", label: "RM Name" },
  { key: "baseTown", label: "Base Town" },
  { key: "targetVisits", label: "Target Visits" }
];

let pendingTerritory = [];
let pendingRm = [];

document.getElementById("file-territory").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById("name-territory").textContent = file.name;
  try {
    const rows = parseTerritory(sheetRows(await readFileAsArrayBuffer(file)));
    pendingTerritory = rows;
    if (!rows.length) {
      showToast("That file has no data rows.", true);
      return;
    }
    showPreview("preview-territory", "Territory preview", TERRITORY_COLS, rows, saveTerritoryFromPreview);
  } catch (err) {
    showToast("Could not read that Excel file.", true);
  }
});

document.getElementById("file-rm").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById("name-rm").textContent = file.name;
  try {
    const lookup = territoryLookup(await getTerritory());
    const rows = parseRmMaster(sheetRows(await readFileAsArrayBuffer(file)), lookup);
    pendingRm = rows;
    if (!rows.length) {
      showToast("That file has no data rows.", true);
      return;
    }
    showPreview("preview-rm", "RM master preview", RM_COLS, rows, saveRmFromPreview);
  } catch (err) {
    showToast("Could not read that Excel file.", true);
  }
});

async function saveTerritoryFromPreview() {
  const existing = await getTerritory();
  let body = "Save " + pendingTerritory.length + " town rows as the territory structure?";
  if (existing && existing.rows.length) {
    body = "This will replace the current territory structure (" + existing.rows.length + " towns) with " + pendingTerritory.length + " rows.";
  }
  if (errorCount(pendingTerritory)) {
    body += " Some rows have missing values (highlighted in red).";
  }
  const ok = await confirmModal("Save territory structure", body, "Save");
  if (!ok) return;
  const clean = pendingTerritory.map(({ errors, rowNum, ...row }) => row);
  await saveTerritory(clean);
  showToast("Territory structure saved.");
}

async function saveRmFromPreview() {
  const byMonth = {};
  pendingRm.forEach((row) => {
    const m = String(row.month || "").trim() || "(blank)";
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(row);
  });
  const months = Object.keys(byMonth);
  const existingMonths = [];
  for (const m of months) {
    if (m === "(blank)") continue;
    if (await getRmMonth(m)) existingMonths.push(m);
  }
  let body = "Save RM master for month(s): " + months.join(", ") + ".";
  if (existingMonths.length) {
    body += " This will replace data already saved for month(s) " + existingMonths.join(", ") + ".";
  }
  if (errorCount(pendingRm)) {
    body += " Some rows have missing or invalid values (highlighted in red).";
  }
  const ok = await confirmModal("Save RM master", body, "Save");
  if (!ok) return;
  for (const m of months) {
    if (m === "(blank)") continue;
    const clean = byMonth[m].map(({ errors, rowNum, ...row }) => row);
    await saveRmMonth(m, clean);
  }
  showToast("RM master saved.");
}

function headerKey(value) {
  return String(value || "").replace(/\./g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

const VISIT_HEADER_MAP = {
  region: ["region"],
  managerName: ["manager name", "rm name", "rmname", "managername"],
  date: ["date"],
  day: ["day"],
  territory: ["territory"],
  plannedTown: ["planned town", "plannedtown"],
  trackerPresence: ["tracker presence", "trackerpresence"],
  tripStart: ["trip start time", "trip start"],
  tripEnd: ["trip end time", "trip end"],
  totalTrip: ["total trip time", "total trip"],
  prodStart: ["prod start time", "productive start time"],
  prodEnd: ["prod end time", "productive end time"],
  totalProd: ["total prod time", "total productive time"],
  travelTime: ["travel time"],
  status: ["status"],
  remarks: ["remarks", "remark"]
};

const VISIT_IGNORED = { day: true, totalTrip: true, totalProd: true, travelTime: true };

function canonicalVisitHeader(label) {
  const key = headerKey(label);
  if (!key) return null;
  const names = Object.keys(VISIT_HEADER_MAP);
  for (let i = 0; i < names.length; i++) {
    if (VISIT_HEADER_MAP[names[i]].indexOf(key) >= 0) return names[i];
  }
  return null;
}

function findVisitHeaderRow(matrix) {
  let best = { index: -1, score: 0, map: {} };
  matrix.forEach((row, idx) => {
    const map = {};
    (row || []).forEach((cell, col) => {
      const canon = canonicalVisitHeader(cell);
      if (canon && map[canon] == null) map[canon] = col;
    });
    const needed = ["region", "managerName", "date", "status"];
    const score = needed.filter((k) => map[k] != null).length + Object.keys(map).length / 20;
    if (needed.every((k) => map[k] != null) && score > best.score) {
      best = { index: idx, score: score, map: map };
    }
  });
  return best.index >= 0 ? best : null;
}

function isEmptyVisitRow(values) {
  return values.every((v) => String(v == null ? "" : v).trim() === "");
}

function isTotalVisitRow(values) {
  return values.some((v) => headerKey(v) === "total");
}

function parseExcelDate(value) {
  if (value === "" || value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      y: value.getFullYear(),
      m: value.getMonth() + 1,
      d: value.getDate(),
      iso: isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate()),
      label: formatDateLabel(value.getFullYear(), value.getMonth() + 1, value.getDate())
    };
  }
  if (typeof value === "number" && XLSX.SSF && XLSX.SSF.parse_date_code) {
    const p = XLSX.SSF.parse_date_code(value);
    if (p && p.y) {
      return {
        y: p.y,
        m: p.m,
        d: p.d,
        iso: isoDate(p.y, p.m, p.d),
        label: formatDateLabel(p.y, p.m, p.d)
      };
    }
  }
  const text = String(value).trim();
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  let m = text.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/);
  if (m && months[m[2].slice(0, 3).toLowerCase()]) {
    const mo = months[m[2].slice(0, 3).toLowerCase()];
    return { y: Number(m[3]), m: mo, d: Number(m[1]), iso: isoDate(m[3], mo, m[1]), label: formatDateLabel(m[3], mo, m[1]) };
  }
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), iso: isoDate(m[1], m[2], m[3]), label: formatDateLabel(m[1], m[2], m[3]) };
  }
  const dt = new Date(text);
  if (!Number.isNaN(dt.getTime())) {
    return {
      y: dt.getFullYear(),
      m: dt.getMonth() + 1,
      d: dt.getDate(),
      iso: isoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()),
      label: formatDateLabel(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
    };
  }
  return null;
}

function isoDate(y, m, d) {
  return String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function formatDateLabel(y, m, d) {
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return String(d).padStart(2, "0") + "-" + names[m - 1] + "-" + y;
}

function parseExcelTime(value) {
  if (value === "" || value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const fraction = value % 1;
    if (value >= 1 && XLSX.SSF && XLSX.SSF.parse_date_code) {
      const p = XLSX.SSF.parse_date_code(value);
      if (p) return (p.H || 0) * 60 + (p.M || 0) + (p.S || 0) / 60;
    }
    return fraction * 24 * 60;
  }
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || 0) / 60;
}

function colValue(row, map, key) {
  if (map[key] == null) return "";
  const v = row[map[key]];
  return v == null ? "" : v;
}

function parseVisitSheet(matrix, rmRows, lookup) {
  const found = findVisitHeaderRow(matrix);
  if (!found) {
    return { error: "Could not find a header row with Region, Manager Name, Date and Status." };
  }
  const rows = [];
  for (let r = found.index + 1; r < matrix.length; r++) {
    const raw = matrix[r] || [];
    const values = Object.keys(found.map).filter((k) => !VISIT_IGNORED[k]).map((k) => colValue(raw, found.map, k));
    if (isEmptyVisitRow(values)) continue;
    if (isTotalVisitRow(raw)) continue;

    const region = String(colValue(raw, found.map, "region")).trim();
    const managerName = collapseSpaces(colValue(raw, found.map, "managerName"));
    const dateParsed = parseExcelDate(colValue(raw, found.map, "date"));
    const territory = String(colValue(raw, found.map, "territory")).trim();
    const plannedTown = String(colValue(raw, found.map, "plannedTown")).trim();
    const trackerPresence = String(colValue(raw, found.map, "trackerPresence")).trim();
    const tripStartMin = parseExcelTime(colValue(raw, found.map, "tripStart"));
    const tripEndMin = parseExcelTime(colValue(raw, found.map, "tripEnd"));
    const prodStartMin = parseExcelTime(colValue(raw, found.map, "prodStart"));
    const prodEndMin = parseExcelTime(colValue(raw, found.map, "prodEnd"));
    const status = collapseSpaces(colValue(raw, found.map, "status"));
    const remarks = String(colValue(raw, found.map, "remarks") ?? "").trim();

    const matched = matchRmName(managerName, rmRows);
    const st = statusKey(status);
    const visit = st === STATUS_VISIT;
    const allowed = [STATUS_VISIT, STATUS_LEAVE, STATUS_MEETING, STATUS_OFFICE, STATUS_TRANSIT];
    const errors = {};

    if (!region) errors.region = "Missing region";
    else if (lookup.regions.size && !lookup.regions.has(norm(region))) errors.region = "Unknown region";

    if (!managerName) errors.managerName = "Missing RM name";
    else if (!matched) errors.managerName = "Unmatched RM name";

    if (!dateParsed) errors.dateLabel = "Missing or invalid date";

    if (!status) errors.status = "Missing status";
    else if (allowed.indexOf(st) < 0) errors.status = "Unknown status";

    if (visit) {
      if (!territory) errors.territory = "Missing territory";
      else if (lookup.territories.size && !lookup.territories.has(norm(territory))) errors.territory = "Unknown territory";
      if (!plannedTown) errors.plannedTown = "Missing planned town";
      else if (lookup.towns.size && !lookup.towns.has(norm(plannedTown))) errors.plannedTown = "Unknown town";
      if (!trackerPresence) errors.trackerPresence = "Missing tracker town";
      else if (lookup.towns.size && !lookup.towns.has(norm(trackerPresence))) errors.trackerPresence = "Unknown town";
      if (tripStartMin == null) errors.tripStartLabel = "Missing trip start";
      if (tripEndMin == null) errors.tripEndLabel = "Missing trip end";
      if (tripStartMin != null && tripEndMin != null && tripEndMin < tripStartMin) {
        errors.tripEndLabel = "End time is before start";
      }
      if (prodStartMin == null) errors.prodStartLabel = "Missing prod start";
      if (prodEndMin == null) errors.prodEndLabel = "Missing prod end";
      if (prodStartMin != null && prodEndMin != null && prodEndMin < prodStartMin) {
        errors.prodEndLabel = "End time is before start";
      }
    }

    const monthKey = dateParsed ? dateParsed.y + "-" + String(dateParsed.m).padStart(2, "0") : "";
    rows.push({
      region,
      managerName,
      matchedRmName: matched ? matched.rmName : "",
      dateISO: dateParsed ? dateParsed.iso : "",
      dateLabel: dateParsed ? dateParsed.label : String(colValue(raw, found.map, "date") || ""),
      monthKey,
      territory,
      plannedTown,
      trackerPresence,
      tripStartMin,
      tripEndMin,
      prodStartMin,
      prodEndMin,
      tripStartLabel: formatMinutesAsTime(tripStartMin),
      tripEndLabel: formatMinutesAsTime(tripEndMin),
      prodStartLabel: formatMinutesAsTime(prodStartMin),
      prodEndLabel: formatMinutesAsTime(prodEndMin),
      status,
      remarks,
      errors,
      rowNum: r + 1
    });
  }
  return { headerRow: found.index + 1, rows };
}

const VISIT_COLS = [
  { key: "region", label: "Region" },
  { key: "managerName", label: "Manager Name" },
  { key: "matchedRmName", label: "Matched RM" },
  { key: "dateLabel", label: "Date" },
  { key: "territory", label: "Territory" },
  { key: "plannedTown", label: "Planned Town" },
  { key: "trackerPresence", label: "Tracker Presence" },
  { key: "tripStartLabel", label: "Trip Start" },
  { key: "tripEndLabel", label: "Trip End" },
  { key: "prodStartLabel", label: "Prod Start" },
  { key: "prodEndLabel", label: "Prod End" },
  { key: "status", label: "Status" },
  { key: "remarks", label: "Remarks" }
];

let pendingVisitFile = null;
let pendingVisitWb = null;
let pendingVisit = [];

function visitWorkbookFromBuffer(buffer) {
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

function sheetMatrix(wb, name) {
  const sheet = wb.Sheets[name];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
}

function fillSheetSelect(names, selected) {
  const sel = document.getElementById("visit-sheet");
  const wrap = document.getElementById("visit-sheet-wrap");
  if (!names || names.length <= 1) {
    wrap.hidden = true;
    sel.innerHTML = "";
    return names && names[0] ? names[0] : "";
  }
  wrap.hidden = false;
  sel.innerHTML = names.map((n) => {
    const pick = n === selected ? " selected" : "";
    return "<option" + pick + ">" + escapeHtml(n) + "</option>";
  }).join("");
  return selected && names.indexOf(selected) >= 0 ? selected : names[0];
}

async function parseSelectedVisitSheet(sheetName) {
  const lookup = territoryLookup(await getTerritory());
  const rmPacks = await getAllRmMaster();
  const rmRows = [];
  rmPacks.forEach((p) => p.rows.forEach((r) => rmRows.push(r)));
  const matrix = sheetMatrix(pendingVisitWb, sheetName);
  const parsed = parseVisitSheet(matrix, rmRows, lookup);
  if (parsed.error) {
    pendingVisit = [];
    document.getElementById("preview-visits").hidden = false;
    document.getElementById("preview-visits").innerHTML = '<p class="empty">' + escapeHtml(parsed.error) + "</p>";
    return;
  }
  pendingVisit = parsed.rows;
  const unmatched = uniqueSorted(parsed.rows.filter((r) => r.errors.managerName === "Unmatched RM name").map((r) => r.managerName));
  let extra = '<p class="muted tiny">Header found on row ' + parsed.headerRow + ". Day and file time totals are ignored and recalculated later.</p>";
  if (unmatched.length) {
    extra += '<div class="unmatched">Unmatched RM names (fix spelling in Excel or RM master): <strong>' +
      unmatched.map(escapeHtml).join(", ") + "</strong></div>";
  }
  showPreview("preview-visits", "Visit log preview", VISIT_COLS, parsed.rows, saveVisitsFromPreview, extra);
}

document.getElementById("file-visits").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById("name-visits").textContent = file.name;
  try {
    pendingVisitFile = file;
    pendingVisitWb = visitWorkbookFromBuffer(await readFileAsArrayBuffer(file));
    const sheet = fillSheetSelect(pendingVisitWb.SheetNames, pendingVisitWb.SheetNames[0]);
    await parseSelectedVisitSheet(sheet);
  } catch (err) {
    showToast("Could not read that Excel file.", true);
  }
});

document.getElementById("visit-sheet").addEventListener("change", async (e) => {
  if (!pendingVisitWb) return;
  await parseSelectedVisitSheet(e.target.value);
});

async function saveVisitsFromPreview() {
  const byMonth = {};
  pendingVisit.forEach((row) => {
    if (!row.monthKey) return;
    if (!byMonth[row.monthKey]) byMonth[row.monthKey] = [];
    byMonth[row.monthKey].push(row);
  });
  const months = Object.keys(byMonth);
  if (!months.length) {
    showToast("No rows with a valid date to save.", true);
    return;
  }
  const existingMonths = [];
  for (const m of months) {
    if (await getVisitMonth(m)) existingMonths.push(m);
  }
  let body = "Save visit log for " + months.join(", ") + " (" + pendingVisit.length + " rows).";
  if (existingMonths.length) {
    body += " This will replace visit data already saved for " + existingMonths.join(", ") + ".";
  }
  if (errorCount(pendingVisit)) {
    body += " Some rows have issues (highlighted in red). Unmatched names will not count toward an RM’s target until you fix them.";
  }
  const ok = await confirmModal("Save visit log", body, "Save");
  if (!ok) return;
  for (const m of months) {
    const clean = byMonth[m].map(({ errors, rowNum, ...row }) => row);
    await saveVisitMonth(m, clean);
  }
  showToast("Visit log saved.");
  if (typeof refreshDashboard === "function") refreshDashboard();
}
