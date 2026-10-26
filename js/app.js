const pages = ["dashboard", "entry", "uploads", "master", "reports", "sop"];

function showToast(message, isError) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", !!isError);
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, 3500);
}

function confirmModal(title, body, okLabel) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal");
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").textContent = body;
    document.getElementById("modal-ok").textContent = okLabel || "Save";
    modal.hidden = false;

    function finish(ok) {
      modal.hidden = true;
      document.getElementById("modal-ok").onclick = null;
      document.getElementById("modal-cancel").onclick = null;
      resolve(ok);
    }
    document.getElementById("modal-ok").onclick = () => finish(true);
    document.getElementById("modal-cancel").onclick = () => finish(false);
  });
}

function setPage(name) {
  if (!pages.includes(name)) name = "dashboard";
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === name);
  });
  if (name === "master") refreshMasterData();
  if (name === "dashboard" && typeof refreshDashboard === "function") refreshDashboard();
  if (name === "reports" && typeof refreshReports === "function") refreshReports();
  if (name === "entry" && typeof refreshEntry === "function") refreshEntry();
  if (name === "sop" && typeof renderSopPage === "function") renderSopPage();
}

function onHashChange() {
  const name = (location.hash || "#dashboard").replace("#", "");
  setPage(name);
}

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function matchesSearch(row, query) {
  if (!query) return true;
  const q = norm(query);
  return Object.values(row).some((v) => String(v).toLowerCase().includes(q));
}

function renderTable(container, columns, rows, emptyText) {
  if (!rows || !rows.length) {
    container.innerHTML = '<p class="empty">' + emptyText + "</p>";
    return;
  }
  const thead = "<thead><tr>" + columns.map((c) => "<th>" + c.label + "</th>").join("") + "</tr></thead>";
  const body = rows.map((row) => {
    const tds = columns.map((c) => "<td>" + escapeHtml(row[c.key] ?? "") + "</td>").join("");
    return "<tr>" + tds + "</tr>";
  }).join("");
  container.innerHTML = '<table class="data">' + thead + "<tbody>" + body + "</tbody></table>";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let masterCache = { territory: null, rms: [] };

async function refreshMasterData() {
  masterCache.territory = await getTerritory();
  masterCache.rms = await getAllRmMaster();
  drawTerritoryTable();
  drawRmControls();
  drawRmTable();
}

function drawTerritoryTable() {
  const rec = masterCache.territory;
  const meta = document.getElementById("territory-meta");
  const q = document.getElementById("search-territory").value;
  if (!rec || !rec.rows.length) {
    meta.textContent = "No territory data saved yet.";
    renderTable(document.getElementById("table-territory"), [], [], "Upload a territory file on the Uploads page.");
    return;
  }
  meta.textContent = rec.rows.length + " towns · saved " + formatWhen(rec.savedAt);
  const rows = rec.rows.filter((r) => matchesSearch(r, q));
  renderTable(
    document.getElementById("table-territory"),
    [
      { key: "zone", label: "Zone" },
      { key: "region", label: "Region" },
      { key: "territory", label: "Territory" },
      { key: "town", label: "Town" }
    ],
    rows,
    "No matching rows."
  );
}

function drawRmControls() {
  const sel = document.getElementById("rm-month-filter");
  const months = masterCache.rms.map((r) => r.month);
  if (!months.length) {
    sel.hidden = true;
    sel.innerHTML = "";
    return;
  }
  const prev = sel.value;
  sel.hidden = false;
  sel.innerHTML = '<option value="all">All months</option>' +
    months.map((m) => '<option value="' + m + '">Month ' + m + "</option>").join("");
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function drawRmTable() {
  const meta = document.getElementById("rm-meta");
  const month = document.getElementById("rm-month-filter").value || "all";
  const q = document.getElementById("search-rm").value;
  let rows = [];
  masterCache.rms.forEach((pack) => {
    pack.rows.forEach((row) => rows.push(row));
  });
  if (!rows.length) {
    meta.textContent = "No RM master saved yet.";
    renderTable(document.getElementById("table-rm"), [], [], "Upload an RM master file on the Uploads page.");
    return;
  }
  if (month && month !== "all") rows = rows.filter((r) => String(r.month) === String(month));
  rows = rows.filter((r) => matchesSearch(r, q));
  const nMonths = masterCache.rms.length;
  meta.textContent = rows.length + " RM rows shown · " + nMonths + " month(s) saved";
  renderTable(
    document.getElementById("table-rm"),
    [
      { key: "month", label: "Month" },
      { key: "region", label: "Region" },
      { key: "rmName", label: "RM Name" },
      { key: "baseTown", label: "Base Town" },
      { key: "targetVisits", label: "Target" }
    ],
    rows,
    "No matching rows."
  );
}

document.getElementById("search-territory").addEventListener("input", drawTerritoryTable);
document.getElementById("search-rm").addEventListener("input", drawRmTable);
document.getElementById("rm-month-filter").addEventListener("change", drawRmTable);

document.getElementById("clear-data-btn").addEventListener("click", async () => {
  const ok = await confirmModal(
    "Clear all data?",
    "This removes the territory structure, RM master, visit logs, and data-entry drafts saved in this browser. It cannot be undone.",
    "Clear data"
  );
  if (!ok) return;
  await clearAllData();
  await refreshMasterData();
  if (typeof refreshDashboard === "function") await refreshDashboard();
  if (typeof refreshEntry === "function") await refreshEntry();
  showToast("All saved data was cleared.");
});

window.addEventListener("hashchange", onHashChange);
onHashChange();
