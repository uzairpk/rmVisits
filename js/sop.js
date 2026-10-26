/* Read-only SOP & Rules page (section 5.10). All rule numbers come from SOP. */

function sopEsc(value) {
  return escapeHtml(String(value));
}

function sopOnceInMonths(n) {
  if (n === 1) return "once a month";
  return "once in " + n + " months";
}

function sopJudgeLabel(townHours, dailyTotal) {
  const rec = judgeTownHours(townHours, dailyTotal);
  if (rec.isValid) return { text: "Valid", cls: "sop-ok" };
  return { text: "Invalid (" + rec.reasons.join(", ") + ")", cls: "sop-bad" };
}

function sopExampleRows() {
  return [
    { towns: [3.6], total: 6.1 },
    { towns: [3.2, 1.8], total: 6.4 },
    { towns: [3.0], total: 4.5 },
    { towns: [1.4, 1.3], total: 3.8 },
    { towns: [1.5, 1.5, 1.5, 1.5], total: 7.0 }
  ];
}

function sopLeaveRows() {
  return [0, 1, 2, 3, 5, 10].map((leaves) => ({
    leaves: leaves,
    adj: adjustedTargetFrom(SOP.defaultTarget, leaves)
  }));
}

function sopCard(title, body) {
  return '<article class="card sop-card" data-copy-title="' + sopEsc(title) + '">' +
    '<div class="card-head"><h2>' + sopEsc(title) + "</h2></div>" +
    body + "</article>";
}

function renderSopSource() {
  return sopCard("Source",
    "<p>Based on <strong>" + sopEsc(SOP.sourceDoc) + "</strong>.</p>" +
    "<p class=\"muted\">" + sopEsc(SOP.appVersion) + " · " + sopEsc(SOP.asOf) +
    ". This page is read-only. Rule values are the same constants the dashboard uses.</p>"
  );
}

function renderSopBenchmarks() {
  const rows = [
    ["Working days per month", SOP.workingDays],
    ["Market visit days (default target)", SOP.defaultTarget],
    ["Meetings", SOP.meetings],
    ["Planning / Office Work", SOP.officeWork],
    ["Leaves (in the SOP plan)", SOP.plannedLeaves],
    ["Min productive hrs per town", SOP.minTownHrs],
    ["Min total hrs per day (incl. travel)", SOP.minDayTotalHrs],
    ["Max base-only days counted toward target", SOP.maxBaseOnlyDays],
    ["Territories of the region", sopOnceInMonths(SOP.territoryCoverageMonths)],
    ["Towns of the region", sopOnceInMonths(SOP.townCoverageMonths)]
  ];
  const body = '<table class="data sop-table"><thead><tr><th>Benchmark</th><th>Value</th></tr></thead><tbody>' +
    rows.map((r) => "<tr><td>" + sopEsc(r[0]) + "</td><td>" + sopEsc(r[1]) + "</td></tr>").join("") +
    "</tbody></table>";
  return sopCard("SOP benchmarks", body);
}

function renderSopDayJudged() {
  const steps = [
    "Is it a Market Visit day? If yes, other statuses that day do not add extra day counts.",
    "For each town, sum productive hours. A Counted Town has ≥ " + SOP.minTownHrs + " productive hrs.",
    "Is there at least one Counted Town?",
    "Is Daily Total Hrs (first start to last end, including travel) ≥ " + SOP.minDayTotalHrs + "?",
    "Both yes → Valid. Otherwise Invalid, with the matching reason(s)."
  ];
  const flow = '<ol class="sop-flow">' + steps.map((s) => "<li>" + sopEsc(s) + "</li>").join("") + "</ol>";
  const note = "<p class=\"muted\">The " + sopEsc(SOP.minTownHrs) +
    " hrs per town rule is always on productive time; the " + sopEsc(SOP.minDayTotalHrs) +
    " hrs per day rule is on total time.</p>";
  const rows = sopExampleRows().map((ex) => {
    const rec = judgeTownHours(ex.towns, ex.total);
    const verdict = sopJudgeLabel(ex.towns, ex.total);
    return "<tr><td>" + sopEsc(ex.towns.join(", ")) + "</td><td>" + sopEsc(ex.total) +
      "</td><td>" + rec.counted + '</td><td class="' + verdict.cls + '">' + sopEsc(verdict.text) + "</td></tr>";
  }).join("");
  const table = '<table class="data sop-table"><thead><tr>' +
    "<th>Town productive hrs</th><th>Daily total hrs (incl. travel)</th><th>Counted towns</th><th>Result</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table>";
  return sopCard("How a day is judged", flow + note + table);
}

function renderSopDayTypes() {
  const items = [
    "Any Market Visit row → Valid or Invalid (rules above). Transit / Meeting / Office Work lines on that day do not add to those day counts.",
    "Else Leave → Leave Day",
    "Else Holiday → Holiday Day (weekly off)",
    "Else Meeting → Meeting Day",
    "Else Office Work → Office Work Day",
    "Else Transit → Transit Day",
    "No row at all (up to Data Up To) → Missing Day"
  ];
  return sopCard("Day types and priority",
    "<p>One label per RM per date — never counted twice. Mixed days with a market visit are a market visit day.</p>" +
    '<ol class="sop-flow">' + items.map((s) => "<li>" + sopEsc(s) + "</li>").join("") + "</ol>"
  );
}

