/* Phase 2 – visit-log KPIs from requirements section 4.
   SOP / Red / Green / Invalid are decided on TOTAL productive hours
   per RM per day, never on a single row. */

var STATUS_VISIT = "marketvisit";
var STATUS_LEAVE = "leave";
var STATUS_HOLIDAY = "holiday";
var STATUS_MEETING = "meeting";
var STATUS_OFFICE = "officework";
var STATUS_TRANSIT = "transit";

function collapseSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function statusKey(value) {
  return collapseSpaces(value).toLowerCase().replace(/[\s._-]+/g, "");
}

function isVisitRow(row) {
  return statusKey(row.status) === STATUS_VISIT;
}

function round2(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 100) / 100;
}

function pct(part, whole) {
  if (!whole) return null;
  return round2((part / whole) * 100);
}

function formatPct(value) {
  return value == null ? "—" : value.toFixed(1) + "%";
}

function formatHours(value) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function formatKms(value) {
  if (value == null || value === "") return "—";
  var n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sumKms(rows) {
  var any = false;
  var total = 0;
  (rows || []).forEach(function (r) {
    if (r.kms == null || r.kms === "") return;
    var n = Number(r.kms);
    if (!Number.isFinite(n)) return;
    any = true;
    total += n;
  });
  return any ? total : null;
}

function formatDisplayDate(iso) {
  var d = parseISODate(iso);
  if (!d) return iso || "";
  var names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return String(d.getDate()).padStart(2, "0") + "-" + names[d.getMonth()] + " " + weekdayShort(d);
}

function formatMinutesAsTime(mins) {
  if (mins == null || mins === "") return "";
  var n = Number(mins);
  if (Number.isNaN(n)) return "";
  var h = Math.floor(n / 60);
  var m = Math.round(n - h * 60);
  if (m === 60) { h += 1; m = 0; }
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

/* Levenshtein distance – used so "Afzaal Cheema" matches "AFZAL CHEEMA". */
function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  var m = a.length;
  var n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  var prev = [];
  var i, j, cur, tmp;
  for (j = 0; j <= n; j++) prev[j] = j;
  for (i = 1; i <= m; i++) {
    cur = [i];
    for (j = 1; j <= n; j++) {
      var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

function namesLikelySame(a, b) {
  var na = collapseSpaces(a).toLowerCase();
  var nb = collapseSpaces(b).toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  var maxLen = Math.max(na.length, nb.length);
  if (levenshtein(na, nb) <= (maxLen <= 10 ? 2 : 3)) return true;
  var ta = na.split(" ");
  var tb = nb.split(" ");
  if (ta.length !== tb.length || !ta.length) return false;
  var i;
  for (i = 0; i < ta.length; i++) {
    if (ta[i] === tb[i]) continue;
    if (levenshtein(ta[i], tb[i]) > 2) return false;
  }
  return true;
}

function matchRmName(rawName, rmRows) {
  var list = rmRows || [];
  var i;
  var best = null;
  var bestDist = 999;
  for (i = 0; i < list.length; i++) {
    var candidate = list[i].rmName;
    if (!namesLikelySame(rawName, candidate)) continue;
    var d = levenshtein(collapseSpaces(rawName).toLowerCase(), collapseSpaces(candidate).toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = list[i];
    }
  }
  return best;
}

/* Hours between two clock times stored as minutes from midnight. */
function hoursBetween(startMin, endMin) {
  if (startMin == null || endMin == null || startMin === "" || endMin === "") return null;
  var a = Number(startMin);
  var b = Number(endMin);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (b < a) return null;
  return round2((b - a) / 60);
}

function canonicalTown(name, territoryRows) {
  var want = collapseSpaces(name).toLowerCase();
  if (!want) return "";
  var found = (territoryRows || []).find(function (t) {
    return collapseSpaces(t.town).toLowerCase() === want;
  });
  return found ? found.town : collapseSpaces(name);
}

function isoFromParts(y, m, d) {
  return String(y) + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

function monthKeyAdd(monthKey, delta) {
  var p = String(monthKey || "").split("-");
  if (p.length !== 2) return "";
  var y = Number(p[0]);
  var m = Number(p[1]) + delta;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return isoFromParts(y, m, 1).slice(0, 7);
}

function daysInMonthKey(monthKey) {
  var p = String(monthKey || "").split("-");
  if (p.length !== 2) return 0;
  return new Date(Number(p[0]), Number(p[1]), 0).getDate();
}

function lastDateISO(rows) {
  var max = "";
  (rows || []).forEach(function (r) {
    if (r.dateISO && r.dateISO > max) max = r.dateISO;
  });
  return max;
}

function datesUpTo(monthKey, dataUpTo) {
  var p = String(monthKey || "").split("-");
  if (p.length !== 2 || !dataUpTo) return [];
  var y = Number(p[0]);
  var m = Number(p[1]);
  var last = Number(String(dataUpTo).split("-")[2]);
  var out = [];
  var d;
  for (d = 1; d <= last; d++) out.push(isoFromParts(y, m, d));
  return out;
}

function rollingVisitContext(allVisitPacks, monthKey) {
  var want = [monthKeyAdd(monthKey, -2), monthKeyAdd(monthKey, -1), monthKey];
  var present = [];
  var rows = [];
  (allVisitPacks || []).forEach(function (pack) {
    if (want.indexOf(pack.month) >= 0) {
      present.push(pack.month);
      rows = rows.concat(pack.rows || []);
    }
  });
  present.sort();
  return { rows: rows, months: present };
}

function monthRangeNote(months) {
  if (!months || !months.length) return "No visit months in range.";
  var names = months.map(function (k) {
    var p = String(k).split("-");
    var labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return labels[Number(p[1]) - 1] || k;
  });
  if (months.length === 1) {
    return "Based on " + names[0] + " only – upload more months for a fuller view";
  }
  return "Based on " + names[0] + "–" + names[names.length - 1];
}

function paceFrom(achieved, expected) {
  if (expected == null || Number.isNaN(expected)) {
    return { pace: null, paceLabel: "—", paceClass: "" };
  }
  var diff = achieved - expected;
  if (diff >= 0) return { pace: diff, paceLabel: "On track (" + (diff > 0 ? "+" : "") + diff + ")", paceClass: "ach-green" };
  if (diff >= -2) return { pace: diff, paceLabel: "Slightly behind (" + diff + ")", paceClass: "ach-amber" };
  return { pace: diff, paceLabel: "Behind (" + diff + ")", paceClass: "ach-red" };
}

/* Section 4.1 – per row. File time totals are ignored; we recompute. */
function enrichVisitRow(row, territoryRows) {
  var visit = isVisitRow(row);
  var trip = hoursBetween(row.tripStartMin, row.tripEndMin);
  var prod = hoursBetween(row.prodStartMin, row.prodEndMin);
  var travel = null;
  if (trip != null && prod != null) travel = round2(trip - prod);
  else if (trip != null) travel = trip;
  var planned = canonicalTown(row.plannedTown, territoryRows);
  var actual = canonicalTown(row.trackerPresence, territoryRows);
  var planMatch = visit && planned && actual && planned.toLowerCase() === actual.toLowerCase();
  return Object.assign({}, row, {
    isVisit: visit,
    visitedTown: visit ? actual : "",
    plannedTownDisplay: planned,
    trackerTownDisplay: actual,
    tripHours: trip,
    prodHours: prod,
    travelHours: travel,
    planDeviation: visit && planned && actual ? !planMatch : false,
    planMatch: !!planMatch
  });
}

function monthNumberFromKey(monthKey) {
  var parts = String(monthKey || "").split("-");
  if (parts.length === 2) return String(Number(parts[1]));
  return String(monthKey);
}

function findRmMaster(rmPacks, monthKey, matchedName) {
  var wantMonth = monthNumberFromKey(monthKey);
  var pack = (rmPacks || []).find(function (p) {
    return String(p.month) === wantMonth;
  });
  if (!pack) pack = (rmPacks || []).find(function (p) {
    return String(p.month) === String(monthKey);
  });
  var rows = pack ? pack.rows : [];
  return rows.find(function (r) {
    return namesLikelySame(r.rmName, matchedName);
  }) || null;
}

function townsInRegion(territoryRows, region) {
  var want = collapseSpaces(region).toLowerCase();
  return (territoryRows || []).filter(function (t) {
    return collapseSpaces(t.region).toLowerCase() === want;
  });
}

function uniqueSorted(list) {
  var seen = {};
  var out = [];
  list.forEach(function (item) {
    var k = collapseSpaces(item);
    if (!k) return;
    var key = k.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(k);
  });
  out.sort(function (a, b) { return a.localeCompare(b); });
  return out;
}

function dayTypeFromHours(prodHours) {
  if (prodHours >= 3) return "Green";
  if (prodHours >= 2) return "Red";
  return "Invalid";
}

/* Section 4.2 priority when there is no Market Visit that day. */
function nonVisitDayLabel(rows) {
  var keys = (rows || []).map(function (r) { return statusKey(r.status); });
  if (keys.indexOf(STATUS_LEAVE) >= 0) return "Leave";
  if (keys.indexOf(STATUS_HOLIDAY) >= 0) return "Holiday";
  if (keys.indexOf(STATUS_MEETING) >= 0) return "Meeting";
  if (keys.indexOf(STATUS_OFFICE) >= 0) return "Office Work";
  if (keys.indexOf(STATUS_TRANSIT) >= 0) return "Transit";
  return collapseSpaces((rows[0] && rows[0].status) || "") || "No entry";
}

function minMins(rows, field) {
  var vals = rows.map(function (r) { return r[field]; }).filter(function (v) {
    return v != null && v !== "" && !Number.isNaN(Number(v));
  });
  if (!vals.length) return null;
  return Math.min.apply(null, vals.map(Number));
}

function maxMins(rows, field) {
  var vals = rows.map(function (r) { return r[field]; }).filter(function (v) {
    return v != null && v !== "" && !Number.isNaN(Number(v));
  });
  if (!vals.length) return null;
  return Math.max.apply(null, vals.map(Number));
}

/* Section 4.2 – earliest to latest Trip/Prod time on Market Visit and Transit rows. */
function dayTimeBounds(rows) {
  var times = [];
  (rows || []).forEach(function (r) {
    var st = statusKey(r.status);
    if (st !== STATUS_VISIT && st !== STATUS_TRANSIT) return;
    [r.tripStartMin, r.tripEndMin, r.prodStartMin, r.prodEndMin].forEach(function (m) {
      if (m == null || m === "") return;
      var n = Number(m);
      if (Number.isFinite(n)) times.push(n);
    });
  });
  if (!times.length) return null;
  return { min: Math.min.apply(null, times), max: Math.max.apply(null, times) };
}

function emptyDayRecord(rmName, dateISO) {
  var d = parseISODate(dateISO);
  return {
    rmName: rmName,
    dateISO: dateISO,
    dayName: d ? weekdayShort(d) : "",
    status: "No entry",
    statuses: "",
    towns: "",
    townList: [],
    visitCount: 0,
    tripStartLabel: "",
    tripEndLabel: "",
    prodStartLabel: "",
    prodEndLabel: "",
    dailyProdHours: null,
    dailyTripHours: null,
    dailyTravelHours: null,
    isFieldDay: false,
    isValidVisitDay: false,
    dayType: "No entry",
    isGreen: false,
    isRed: false,
    isInvalid: false,
    isLeave: false,
    isHoliday: false,
    isMeeting: false,
    isOfficework: false,
    isTransit: false,
    isMissing: true,
    baseTownDay: false,
    otherTtyDay: false,
    planDeviationText: "",
    remarks: "",
    dailyKms: null,
    townCount: 0,
    dailyTotalHours: null,
    travelClamped: false,
    rows: []
  };
}

/* Section 4.2 – exactly one label per RM per date. */
function buildDayRecord(rmName, dateISO, rawRows, rmInfo, territoryRows) {
  if (!rawRows || !rawRows.length) return emptyDayRecord(rmName, dateISO);
  var rows = rawRows.map(function (r) { return enrichVisitRow(r, territoryRows); });
  var visits = rows.filter(function (r) { return r.isVisit; });
  var isFieldDay = visits.length > 0;
  var towns = uniqueSorted(visits.map(function (r) { return r.visitedTown; }));
  var dailyProd = round2(visits.reduce(function (sum, r) { return sum + (r.prodHours || 0); }, 0));
  var bounds = dayTimeBounds(rows);
  var dailyTotal = bounds ? round2((bounds.max - bounds.min) / 60) : null;
  var prodForTravel = isFieldDay ? (dailyProd || 0) : 0;
  var travelRaw = dailyTotal == null ? null : round2(dailyTotal - prodForTravel);
  var travelClamped = travelRaw != null && travelRaw < 0;
  var dailyTravel = travelRaw == null ? null : (travelClamped ? 0 : travelRaw);
  var dailyKms = sumKms(rows);
  var type = isFieldDay ? dayTypeFromHours(dailyProd || 0) : nonVisitDayLabel(rows);
  var valid = type === "Green" || type === "Red";
  var baseCanon = canonicalTown(rmInfo && rmInfo.baseTown, territoryRows);
  var baseTownDay = !!(valid && baseCanon && towns.length === 1 && towns[0].toLowerCase() === baseCanon.toLowerCase());
  var otherTtyDay = valid && !baseTownDay;
  var deviations = uniqueSorted(visits.filter(function (r) { return r.planDeviation; }).map(function (r) {
    return r.plannedTownDisplay;
  }));
  var remarks = uniqueSorted(rows.map(function (r) { return collapseSpaces(r.remarks); }));
  var d = parseISODate(dateISO);
  return {
    rmName: rmName,
    dateISO: dateISO,
    dayName: d ? weekdayShort(d) : "",
    status: type,
    statuses: uniqueSorted(rows.map(function (r) { return collapseSpaces(r.status); })).join(", "),
    towns: towns.join(", "),
    townList: towns,
    visitCount: visits.length,
    tripStartLabel: formatMinutesAsTime(bounds ? bounds.min : null),
    tripEndLabel: formatMinutesAsTime(bounds ? bounds.max : null),
    prodStartLabel: formatMinutesAsTime(minMins(visits, "prodStartMin")),
    prodEndLabel: formatMinutesAsTime(maxMins(visits, "prodEndMin")),
    dailyProdHours: isFieldDay ? dailyProd : null,
    dailyTripHours: dailyTotal,
    dailyTravelHours: dailyTravel,
    dailyTotalHours: dailyTotal,
    travelClamped: travelClamped,
    dailyKms: dailyKms,
    townCount: towns.length,
    isFieldDay: isFieldDay,
    isValidVisitDay: valid,
    dayType: type,
    isGreen: type === "Green",
    isRed: type === "Red",
    isInvalid: type === "Invalid",
    isLeave: type === "Leave",
    isHoliday: type === "Holiday",
    isMeeting: type === "Meeting",
    isOfficework: type === "Office Work",
    isTransit: type === "Transit",
    isMissing: false,
    baseTownDay: baseTownDay,
    otherTtyDay: otherTtyDay,
    planDeviationText: deviations.join(", "),
    remarks: remarks.join("; "),
    rows: rows
  };
}

function buildDayRecords(visitRows, rmInfo, territoryRows, monthKey, dataUpTo) {
  var rmName = rmInfo && rmInfo.rmName;
  var groups = {};
  (visitRows || []).forEach(function (raw) {
    var date = raw.dateISO;
    if (!date) return;
    if (!groups[date]) groups[date] = [];
    groups[date].push(raw);
  });
  var dates = datesUpTo(monthKey, dataUpTo);
  if (!dates.length) dates = Object.keys(groups).sort();
  return dates.map(function (iso) {
    return buildDayRecord(rmName, iso, groups[iso] || [], rmInfo, territoryRows);
  });
}

function parseISODate(iso) {
  var p = String(iso || "").split("-");
  if (p.length !== 3) return null;
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function weekdayShort(date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function countTrue(days, prop) {
  return days.filter(function (d) { return d[prop]; }).length;
}

/* Section 4.3 – one summary object per RM for the month. */
function summarizeRmMonth(rmMasterRow, visitRows, territoryRows, opts) {
  opts = opts || {};
  var rmName = rmMasterRow.rmName;
  var region = rmMasterRow.region;
  var zone = "";
  (territoryRows || []).some(function (t) {
    if (collapseSpaces(t.region).toLowerCase() === collapseSpaces(region).toLowerCase()) {
      zone = t.zone;
      return true;
    }
    return false;
  });
  var monthKey = opts.monthKey || "";
  var dataUpTo = opts.dataUpTo || lastDateISO(visitRows);
  var days = buildDayRecords(visitRows, rmMasterRow, territoryRows, monthKey, dataUpTo);
  var enriched = (visitRows || []).map(function (r) { return enrichVisitRow(r, territoryRows); });
  var visits = enriched.filter(function (r) { return r.isVisit; });

  var target = Number(rmMasterRow.targetVisits) || 0;
  var leaveDays = countTrue(days, "isLeave");
  var holidayDays = countTrue(days, "isHoliday");
  var adjustedTarget = target - leaveDays;
  var achieved = countTrue(days, "isGreen") + countTrue(days, "isRed");
  var achievementPct = adjustedTarget > 0 ? pct(achieved, adjustedTarget) : null;
  var dim = daysInMonthKey(monthKey);
  var dayNum = dataUpTo ? Number(String(dataUpTo).split("-")[2]) : 0;
  var expectedByNow = (dim && adjustedTarget != null) ? Math.round(adjustedTarget * (dayNum / dim)) : null;
  var pace = paceFrom(achieved, expectedByNow);

  var uniqueTowns = uniqueSorted(visits.map(function (r) { return r.visitedTown; }));
  var fieldDays = countTrue(days, "isFieldDay");
  var greenDays = countTrue(days, "isGreen");
  var redDays = countTrue(days, "isRed");
  var invalidDays = countTrue(days, "isInvalid");
  var baseTownDays = countTrue(days, "baseTownDay");
  var otherTtyDays = countTrue(days, "otherTtyDay");
  var missingDays = countTrue(days, "isMissing");

  var planMatchCount = visits.filter(function (r) { return r.planMatch; }).length;
  var planAdherence = visits.length ? pct(planMatchCount, visits.length) : null;
  var planDeviation = planAdherence == null ? null : round2(100 - planAdherence);

  var totalTrip = round2(days.reduce(function (s, d) { return s + (d.dailyTripHours || 0); }, 0));
  var totalProd = round2(days.reduce(function (s, d) { return s + (d.dailyProdHours || 0); }, 0));
  var totalTravel = round2(days.reduce(function (s, d) { return s + (d.dailyTravelHours || 0); }, 0));
  var avgTrip = fieldDays ? round2(totalTrip / fieldDays) : null;
  var avgProd = fieldDays ? round2(totalProd / fieldDays) : null;
  var avgTravel = fieldDays ? round2(totalTravel / fieldDays) : null;

  var kmsAll = days.filter(function (d) { return d.dailyKms != null; });
  var totalKms = kmsAll.length ? kmsAll.reduce(function (s, d) { return s + d.dailyKms; }, 0) : null;
  var visitDays = days.filter(function (d) { return d.isGreen || d.isRed || d.isInvalid; });
  var kmsVisitDays = visitDays.filter(function (d) { return d.dailyKms != null; });
  var visitKms = kmsVisitDays.length ? kmsVisitDays.reduce(function (s, d) { return s + d.dailyKms; }, 0) : null;
  var avgKmsPerVisitDay = kmsVisitDays.length ? Math.round(visitKms / kmsVisitDays.length) : null;

  var regionTowns = townsInRegion(territoryRows, region);
  var regionTownNames = uniqueSorted(regionTowns.map(function (t) { return t.town; }));
  var rolling = opts.rollingRows || visitRows || [];
  var visited3m = {};
  rolling.forEach(function (raw) {
    var row = enrichVisitRow(raw, territoryRows);
    if (!row.isVisit || !row.visitedTown) return;
    if (!namesLikelySame(row.matchedRmName || row.managerName, rmName)) return;
    visited3m[row.visitedTown.toLowerCase()] = row.visitedTown;
  });
  var townsNotVisited = regionTownNames.filter(function (t) {
    return !visited3m[t.toLowerCase()];
  });
  var townsVisitedInRegion = regionTownNames.filter(function (t) {
    return !!visited3m[t.toLowerCase()];
  });
  var byTerritory = {};
  townsNotVisited.forEach(function (town) {
    var rec = regionTowns.find(function (t) {
      return collapseSpaces(t.town).toLowerCase() === town.toLowerCase();
    });
    var ter = rec ? rec.territory : "Other";
    if (!byTerritory[ter]) byTerritory[ter] = [];
    byTerritory[ter].push(town);
  });
  var townsNotVisitedGrouped = Object.keys(byTerritory).sort().map(function (ter) {
    return ter + ": " + byTerritory[ter].join(", ");
  }).join(" · ");

  var territories = uniqueSorted(regionTowns.map(function (t) { return t.territory; }));
  var territoriesNotVisited = territories.filter(function (ter) {
    var towns = regionTowns.filter(function (t) {
      return collapseSpaces(t.territory).toLowerCase() === collapseSpaces(ter).toLowerCase();
    });
    return !towns.some(function (t) { return visited3m[collapseSpaces(t.town).toLowerCase()]; });
  });

  return Object.assign({
    rmName: rmName,
    region: region,
    zone: zone,
    baseTown: canonicalTown(rmMasterRow.baseTown, territoryRows) || rmMasterRow.baseTown,
    target: target,
    leaveDays: leaveDays,
    holidayDays: holidayDays,
    adjustedTarget: adjustedTarget,
    dataUpTo: dataUpTo,
    expectedByNow: expectedByNow,
    achieved: achieved,
    achievementPct: achievementPct,
    achievementPctLabel: formatPct(achievementPct),
    totalVisits: visits.length,
    uniqueTownsVisited: uniqueTowns.length,
    uniqueTownsList: uniqueTowns.join(", "),
    fieldDays: fieldDays,
    validVisitDays: achieved,
    greenDays: greenDays,
    redDays: redDays,
    invalidDays: invalidDays,
    baseTownDays: baseTownDays,
    otherTtyDays: otherTtyDays,
    meetingDays: countTrue(days, "isMeeting"),
    officeworkDays: countTrue(days, "isOfficework"),
    transitDays: countTrue(days, "isTransit"),
    missingDays: missingDays,
    planMatchCount: planMatchCount,
    planAdherencePct: planAdherence,
    planAdherenceLabel: formatPct(planAdherence),
    planDeviationPct: planDeviation,
    planDeviationLabel: formatPct(planDeviation),
    totalTripHours: totalTrip,
    avgTripHours: avgTrip,
    totalProdHours: totalProd,
    avgProdHours: avgProd,
    totalTravelHours: totalTravel,
    avgTravelHours: avgTravel,
    totalKms: totalKms,
    totalKmsLabel: formatKms(totalKms),
    visitKms: visitKms,
    avgKmsPerVisitDay: avgKmsPerVisitDay,
    avgKmsPerVisitDayLabel: formatKms(avgKmsPerVisitDay),
    territoriesNotVisited: territoriesNotVisited.length,
    territoriesNotVisitedList: territoriesNotVisited.join(", "),
    townsNotVisited: townsNotVisited.length,
    townsNotVisitedList: townsNotVisited.join(", "),
    townsNotVisitedGrouped: townsNotVisitedGrouped,
    townsNotVisitedNote: monthRangeNote(opts.rollingMonths || []),
    regionTownCount: regionTownNames.length,
    townsVisitedInRegionCount: townsVisitedInRegion.length,
    coveragePct: regionTownNames.length ? pct(townsVisitedInRegion.length, regionTownNames.length) : null,
    coverageLabel: regionTownNames.length ? formatPct(pct(townsVisitedInRegion.length, regionTownNames.length)) : "—",
    days: days
  }, pace);
}

function summarizeMonth(monthKey, visitRows, rmPacks, territoryRows, allVisitPacks) {
  var wantMonth = monthNumberFromKey(monthKey);
  var pack = (rmPacks || []).find(function (p) {
    return String(p.month) === wantMonth || String(p.month) === String(monthKey);
  });
  var rms = pack ? pack.rows.slice() : [];
  var dataUpTo = lastDateISO(visitRows);
  var rolling = rollingVisitContext(allVisitPacks || [], monthKey);
  var opts = {
    monthKey: monthKey,
    dataUpTo: dataUpTo,
    rollingRows: rolling.rows,
    rollingMonths: rolling.months
  };
  var summaries = rms.map(function (rm) {
    var rows = (visitRows || []).filter(function (v) {
      var name = v.matchedRmName || v.managerName;
      return namesLikelySame(name, rm.rmName);
    });
    return summarizeRmMonth(rm, rows, territoryRows || [], opts);
  });

  var unmatched = uniqueSorted((visitRows || []).filter(function (v) {
    return !v.matchedRmName;
  }).map(function (v) { return v.managerName; }));

  unmatched.forEach(function (name) {
    var fake = { rmName: name, region: "", baseTown: "", targetVisits: 0 };
    var rows = visitRows.filter(function (v) {
      return !v.matchedRmName && namesLikelySame(v.managerName, name);
    });
    var s = summarizeRmMonth(fake, rows, territoryRows || [], opts);
    s.unmatched = true;
    summaries.push(s);
  });

  return summaries;
}
