/* Phase 2 – visit-log KPIs from requirements section 4.
   SOP / Red / Green / Invalid are decided on TOTAL productive hours
   per RM per day, never on a single row. */

var STATUS_VISIT = "marketvisit";
var STATUS_LEAVE = "leave";
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

/* Section 4.1 – per visit row. Day / file totals are ignored; we recompute. */
function enrichVisitRow(row) {
  var visit = isVisitRow(row);
  var trip = visit ? hoursBetween(row.tripStartMin, row.tripEndMin) : null;
  var prod = visit ? hoursBetween(row.prodStartMin, row.prodEndMin) : null;
  var travel = trip != null && prod != null ? round2(trip - prod) : null;
  var planned = collapseSpaces(row.plannedTown);
  var actual = collapseSpaces(row.trackerPresence);
  var planMatch = visit && planned && actual && planned.toLowerCase() === actual.toLowerCase();
  return Object.assign({}, row, {
    isVisit: visit,
    visitedTown: visit ? actual : "",
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

function dayTypeFromHours(prodHours, isFieldDay) {
  if (!isFieldDay) return "";
  if (prodHours >= 3) return "Green";
  if (prodHours >= 2) return "Red";
  return "Invalid";
}

function nonVisitDayLabel(statuses) {
  var keys = statuses.map(statusKey);
  if (keys.indexOf(STATUS_LEAVE) >= 0) return "Leave";
  if (keys.indexOf(STATUS_MEETING) >= 0) return "Meeting";
  if (keys.indexOf(STATUS_OFFICE) >= 0) return "Officework";
  if (keys.indexOf(STATUS_TRANSIT) >= 0) return "Transit";
  return statuses[0] || "";
}

/* Section 4.2 – one object per RM per calendar day. */
function buildDayRecords(visitRows, rmInfo) {
  var groups = {};
  (visitRows || []).forEach(function (raw) {
    var row = enrichVisitRow(raw);
    var rm = row.matchedRmName || row.managerName;
    var date = row.dateISO;
    if (!rm || !date) return;
    var key = rm + "|" + date;
    if (!groups[key]) {
      groups[key] = {
        rmName: rm,
        dateISO: date,
        rows: []
      };
    }
    groups[key].rows.push(row);
  });

  return Object.keys(groups).sort().map(function (key) {
    var g = groups[key];
    var visits = g.rows.filter(function (r) { return r.isVisit; });
    var statuses = uniqueSorted(g.rows.map(function (r) { return collapseSpaces(r.status); }));
    var towns = uniqueSorted(visits.map(function (r) { return r.visitedTown; }));
    var dailyProd = round2(visits.reduce(function (sum, r) { return sum + (r.prodHours || 0); }, 0));
    var dailyTrip = round2(visits.reduce(function (sum, r) { return sum + (r.tripHours || 0); }, 0));
    var dailyTravel = round2(visits.reduce(function (sum, r) { return sum + (r.travelHours || 0); }, 0));
    var isFieldDay = visits.length > 0;
    var type = isFieldDay ? dayTypeFromHours(dailyProd, true) : nonVisitDayLabel(statuses);
    var valid = type === "Green" || type === "Red";
    var baseTown = rmInfo && rmInfo.baseTown ? collapseSpaces(rmInfo.baseTown).toLowerCase() : "";
    var baseTownDay = false;
    if (valid && baseTown && towns.length === 1 && towns[0].toLowerCase() === baseTown) {
      baseTownDay = true;
    }
    var d = parseISODate(g.dateISO);
    return {
      rmName: g.rmName,
      dateISO: g.dateISO,
      dayName: d ? weekdayShort(d) : "",
      status: isFieldDay ? "Market Visit" : (statuses[0] || ""),
      statuses: statuses.join(", "),
      towns: towns.join(", "),
      townList: towns,
      visitCount: visits.length,
      dailyProdHours: isFieldDay ? dailyProd : null,
      dailyTripHours: isFieldDay ? dailyTrip : null,
      dailyTravelHours: isFieldDay ? dailyTravel : null,
      isFieldDay: isFieldDay,
      isValidVisitDay: valid,
      dayType: type,
      isGreen: type === "Green",
      isRed: type === "Red",
      isInvalid: type === "Invalid",
      isLeave: !isFieldDay && statusKey(type) === STATUS_LEAVE,
      isMeeting: !isFieldDay && statusKey(type) === STATUS_MEETING,
      isOfficework: !isFieldDay && statusKey(type) === STATUS_OFFICE,
      isTransit: !isFieldDay && statusKey(type) === STATUS_TRANSIT,
      baseTownDay: baseTownDay,
      rows: g.rows
    };
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
function summarizeRmMonth(rmMasterRow, visitRows, territoryRows) {
  var rmName = rmMasterRow.rmName;
  var region = rmMasterRow.region;
  var days = buildDayRecords(visitRows, rmMasterRow);
  var enriched = (visitRows || []).map(enrichVisitRow);
  var visits = enriched.filter(function (r) { return r.isVisit; });

  var target = Number(rmMasterRow.targetVisits) || 0;
  var leaveDays = countTrue(days, "isLeave");
  var adjustedTarget = target - leaveDays;
  var achieved = countTrue(days, "isValidVisitDay");
  var achievementPct = adjustedTarget > 0 ? pct(achieved, adjustedTarget) : null;

  var uniqueTowns = uniqueSorted(visits.map(function (r) { return r.visitedTown; }));
  var fieldDays = countTrue(days, "isFieldDay");
  var greenDays = countTrue(days, "isGreen");
  var redDays = countTrue(days, "isRed");
  var invalidDays = countTrue(days, "isInvalid");
  var baseTownDays = countTrue(days, "baseTownDay");

  var planMatchCount = visits.filter(function (r) { return r.planMatch; }).length;
  var planAdherence = visits.length ? pct(planMatchCount, visits.length) : null;
  var planDeviation = planAdherence == null ? null : round2(100 - planAdherence);

  var totalTrip = round2(visits.reduce(function (s, r) { return s + (r.tripHours || 0); }, 0));
  var totalProd = round2(visits.reduce(function (s, r) { return s + (r.prodHours || 0); }, 0));
  var totalTravel = round2(visits.reduce(function (s, r) { return s + (r.travelHours || 0); }, 0));
  var avgTrip = fieldDays ? round2(totalTrip / fieldDays) : null;
  var avgProd = fieldDays ? round2(totalProd / fieldDays) : null;
  var avgTravel = fieldDays ? round2(totalTravel / fieldDays) : null;

  var regionTowns = townsInRegion(territoryRows, region);
  var regionTownNames = uniqueSorted(regionTowns.map(function (t) { return t.town; }));
  var visitedSet = {};
  uniqueTowns.forEach(function (t) { visitedSet[t.toLowerCase()] = true; });

  var townsVisitedInRegion = regionTownNames.filter(function (t) {
    return visitedSet[t.toLowerCase()];
  });
  var townsNotVisited = regionTownNames.filter(function (t) {
    return !visitedSet[t.toLowerCase()];
  });

  var territories = uniqueSorted(regionTowns.map(function (t) { return t.territory; }));
  var territoriesNotVisited = territories.filter(function (ter) {
    var towns = regionTowns.filter(function (t) {
      return collapseSpaces(t.territory).toLowerCase() === collapseSpaces(ter).toLowerCase();
    });
    return !towns.some(function (t) { return visitedSet[collapseSpaces(t.town).toLowerCase()]; });
  });

  var visitsPerTown = {};
  var visitsPerTerritory = {};
  visits.forEach(function (r) {
    var town = collapseSpaces(r.visitedTown);
    if (town) visitsPerTown[town] = (visitsPerTown[town] || 0) + 1;
    var rec = regionTowns.find(function (t) {
      return collapseSpaces(t.town).toLowerCase() === town.toLowerCase();
    });
    var ter = rec ? rec.territory : collapseSpaces(r.territory);
    if (ter) visitsPerTerritory[ter] = (visitsPerTerritory[ter] || 0) + 1;
  });

  function dictText(obj) {
    return Object.keys(obj).sort().map(function (k) { return k + ": " + obj[k]; }).join(", ");
  }

  return {
    rmName: rmName,
    region: region,
    baseTown: rmMasterRow.baseTown,
    target: target,
    leaveDays: leaveDays,
    adjustedTarget: adjustedTarget,
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
    meetingDays: countTrue(days, "isMeeting"),
    officeworkDays: countTrue(days, "isOfficework"),
    transitDays: countTrue(days, "isTransit"),
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
    territoriesNotVisited: territoriesNotVisited.length,
    territoriesNotVisitedList: territoriesNotVisited.join(", "),
    townsNotVisited: townsNotVisited.length,
    townsNotVisitedList: townsNotVisited.join(", "),
    coveragePct: regionTownNames.length ? pct(townsVisitedInRegion.length, regionTownNames.length) : null,
    coverageLabel: regionTownNames.length ? formatPct(pct(townsVisitedInRegion.length, regionTownNames.length)) : "—",
    visitsPerTerritory: dictText(visitsPerTerritory),
    visitsPerTown: dictText(visitsPerTown),
    days: days
  };
}

function summarizeMonth(monthKey, visitRows, rmPacks, territoryRows) {
  var wantMonth = monthNumberFromKey(monthKey);
  var pack = (rmPacks || []).find(function (p) { return String(p.month) === wantMonth; });
  var rms = pack ? pack.rows.slice() : [];
  var summaries = rms.map(function (rm) {
    var rows = (visitRows || []).filter(function (v) {
      var name = v.matchedRmName || v.managerName;
      return namesLikelySame(name, rm.rmName);
    });
    return summarizeRmMonth(rm, rows, territoryRows || []);
  });

  var unmatched = uniqueSorted((visitRows || []).filter(function (v) {
    return !v.matchedRmName;
  }).map(function (v) { return v.managerName; }));

  unmatched.forEach(function (name) {
    var fake = { rmName: name, region: "", baseTown: "", targetVisits: 0 };
    var rows = visitRows.filter(function (v) {
      return !v.matchedRmName && namesLikelySame(v.managerName, name);
    });
    var s = summarizeRmMonth(fake, rows, territoryRows || []);
    s.unmatched = true;
    summaries.push(s);
  });

  return summaries;
}
