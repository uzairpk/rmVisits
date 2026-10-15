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
  if (!territoryRec) return { regions, towns };
  territoryRec.rows.forEach((r) => {
    regions.add(norm(r.region));
    towns.add(norm(r.town));
  });
  return { regions, towns };
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
  return '<div class="table-wrap"><table class="data"><thead><tr>' + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
}

function showPreview(containerId, title, columns, rows, onSave) {
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
