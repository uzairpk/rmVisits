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
    ["Same-territory town minimum", SOP.sameTerritoryHrs + " hrs if ≥ " + SOP.sameTerritoryTowns + " towns in that territory reach " + SOP.sameTerritoryHrs],
    ["Late start default", SOP.lateStartDefault],
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

function sopTerritoryExamples() {
  return [
    {
      label: "JLM: Jhelum " + SOP.sameTerritoryHrs + "+, Lalamusa 2.97",
      towns: [
        { name: "Jhelum", territory: "JLM", hours: 1.88 },
        { name: "Lalamusa", territory: "JLM", hours: 2.97 }
      ],
      total: 6.1
    },
    {
      label: "PSW: Nowshera 1.58, Peshawar 1.25",
      towns: [
        { name: "Nowshera", territory: "PSW", hours: 1.58 },
        { name: "Peshawar", territory: "PSW", hours: 1.25 }
      ],
      total: 6.0
    },
    {
      label: "SKG: Daska " + SOP.sameTerritoryHrs.toFixed(2) + ", Pasroor 0.93, Qila Kalar 3.08",
      towns: [
        { name: "Daska", territory: "SKG", hours: SOP.sameTerritoryHrs },
        { name: "Pasroor", territory: "SKG", hours: 0.93 },
        { name: "Qila Kalarwala", territory: "SKG", hours: 3.08 }
      ],
      total: 7.0
    },
    {
      label: "FSD two towns + CHN 2.2 + JHG 1.8",
      towns: [
        { name: "FSD-3", territory: "FSD", hours: 1.6 },
        { name: "FSD-4", territory: "FSD", hours: 1.7 },
        { name: "Chiniot", territory: "CHN", hours: 2.2 },
        { name: "Jhang", territory: "JHG", hours: 1.8 }
      ],
      total: 8.0
    },
    {
      label: "KWL two towns, day total 4.6",
      towns: [
        { name: "Kacha Khu", territory: "KWL", hours: 1.7 },
        { name: "Vejianwala", territory: "KWL", hours: 1.6 }
      ],
      total: 4.6
    },
    {
      label: "SKT: Sialkot 1.8 (one town)",
      towns: [{ name: "Sialkot", territory: "SKT", hours: 1.8 }],
      total: 6.0
    }
  ];
}

function sopMinsForGroups(towns) {
  const by = {};
  (towns || []).forEach((t) => {
    const k = t.territory || "";
    if (!by[k]) by[k] = [];
    by[k].push(t);
  });
  return Object.keys(by).sort().map((ter) => {
    const reached = by[ter].filter((t) => t.hours >= SOP.sameTerritoryHrs).length;
    const min = reached >= SOP.sameTerritoryTowns ? SOP.sameTerritoryHrs : SOP.minTownHrs;
    return ter + " " + min;
  }).join(", ");
}

function renderSopDayJudged() {
  const steps = [
    "Is it a Market Visit day? If yes, other statuses that day do not add extra day counts.",
    "Group the day's towns by territory.",
    "In a territory where at least " + SOP.sameTerritoryTowns + " towns have ≥ " + SOP.sameTerritoryHrs +
      " productive hrs, the town minimum is " + SOP.sameTerritoryHrs + " hrs. Otherwise the minimum is " +
      SOP.minTownHrs + " hrs.",
    "A Counted Town meets that territory's minimum. Is there at least one Counted Town?",
    "Is Daily Total Hrs (first start to last end, including travel) ≥ " + SOP.minDayTotalHrs + "?",
    "Both yes → Valid. Otherwise Invalid, with the matching reason(s)."
  ];
  const flow = '<ol class="sop-flow">' + steps.map((s) => "<li>" + sopEsc(s) + "</li>").join("") + "</ol>";
  const note = "<p class=\"muted\">Town minimums are always on productive time; the " + sopEsc(SOP.minDayTotalHrs) +
    " hrs per day rule is on total time. Same-territory rule – Management instruction, Nov 2026.</p>";
  const simple = sopExampleRows().map((ex) => {
    const rec = judgeTownHours(ex.towns, ex.total);
    const verdict = sopJudgeLabel(ex.towns, ex.total);
    return "<tr><td>" + sopEsc(ex.towns.join(", ")) + "</td><td>" + sopEsc(ex.total) +
      "</td><td>" + rec.counted + '</td><td class="' + verdict.cls + '">' + sopEsc(verdict.text) + "</td></tr>";
  }).join("");
  const simpleTable = "<p><strong>Day totals</strong></p>" +
    '<table class="data sop-table"><thead><tr>' +
    "<th>Town productive hrs</th><th>Daily total hrs (incl. travel)</th><th>Counted towns</th><th>Result</th>" +
    "</tr></thead><tbody>" + simple + "</tbody></table>";
  const terRows = sopTerritoryExamples().map((ex) => {
    const rec = judgeTownRecords(ex.towns.map((t) => Object.assign({}, t)), ex.total);
    const mins = sopMinsForGroups(ex.towns);
    const cls = rec.isValid ? "sop-ok" : "sop-bad";
    const text = rec.isValid ? "Valid" : "Invalid (" + rec.reasons.join(", ") + ")";
    return "<tr><td>" + sopEsc(ex.label) + "</td><td>" + sopEsc(mins) + "</td><td>" + rec.counted +
      '</td><td class="' + cls + '">' + sopEsc(text) + "</td></tr>";
  }).join("");
  const terTable = "<p><strong>Same-territory rule – Management instruction, Nov 2026</strong></p>" +
    '<table class="data sop-table"><thead><tr>' +
    "<th>Towns (territory: hrs)</th><th>Minimum per territory</th><th>Counted</th><th>Day</th>" +
    "</tr></thead><tbody>" + terRows + "</tbody></table>";
  return sopCard("How a day is judged", flow + note + simpleTable + terTable);
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
    "<li><strong>Towns Repeated (" + SOP.townCoverageMonths + "M)</strong> — distinct Counted Towns this month that were also Counted Towns in any of the previous " +
    (SOP.townCoverageMonths - 1) + " months. Shown as x / y (y = distinct Counted Towns this month). " +
    "— with “Upload earlier months to see repeats” if no earlier month exists.</li>" +
    "</ul><p class=\"muted\">Coverage uses Counted Towns only.</p>"
  );
}

function renderSopGlossary() {
  const items = [
    ["Counted Town", "A town whose productive hours meet its territory's minimum that day: " +
      SOP.sameTerritoryHrs + " hrs if at least " + SOP.sameTerritoryTowns + " towns in that territory reached " +
      SOP.sameTerritoryHrs + " hrs, otherwise " + SOP.minTownHrs + " hrs. Towns under the minimum are shown but are not a market visit and do not count as visited."],
    ["Outside Base Day", "A Valid Day with at least one Counted Town that is not a base town."],
    ["Base-only Day", "A Valid Day where every Counted Town is a base town. At most " + SOP.maxBaseOnlyDays + " of these count toward target."],
    ["Base Town Visit", "A Valid Day where at least one Counted Town is a base town (info count)."],
    ["Invalid Day", "A Market Visit day that is not Valid: total under " + SOP.minDayTotalHrs + " hrs and/or no counted town."],
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