function renderSopMonthly() {
  const extra = "Leaves − " + SOP.plannedLeaves;
  const formula = "Leaves ≤ " + SOP.plannedLeaves + " → Adjusted Target = Target (" +
    SOP.plannedLeaves + " leave is already in the SOP plan). " +
    "Leaves > " + SOP.plannedLeaves + " → ROUND( Target × (" + SOP.workingDays + " − (" + extra + ")) ÷ " +
    SOP.workingDays + " ). Holidays do not reduce target.";
  const leaveRows = sopLeaveRows().map((r) =>
    "<tr><td>" + r.leaves + "</td><td>" + SOP.defaultTarget + "</td><td>" + r.adj + "</td></tr>"
  ).join("");
  const leaveTable = "<p>Examples with Target " + sopEsc(SOP.defaultTarget) + ":</p>" +
    '<table class="data sop-table"><thead><tr><th>Leaves</th><th>Target</th><th>Adjusted Target</th></tr></thead><tbody>' +
    leaveRows + "</tbody></table>";
  const behindCut = SOP.paceSlightMin - 1;
  const formulas =
    "<ul class=\"sop-list\">" +
    "<li><strong>Base-only days counted</strong> = min(base-only days, " + SOP.maxBaseOnlyDays +
    "). Excess is Base-only Days Not Counted.</li>" +
    "<li><strong>Achieved</strong> = Outside Base Days + Base-only Days Counted.</li>" +
    "<li><strong>Achievement %</strong> = Achieved ÷ Adjusted Target.</li>" +
    "<li><strong>Expected by Now</strong> = Adjusted Target × (day number of Data Up To ÷ days in month), rounded.</li>" +
    "<li><strong>Pace</strong> = Achieved − Expected by Now. " +
    "≥ " + SOP.paceOnTrackMin + ' <span class="sop-ok">On track</span>; ' +
    SOP.paceSlightMin + " to −1 <span class=\"sop-warn\">Slightly behind</span>; " +
    "≤ " + behindCut + ' <span class="sop-bad">Behind</span>.</li>' +
    "</ul>";
  return sopCard("Monthly formulas", "<p>" + sopEsc(formula) + "</p>" + leaveTable + formulas);
}

function renderSopCoverage() {
  return sopCard("Coverage rules",
    "<ul class=\"sop-list\">" +
    "<li><strong>Territories Not Visited (month)</strong> — territories in the RM's region with no Counted Town in the selected month. Shown as x of y plus names.</li>" +
    "<li><strong>Towns Not Visited (" + SOP.townCoverageMonths + "M)</strong> — towns in the RM's region that are not a Counted Town in any of the last " +
    SOP.townCoverageMonths + " months (selected month and the previous " + (SOP.townCoverageMonths - 1) +
    ", whatever is uploaded). Listed by territory, with which months were included.</li>" +
    "<li><strong>Towns Repeated from Last Month</strong> — Counted Towns this month that were also Counted Towns last month. Shown as x of y towns (y = distinct Counted Towns this month). — if last month is not uploaded.</li>" +
    "</ul><p class=\"muted\">Coverage uses Counted Towns only.</p>"
  );
}

function renderSopGlossary() {
  const items = [
    ["Counted Town", "A town with ≥ " + SOP.minTownHrs + " productive hours that day. Towns under that are shown but are not a market visit and do not count as visited."],
    ["Outside Base Day", "A Valid Day with at least one Counted Town that is not a base town."],
    ["Base-only Day", "A Valid Day where every Counted Town is a base town. At most " + SOP.maxBaseOnlyDays + " of these count toward target."],
    ["Base Town Visit", "A Valid Day where at least one Counted Town is a base town (info count)."],
    ["Invalid Day", "A Market Visit day that is not Valid: total under " + SOP.minDayTotalHrs + " hrs and/or no town ≥ " + SOP.minTownHrs + " hrs."],
    ["Missing Day", "No row at all for that RM on a date up to Data Up To."],
    ["Data Up To", "Last date present in the uploaded visit log for that month."],
    ["Plan Deviation", "A Market Visit row where Planned Town ≠ Tracker Presence (case-insensitive, trimmed)."],
    ["Productive / Travel / Total hrs", "Productive = time in market. Total = earliest to latest time that day. Travel = Total − Productive (never negative)."],
    ["KMs", "Sum of KMs on the day's rows. Blank means no data, not zero."]
  ];
  const body = '<dl class="sop-glossary">' + items.map((it) =>
    "<dt>" + sopEsc(it[0]) + "</dt><dd>" + sopEsc(it[1]) + "</dd>"
  ).join("") + "</dl>";
  return sopCard("Glossary", body);
}

function renderSopPage() {
  const host = document.getElementById("sop-body");
  if (!host) return;
  host.innerHTML = [
    renderSopSource(),
    renderSopBenchmarks(),
    renderSopDayJudged(),
    renderSopDayTypes(),
    renderSopMonthly(),
    renderSopCoverage(),
    renderSopGlossary()
  ].join("");
  if (typeof wireCopyButtons === "function") wireCopyButtons("#sop-body");
}

if (document.getElementById("page-sop") && document.getElementById("page-sop").classList.contains("active")) {
  renderSopPage();
}
