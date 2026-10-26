/* Data Entry draft (section 5.8). Never written into dashboard visit logs. */

const ENTRY_DAY_TYPES = {
  field: "Field day",
  leave: "Leave",
  holiday: "Holiday",
  meeting: "Full-day Meeting",
  office: "Full-day Office Work"
};

const ENTRY_STATUSES = ["Market Visit", "Transit", "Meeting", "Office Work"];

let entryState = {
  month: "",
  days: [],
  territory: [],
  rms: [],
  visits: [],
  editingId: null,
  lineSeq: 1
};

function entryUid() {
  return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseHHMM(value) {
  if (value == null || value === "") return null;
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function hhmmFromInput(value) {
  const m = parseHHMM(value);
  return m == null ? "" : formatMinutesAsTime(m);
}

function rmMonthKey(packMonth, fallbackYear) {
  const m = String(packMonth || "");
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  if (/^\d{1,2}$/.test(m)) {
    const y = fallbackYear || new Date().getFullYear();
    return y + "-" + String(Number(m)).padStart(2, "0");
  }
  return m;
}

function rmsForMonth(monthKey) {
  const want = monthNumberFromKey(monthKey);
  const packs = entryState.rms.filter((p) =>
    String(p.month) === want || String(p.month) === String(monthKey)
  );
  const rows = [];
  packs.forEach((p) => (p.rows || []).forEach((r) => rows.push(r)));
  const seen = {};
  return rows.filter((r) => {
    const k = collapseSpaces(r.rmName).toLowerCase();
    if (!k || seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function findRm(name) {
  return rmsForMonth(entryState.month).find((r) => namesLikelySame(r.rmName, name)) || null;
}

function townRecord(name) {
  const want = collapseSpaces(name).toLowerCase();
  if (!want) return null;
  return (entryState.territory || []).find((t) => collapseSpaces(t.town).toLowerCase() === want) || null;
}

function townsForRm(rm, allRegions) {
  const list = entryState.territory || [];
  if (!rm || allRegions) return list.slice();
  const region = collapseSpaces(rm.region).toLowerCase();
  const regional = list.filter((t) => collapseSpaces(t.region).toLowerCase() === region);
  return regional.length ? regional : list.slice();
}

function statusExport(label) {
  if (label === "Office Work") return "Officework";
  return label;
}

function dayTypeStatus(type) {
  if (type === "leave") return "Leave";
  if (type === "holiday") return "Holiday";
  if (type === "meeting") return "Meeting";
  if (type === "office") return "Officework";
  return "Market Visit";
}

function datesBetween(fromISO, toISO) {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO || fromISO);
  if (!a || !b) return [];
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  const out = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(isoDate(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function excelSerialDate(iso) {
  const p = String(iso || "").split("-");
  if (p.length !== 3) return null;
  const utc = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return (utc - Date.UTC(1899, 11, 30)) / 86400000;
}

function excelTimeFrac(hhmm) {
  const mins = parseHHMM(hhmm);
  if (mins == null) return null;
  return mins / (24 * 60);
}

function hoursFromRange(start, end) {
  return hoursBetween(parseHHMM(start), parseHHMM(end));
}

function emptyActivity() {
  return {
    id: "l" + (entryState.lineSeq++),
    status: "Market Visit",
    town: "",
    plannedTown: "",
    prodStart: "",
    prodEnd: "",
    remarks: ""
  };
}

function draftToVisitRows(day, rm) {
  if (day.dayType !== "field") {
    return [{
      region: rm ? rm.region : "",
      managerName: rm ? rm.rmName : day.rmName,
      matchedRmName: rm ? rm.rmName : day.rmName,
      dateISO: day.dateISO,
      status: dayTypeStatus(day.dayType),
      remarks: day.remarks || "",
      territory: "",
      plannedTown: "",
      trackerPresence: "",
      tripStartMin: null,
      tripEndMin: null,
      prodStartMin: null,
      prodEndMin: null,
      kms: null
    }];
  }
  return (day.activities || []).map((a, i) => {
    const rec = townRecord(a.town);
    const visit = a.status === "Market Visit";
    return {
      region: rm ? rm.region : "",
      managerName: rm ? rm.rmName : day.rmName,
      matchedRmName: rm ? rm.rmName : day.rmName,
      dateISO: day.dateISO,
      status: statusExport(a.status),
      remarks: a.remarks || "",
      territory: rec ? rec.territory : "",
      plannedTown: visit ? (a.plannedTown || a.town) : (a.town || ""),
      trackerPresence: a.town || "",
      tripStartMin: parseHHMM(day.tripStart),
      tripEndMin: parseHHMM(day.tripEnd),
      prodStartMin: visit ? parseHHMM(a.prodStart) : null,
      prodEndMin: visit ? parseHHMM(a.prodEnd) : null,
      kms: i === 0 && day.kms !== "" && day.kms != null ? Number(day.kms) : null
    };
  });
}

function summarizeDraftDay(day) {
  const rm = findRm(day.rmName);
  const rows = draftToVisitRows(day, rm);
  const rec = buildDayRecord(day.rmName, day.dateISO, rows, rm, entryState.territory);
  return rec;
}

function activitySummary(day) {
  if (day.dayType !== "field") return day.remarks || ENTRY_DAY_TYPES[day.dayType];
  return (day.activities || []).map((a) => {
    const town = a.town ? " " + a.town : "";
    const note = a.remarks ? " (“" + a.remarks + "”)" : "";
    return a.status + town + note;
  }).join(" · ") || "No activities";
}

function dateAlreadyEntered(rmName, dateISO) {
  const inDraft = entryState.days.some((d) => namesLikelySame(d.rmName, rmName) && d.dateISO === dateISO);
  return inDraft || uploadedHasDay(rmName, dateISO);
}

function nextEmptyDate(rmName) {
  const dates = datesInMonth(entryState.month, true);
  return dates.find((iso) => !dateAlreadyEntered(rmName, iso)) || dates[dates.length - 1] || "";
}

function uploadedHasDay(rmName, dateISO) {
  return (entryState.visits || []).some((pack) => (pack.rows || []).some((r) =>
    r.dateISO === dateISO && namesLikelySame(r.matchedRmName || r.managerName, rmName)
  ));
}

function collectPopupDay() {
  const rmName = document.getElementById("entry-rm").value;
  const dateISO = document.getElementById("entry-date").value;
  const dayType = document.getElementById("entry-day-type").value;
  const toDate = document.getElementById("entry-to-date").value;
  const remarks = collapseSpaces(document.getElementById("entry-remarks").value);
  const tripStart = hhmmFromInput(document.getElementById("entry-trip-start").value);
  const tripEnd = hhmmFromInput(document.getElementById("entry-trip-end").value);
  const kmsRaw = document.getElementById("entry-kms").value;
  const kms = kmsRaw === "" ? null : Number(kmsRaw);
  const activities = [];
  document.querySelectorAll("#entry-lines .entry-line").forEach((el) => {
    activities.push({
      id: el.dataset.id,
      status: el.querySelector(".act-status").value,
      town: collapseSpaces(el.querySelector(".act-town").value),
      plannedTown: collapseSpaces(el.querySelector(".act-planned").value),
      prodStart: hhmmFromInput(el.querySelector(".act-prod-start").value),
      prodEnd: hhmmFromInput(el.querySelector(".act-prod-end").value),
      remarks: collapseSpaces(el.querySelector(".act-remarks").value)
    });
  });
  return {
    id: entryState.editingId || entryUid(),
    rmName,
    dateISO,
    toDate,
    dayType,
    tripStart,
    tripEnd,
    kms: Number.isFinite(kms) ? kms : null,
    remarks,
    activities,
    exported: false
  };
}

function validatePopup(day) {
  const errors = [];
  if (!day.rmName) errors.push("Pick an RM.");
  if (!day.dateISO) errors.push("Pick a date.");
  if (!day.dayType) errors.push("Pick a day type.");
  if (day.dayType !== "field") return errors;
  if (!day.tripStart || !day.tripEnd) errors.push("Field day needs Trip Start and Trip End.");
  else if (parseHHMM(day.tripEnd) < parseHHMM(day.tripStart)) errors.push("Trip End is before Trip Start.");
  if (!day.activities.length) errors.push("Add at least one activity line.");
  const visits = [];
  day.activities.forEach((a, i) => {
    const n = i + 1;
    if (a.status === "Market Visit") {
      if (!a.town) errors.push("Market Visit line " + n + " needs a town.");
      else if ((entryState.territory || []).length && !townRecord(a.town)) {
        errors.push("Market Visit line " + n + " town is not in the territory structure.");
      }
      if (!a.prodStart || !a.prodEnd) errors.push("Market Visit line " + n + " needs Prod Start and Prod End.");
      else if (parseHHMM(a.prodEnd) < parseHHMM(a.prodStart)) errors.push("Prod End is before Prod Start on line " + n + ".");
      else {
        const ps = parseHHMM(a.prodStart);
        const pe = parseHHMM(a.prodEnd);
        const ts = parseHHMM(day.tripStart);
        const te = parseHHMM(day.tripEnd);
        if (ts != null && te != null && (ps < ts || pe > te)) {
          errors.push("Market Visit line " + n + " is outside Trip Start–End.");
        }
        visits.push({ n: n, start: ps, end: pe });
      }
    }
  });
  visits.forEach((a, i) => {
    visits.slice(i + 1).forEach((b) => {
      if (a.start < b.end && b.start < a.end) {
        errors.push("Market Visit lines " + a.n + " and " + b.n + " overlap.");
      }
    });
  });
  return errors;
}

function updateEntrySummary() {
  const box = document.getElementById("entry-summary");
  const day = collectPopupDay();
  if (day.dayType !== "field") {
    box.className = "entry-summary note";
    box.textContent = ENTRY_DAY_TYPES[day.dayType] + (day.remarks ? " · " + day.remarks : "");
    return;
  }
  const hasTrip = !!(day.tripStart && day.tripEnd);
  const hasMvProd = (day.activities || []).some((a) =>
    a.status === "Market Visit" && a.prodStart && a.prodEnd
  );
  if (!hasTrip || !hasMvProd) {
    box.className = "entry-summary note";
    box.textContent = "Enter trip and prod times to see result";
    return;
  }
  const rec = summarizeDraftDay(day);
  const tags = [];
  if (rec.isInvalid) {
    const reason = String(rec.invalidReason || "");
    if (/No town/i.test(reason)) tags.push("No town ≥ 2h");
    if (/Total under/i.test(reason) || /Total </i.test(reason)) tags.push("Total < 5h");
  }
  const text = "Total " + formatHours(rec.dailyTotalHours) + " hrs · Prod " + formatHours(rec.dailyProdHours) +
    " · " + rec.townCount + " town" + (rec.townCount === 1 ? "" : "s") + " counted · " +
    (rec.isValid ? "✅ Valid" : "❌ Invalid" + (tags.length ? " – " + tags.join(" / ") : ""));
  box.className = "entry-summary " + (rec.isValid ? "ok" : "bad");
  box.textContent = text;
}

function closeTownMenus() {
  document.querySelectorAll(".town-menu").forEach((el) => { el.hidden = true; });
}

function renderTownMenu(input, menu) {
  const rm = findRm(document.getElementById("entry-rm").value);
  const all = document.getElementById("entry-all-regions").checked;
  const q = collapseSpaces(input.value).toLowerCase();
  let list = townsForRm(rm, all);
  if (q) list = list.filter((t) => collapseSpaces(t.town).toLowerCase().indexOf(q) >= 0);
  list = list.slice(0, 40);
  if (!list.length) {
    menu.innerHTML = '<div class="town-opt">No matching town</div>';
    menu.hidden = false;
    return;
  }
  menu.innerHTML = list.map((t, i) =>
    '<button type="button" class="town-opt' + (i === 0 ? " active" : "") + '" data-town="' + escapeHtml(t.town) + '">' +
    escapeHtml(t.town) + '<span class="sub">' + escapeHtml(t.territory) + " · " + escapeHtml(t.region) + "</span></button>"
  ).join("");
  menu.hidden = false;
}

function pickTown(line, town) {
  const rec = townRecord(town);
  const townInput = line.querySelector(".act-town");
  const planned = line.querySelector(".act-planned");
  const prev = townInput.value;
  townInput.value = rec ? rec.town : town;
  if (!planned.value || collapseSpaces(planned.value).toLowerCase() === collapseSpaces(prev).toLowerCase()) {
    planned.value = townInput.value;
  }
  closeTownMenus();
  updateEntrySummary();
}

function syncLineLayout(line) {
  const visit = line.querySelector(".act-status").value === "Market Visit";
  line.classList.toggle("not-visit", !visit);
  line.querySelectorAll(".mv-only").forEach((el) => { el.hidden = !visit; });
}

function addActivityLine(data) {
  const act = data || emptyActivity();
  const wrap = document.getElementById("entry-lines");
  const el = document.createElement("div");
  el.className = "entry-line";
  el.dataset.id = act.id;
  el.innerHTML =
    '<label>Status<select class="select act-status">' +
    ENTRY_STATUSES.map((s) => "<option" + (s === act.status ? " selected" : "") + ">" + s + "</option>").join("") +
    "</select></label>" +
    '<label>Town (actual)<div class="town-picker">' +
    '<input type="text" class="select act-town" autocomplete="off" value="' + escapeHtml(act.town || "") + '" />' +
    '<div class="town-menu" hidden></div></div></label>' +
    '<label class="mv-only">Planned town<input type="text" class="select act-planned" value="' + escapeHtml(act.plannedTown || "") + '" /></label>' +
    '<label class="mv-only">Prod Start<span class="dt-wrap"><input type="time" class="select act-prod-start" step="60" value="' + escapeHtml(act.prodStart || "") + '" /><button type="button" class="dt-open" data-kind="time" tabindex="-1" aria-label="Open time picker"></button></span></label>' +
    '<label class="mv-only">Prod End<span class="dt-wrap"><input type="time" class="select act-prod-end" step="60" value="' + escapeHtml(act.prodEnd || "") + '" /><button type="button" class="dt-open" data-kind="time" tabindex="-1" aria-label="Open time picker"></button></span></label>' +
    '<label>Remarks<input type="text" class="select act-remarks" value="' + escapeHtml(act.remarks || "") + '" /></label>' +
    '<button type="button" class="btn btn-ghost btn-icon act-remove" title="Remove">✕</button>';
  wrap.appendChild(el);
  syncLineLayout(el);
  const townInput = el.querySelector(".act-town");
  const menu = el.querySelector(".town-menu");
  townInput.addEventListener("focus", () => renderTownMenu(townInput, menu));
  townInput.addEventListener("input", () => {
    const planned = el.querySelector(".act-planned");
    if (!planned.dataset.touched) planned.value = townInput.value;
    renderTownMenu(townInput, menu);
    updateEntrySummary();
  });
  townInput.addEventListener("keydown", (evt) => {
    const opts = [...menu.querySelectorAll(".town-opt[data-town]")];
    const cur = opts.findIndex((o) => o.classList.contains("active"));
    if (evt.key === "ArrowDown" && opts[cur + 1]) {
      evt.preventDefault();
      opts.forEach((o) => o.classList.remove("active"));
      opts[cur + 1].classList.add("active");
      opts[cur + 1].scrollIntoView({ block: "nearest" });
    } else if (evt.key === "ArrowUp" && opts[cur - 1]) {
      evt.preventDefault();
      opts.forEach((o) => o.classList.remove("active"));
      opts[cur - 1].classList.add("active");
      opts[cur - 1].scrollIntoView({ block: "nearest" });
    } else if (evt.key === "Enter" && opts[cur]) {
      evt.preventDefault();
      pickTown(el, opts[cur].dataset.town);
    } else if (evt.key === "Escape") closeTownMenus();
  });
  menu.addEventListener("mousedown", (evt) => {
    const btn = evt.target.closest(".town-opt[data-town]");
    if (btn) pickTown(el, btn.dataset.town);
  });
  el.querySelector(".act-planned").addEventListener("input", () => {
    el.querySelector(".act-planned").dataset.touched = "1";
  });
  el.querySelector(".act-status").addEventListener("change", () => {
    syncLineLayout(el);
    updateEntrySummary();
  });
  el.querySelector(".act-remove").addEventListener("click", () => {
    el.remove();
    updateEntrySummary();
  });
  ["act-prod-start", "act-prod-end", "act-remarks"].forEach((cls) => {
    el.querySelector("." + cls).addEventListener("input", updateEntrySummary);
  });
}

function syncPopupType() {
  const type = document.getElementById("entry-day-type").value;
  const field = type === "field";
  const range = type === "leave" || type === "holiday";
  document.querySelectorAll(".field-only").forEach((el) => { el.hidden = !field; });
  document.querySelectorAll(".nonfield-only").forEach((el) => { el.hidden = field; });
  document.getElementById("entry-field-block").hidden = !field;
  document.getElementById("entry-to-wrap").hidden = !range;
  if (!range) document.getElementById("entry-to-date").value = "";
  if (field && !document.querySelector("#entry-lines .entry-line")) addActivityLine();
  updateEntrySummary();
}

function fillRmSelect(selected) {
  const sel = document.getElementById("entry-rm");
  const rms = rmsForMonth(entryState.month);
  sel.innerHTML = rms.map((r) => "<option>" + escapeHtml(r.rmName) + "</option>").join("");
  if (selected && [...sel.options].some((o) => o.value === selected)) sel.value = selected;
}

function openEntryPopup(opts) {
  opts = opts || {};
  const rms = rmsForMonth(entryState.month);
  if (!rms.length) {
    showToast("Upload an RM master for this month first.", true);
    return;
  }
  entryState.editingId = opts.day ? opts.day.id : null;
  document.getElementById("entry-modal-title").textContent = opts.day ? "Edit day" : "Add day";
  document.getElementById("entry-errors").hidden = true;
  fillRmSelect(opts.rmName || (opts.day && opts.day.rmName) || rms[0].rmName);
  const rmName = document.getElementById("entry-rm").value;
  document.getElementById("entry-date").value = opts.dateISO || (opts.day && opts.day.dateISO) || nextEmptyDate(rmName);
  document.getElementById("entry-to-date").value = "";
  document.getElementById("entry-day-type").value = (opts.day && opts.day.dayType) || "field";
  document.getElementById("entry-trip-start").value = (opts.day && opts.day.tripStart) || "";
  document.getElementById("entry-trip-end").value = (opts.day && opts.day.tripEnd) || "";
  document.getElementById("entry-kms").value = opts.day && opts.day.kms != null ? opts.day.kms : "";
  document.getElementById("entry-remarks").value = (opts.day && opts.day.remarks) || "";
  document.getElementById("entry-all-regions").checked = false;
  document.getElementById("entry-lines").innerHTML = "";
  if (opts.day && opts.day.dayType === "field") {
    (opts.day.activities || []).forEach((a) => addActivityLine(a));
  }
  const warn = document.getElementById("entry-warn");
  const dateISO = document.getElementById("entry-date").value;
  if (uploadedHasDay(rmName, dateISO)) {
    warn.hidden = false;
    warn.textContent = "This RM already has uploaded data on " + formatDisplayDate(dateISO) + ". You can still save the draft.";
  } else {
    warn.hidden = true;
  }
  syncPopupType();
  document.getElementById("entry-modal").hidden = false;
  document.getElementById("entry-day-type").focus();
}

function closeEntryPopup() {
  document.getElementById("entry-modal").hidden = true;
  entryState.editingId = null;
}

async function persistDraft() {
  await saveEntryDraft(entryState.month, entryState.days);
}

async function submitEntry() {
  const draft = collectPopupDay();
  const errors = validatePopup(draft);
  const errBox = document.getElementById("entry-errors");
  if (errors.length) {
    errBox.hidden = false;
    errBox.textContent = errors.join("\n");
    return;
  }
  errBox.hidden = true;
  const rangeTypes = draft.dayType === "leave" || draft.dayType === "holiday";
  const dates = (rangeTypes && !entryState.editingId && draft.toDate)
    ? datesBetween(draft.dateISO, draft.toDate)
    : [draft.dateISO];
  const skipped = [];
  const saved = [];
  dates.forEach((iso) => {
    const clash = entryState.days.find((d) =>
      d.id !== entryState.editingId && namesLikelySame(d.rmName, draft.rmName) && d.dateISO === iso
    );
    if (clash) {
      skipped.push(iso);
      return;
    }
    const row = {
      id: entryState.editingId && iso === draft.dateISO ? entryState.editingId : entryUid(),
      rmName: draft.rmName,
      dateISO: iso,
      dayType: draft.dayType,
      tripStart: draft.dayType === "field" ? draft.tripStart : "",
      tripEnd: draft.dayType === "field" ? draft.tripEnd : "",
      kms: draft.dayType === "field" ? draft.kms : null,
      remarks: draft.remarks,
      activities: draft.dayType === "field"
        ? (draft.activities || []).map((a) => Object.assign({}, a, { id: entryUid() }))
        : [],
      exported: false
    };
    const idx = entryState.days.findIndex((d) => d.id === row.id);
    if (idx >= 0) entryState.days[idx] = row;
    else entryState.days.push(row);
    saved.push(iso);
  });
  if (!saved.length && skipped.length) {
    const existing = entryState.days.find((d) =>
      namesLikelySame(d.rmName, draft.rmName) && d.dateISO === draft.dateISO
    );
    const go = await confirmModal(
      "Day already entered",
      formatDisplayDate(draft.dateISO) + " is already in the draft for this RM. Open it to edit?",
      "Edit"
    );
    if (go && existing) openEntryPopup({ day: existing });
    return;
  }
  await persistDraft();
  closeEntryPopup();
  drawEntryList();
  let msg = "Saved " + saved.map(formatDisplayDate).join(", ") + ".";
  if (skipped.length) msg += " Skipped " + skipped.map(formatDisplayDate).join(", ") + " (already entered).";
  showToast(msg);
}

async function deleteEntryDay(id) {
  const day = entryState.days.find((d) => d.id === id);
  if (!day) return;
  const ok = await confirmModal(
    "Delete this day?",
    formatDisplayDate(day.dateISO) + " · " + day.rmName + " will be removed from the draft.",
    "Delete"
  );
  if (!ok) return;
  entryState.days = entryState.days.filter((d) => d.id !== id);
  await persistDraft();
  drawEntryList();
  showToast("Day removed.");
}

function setCell(ws, r, c, cell) {
  ws[XLSX.utils.encode_cell({ r: r, c: c })] = cell;
}

function exportDraftDays(onlyNew, rmName) {
  const days = entryState.days
    .filter((d) => !onlyNew || !d.exported)
    .filter((d) => !rmName || namesLikelySame(d.rmName, rmName))
    .slice()
    .sort((a, b) => {
      const n = String(a.rmName).localeCompare(String(b.rmName));
      if (n) return n;
      return String(a.dateISO).localeCompare(String(b.dateISO));
    });
  if (!days.length) {
    showToast(onlyNew ? "No new rows to export." : (rmName ? "Nothing to export for this RM." : "Nothing to export."), true);
    return;
  }
  const headers = [
    "Region", "Manager Name", "Date", "Day", "Territory", "Planned Town", "Tracker Presence",
    "Trip Start Time", "Trip End Time", "Total Trip Time", "Prod. Start Time", "Prod. End Time",
    "Total Prod Time", "Travel Time", "Status", "Remarks", "KMs"
  ];
  const ws = {};
  headers.forEach((h, c) => setCell(ws, 0, c, { t: "s", v: h }));
  let r = 1;
  days.forEach((day) => {
    const rm = findRm(day.rmName);
    const dt = parseISODate(day.dateISO);
    const dayName = dt ? weekdayShort(dt) : "";
    const dateSerial = excelSerialDate(day.dateISO);
    if (day.dayType !== "field") {
      headers.forEach((_, c) => setCell(ws, r, c, { t: "s", v: "" }));
      setCell(ws, r, 0, { t: "s", v: rm ? rm.region : "" });
      setCell(ws, r, 1, { t: "s", v: rm ? rm.rmName : day.rmName });
      setCell(ws, r, 2, { t: "n", v: dateSerial, z: "dd-mmm-yyyy" });
      setCell(ws, r, 3, { t: "s", v: dayName });
      setCell(ws, r, 14, { t: "s", v: dayTypeStatus(day.dayType) });
      setCell(ws, r, 15, { t: "s", v: day.remarks || "" });
      r += 1;
      return;
    }
    const acts = day.activities || [];
    const tripHrs = hoursFromRange(day.tripStart, day.tripEnd);
    acts.forEach((a, i) => {
      const rec = townRecord(a.town);
      const visit = a.status === "Market Visit";
      const prodHrs = visit ? hoursFromRange(a.prodStart, a.prodEnd) : 0;
      headers.forEach((_, c) => setCell(ws, r, c, { t: "s", v: "" }));
      setCell(ws, r, 0, { t: "s", v: rm ? rm.region : "" });
      setCell(ws, r, 1, { t: "s", v: rm ? rm.rmName : day.rmName });
      setCell(ws, r, 2, { t: "n", v: dateSerial, z: "dd-mmm-yyyy" });
      setCell(ws, r, 3, { t: "s", v: dayName });
      setCell(ws, r, 4, { t: "s", v: rec ? rec.territory : "" });
      setCell(ws, r, 5, { t: "s", v: visit ? (a.plannedTown || a.town || "") : (a.town || "") });
      setCell(ws, r, 6, { t: "s", v: a.town || "" });
      const ts = excelTimeFrac(day.tripStart);
      const te = excelTimeFrac(day.tripEnd);
      if (ts != null) setCell(ws, r, 7, { t: "n", v: ts, z: "hh:mm" });
      if (te != null) setCell(ws, r, 8, { t: "n", v: te, z: "hh:mm" });
      setCell(ws, r, 9, { t: "n", v: i === 0 ? (tripHrs || 0) : 0, z: "0.00" });
      if (visit && excelTimeFrac(a.prodStart) != null) setCell(ws, r, 10, { t: "n", v: excelTimeFrac(a.prodStart), z: "hh:mm" });
      if (visit && excelTimeFrac(a.prodEnd) != null) setCell(ws, r, 11, { t: "n", v: excelTimeFrac(a.prodEnd), z: "hh:mm" });
      setCell(ws, r, 12, { t: "n", v: visit ? (prodHrs || 0) : 0, z: "0.00" });
      setCell(ws, r, 13, { t: "n", v: 0, z: "0.00" });
      setCell(ws, r, 14, { t: "s", v: statusExport(a.status) });
      setCell(ws, r, 15, { t: "s", v: a.remarks || "" });
      if (i === 0 && day.kms != null) setCell(ws, r, 16, { t: "n", v: day.kms });
      r += 1;
    });
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: headers.length - 1 } });
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Visit log");
  const rmPart = rmName ? "_" + String(rmName).replace(/[^\w]+/g, "_") : "";
  XLSX.writeFile(wb, "visit_log_draft_" + entryState.month + rmPart + ".xlsx");
  days.forEach((d) => { d.exported = true; });
  persistDraft().then(drawEntryList);
  showToast("Excel downloaded. Paste Special → Values into the master log.");
}

function drawEntryList() {
  const host = document.getElementById("entry-body");
  const rms = rmsForMonth(entryState.month);
  if (!rms.length) {
    host.innerHTML = '<div class="placeholder-card"><h2>No RM master for this month</h2><p>Upload the RM master on the Uploads page first.</p></div>';
    return;
  }
  const emptyDates = datesInMonth(entryState.month, true);
  host.innerHTML = rms.map((rm) => {
    const days = entryState.days.filter((d) => namesLikelySame(d.rmName, rm.rmName))
      .slice()
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const taken = {};
    days.forEach((d) => { taken[d.dateISO] = true; });
    const missing = emptyDates.filter((iso) => !taken[iso] && !uploadedHasDay(rm.rmName, iso));
    const rows = days.map((d) => {
      const rec = summarizeDraftDay(d);
      let verdict = rec.dayType;
      let cls = "";
      if (d.dayType === "field" && (d.activities || []).some((a) => a.status === "Market Visit")) {
        verdict = rec.isValid ? "Valid" : "Invalid";
        cls = rec.isValid ? "entry-valid" : "entry-invalid";
      }
      return "<tr><td>" + escapeHtml(formatDisplayDate(d.dateISO)) +
        (d.exported ? ' <span class="entry-exported">Exported ✓</span>' : "") +
        "</td><td>" + escapeHtml(ENTRY_DAY_TYPES[d.dayType] || d.dayType) +
        "</td><td>" + escapeHtml(activitySummary(d)) +
        "</td><td class=\"num-cell\">" + (rec.dailyTotalHours == null ? "" : formatHours(rec.dailyTotalHours)) +
        "</td><td class=\"" + cls + "\">" + escapeHtml(verdict) +
        "</td><td class=\"num-cell\">" + (d.kms == null ? "" : formatKms(d.kms)) +
        "</td><td><button type=\"button\" class=\"btn btn-ghost entry-edit\" data-id=\"" + d.id + "\">Edit ✏️</button> " +
        "<button type=\"button\" class=\"btn btn-ghost entry-del\" data-id=\"" + d.id + "\">Delete 🗑</button></td></tr>";
    }).join("");
    const table = days.length
      ? '<table class="entry-days"><thead><tr><th>Date</th><th>Day type</th><th>Activities</th><th class="num-cell">Total hrs</th><th>Valid / Invalid</th><th class="num-cell">KMs</th><th></th></tr></thead><tbody>' +
        rows + "</tbody></table>"
      : '<p class="empty" style="margin:0;padding:10px 12px;border:1px solid var(--line);border-top:0">No days entered yet.</p>';
    const miss = missing.length
      ? '<div class="entry-not">Not entered · ' + missing.map((iso) =>
        '<button type="button" class="entry-date-chip" data-rm="' + escapeHtml(rm.rmName) + '" data-date="' + iso + '">' +
        escapeHtml(formatDisplayDate(iso)) + "</button>"
      ).join("") + "</div>"
      : '<div class="entry-not">All dates up to today are entered.</div>';
    return '<article class="entry-rm-block"><div class="entry-rm-head"><div><h2>' + escapeHtml(rm.rmName) +
      "</h2><div class=\"sub\">" + escapeHtml(rm.region || "") + " · Base " + escapeHtml(rm.baseTown || "—") +
      "</div></div><div class=\"entry-rm-actions\">" +
      '<button type="button" class="btn btn-ghost btn-add entry-export-rm" data-rm="' + escapeHtml(rm.rmName) +
      '" title="Export this RM" aria-label="Export this RM"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 18h14"/></svg></button>' +
      '<button type="button" class="btn btn-primary btn-add entry-add" data-rm="' +
      escapeHtml(rm.rmName) + '" title="Add day">+</button></div></div>' + table + miss + "</article>";
  }).join("");
}

function fillEntryMonths() {
  const sel = document.getElementById("entry-month");
  const year = new Date().getFullYear();
  const keys = {};
  entryState.rms.forEach((p) => { keys[rmMonthKey(p.month, year)] = true; });
  (entryState.visits || []).forEach((p) => { if (p.month) keys[p.month] = true; });
  const todayKey = isoDate(year, new Date().getMonth() + 1, 1).slice(0, 7);
  keys[todayKey] = true;
  const months = Object.keys(keys).sort();
  const prev = sel.value || entryState.month || todayKey;
  sel.innerHTML = months.map((m) => '<option value="' + m + '">' + monthPretty(m) + "</option>").join("");
  sel.value = months.indexOf(prev) >= 0 ? prev : months[months.length - 1];
  entryState.month = sel.value;
}

async function refreshEntry() {
  const terr = await getTerritory();
  entryState.territory = terr ? terr.rows : [];
  entryState.rms = await getAllRmMaster();
  entryState.visits = await getAllVisitLogs();
  fillEntryMonths();
  const rec = await getEntryDraft(entryState.month);
  entryState.days = rec && rec.days ? rec.days : [];
  drawEntryList();
}

document.getElementById("entry-month").addEventListener("change", async () => {
  entryState.month = document.getElementById("entry-month").value;
  const rec = await getEntryDraft(entryState.month);
  entryState.days = rec && rec.days ? rec.days : [];
  drawEntryList();
});

document.getElementById("entry-body").addEventListener("click", (evt) => {
  const exp = evt.target.closest(".entry-export-rm");
  if (exp) {
    exportDraftDays(false, exp.dataset.rm);
    return;
  }
  const add = evt.target.closest(".entry-add");
  if (add) {
    openEntryPopup({ rmName: add.dataset.rm });
    return;
  }
  const chip = evt.target.closest(".entry-date-chip");
  if (chip) {
    openEntryPopup({ rmName: chip.dataset.rm, dateISO: chip.dataset.date });
    return;
  }
  const edit = evt.target.closest(".entry-edit");
  if (edit) {
    const day = entryState.days.find((d) => d.id === edit.dataset.id);
    if (day) openEntryPopup({ day: day });
    return;
  }
  const del = evt.target.closest(".entry-del");
  if (del) deleteEntryDay(del.dataset.id);
});

document.getElementById("entry-add-line").addEventListener("click", () => addActivityLine());
document.getElementById("entry-day-type").addEventListener("change", syncPopupType);
document.getElementById("entry-cancel").addEventListener("click", closeEntryPopup);
document.getElementById("entry-submit").addEventListener("click", submitEntry);
document.getElementById("entry-all-regions").addEventListener("change", closeTownMenus);
["entry-rm", "entry-date", "entry-trip-start", "entry-trip-end", "entry-kms", "entry-remarks"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateEntrySummary);
  document.getElementById(id).addEventListener("change", updateEntrySummary);
});
document.getElementById("entry-date").addEventListener("change", () => {
  const rm = document.getElementById("entry-rm").value;
  const iso = document.getElementById("entry-date").value;
  const warn = document.getElementById("entry-warn");
  if (uploadedHasDay(rm, iso)) {
    warn.hidden = false;
    warn.textContent = "This RM already has uploaded data on " + formatDisplayDate(iso) + ". You can still save the draft.";
  } else warn.hidden = true;
});
document.getElementById("btn-entry-export-all").addEventListener("click", () => exportDraftDays(false));
document.getElementById("btn-entry-export-new").addEventListener("click", () => exportDraftDays(true));
document.getElementById("btn-entry-clear-exported").addEventListener("click", async () => {
  const n = entryState.days.filter((d) => d.exported).length;
  if (!n) {
    showToast("No exported rows to clear.");
    return;
  }
  const ok = await confirmModal("Clear exported rows?", n + " exported day(s) will be removed from the draft. Unexported days stay.", "Clear");
  if (!ok) return;
  entryState.days = entryState.days.filter((d) => !d.exported);
  await persistDraft();
  drawEntryList();
  showToast("Exported rows cleared.");
});
document.addEventListener("click", (evt) => {
  if (!evt.target.closest(".town-picker")) closeTownMenus();
});
document.getElementById("entry-modal").addEventListener("click", (evt) => {
  const pick = evt.target.closest(".dt-open");
  if (pick) {
    const input = pick.parentElement && pick.parentElement.querySelector("input");
    if (input && typeof input.showPicker === "function") {
      try { input.showPicker(); } catch (err) { input.focus(); }
    } else if (input) {
      input.focus();
    }
    return;
  }
  if (evt.target.id === "entry-modal") closeEntryPopup();
});
