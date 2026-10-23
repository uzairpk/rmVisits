async function reportContext() {
  const visits = await getAllVisitLogs();
  const rms = await getAllRmMaster();
  const terr = await getTerritory();
  return {
    visits: visits,
    rms: rms,
    territory: terr ? terr.rows : []
  };
}

function fillReportMonths(visits) {
  const sel = document.getElementById("report-month");
  const months = visits.map((v) => v.month);
  const prev = sel.value;
  if (!months.length) {
    sel.innerHTML = '<option value="">No months</option>';
    document.getElementById("report-meta").textContent = "Upload a visit log first.";
    return;
  }
  sel.innerHTML = months.map((m) => "<option value=\"" + m + "\">" + monthPretty(m) + "</option>").join("");
  if (prev && months.indexOf(prev) >= 0) sel.value = prev;
  else sel.value = months[months.length - 1];
  document.getElementById("report-meta").textContent = "Month " + monthPretty(sel.value) + ".";
}

async function refreshReports() {
  const ctx = await reportContext();
  fillReportMonths(ctx.visits);
}

function downloadSheet(filename, rows, sheetName) {
  if (typeof XLSX === "undefined") {
    showToast("Excel library missing.", true);
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || "Report");
  XLSX.writeFile(wb, filename);
}

async function selectedReportMonth(ctx) {
  const key = document.getElementById("report-month").value;
  const pack = ctx.visits.find((v) => v.month === key);
  if (!pack) {
    showToast("No visit data for that month.", true);
    return null;
  }
  return {
    month: key,
    pack: pack,
    rows: summarizeMonth(key, pack.rows, ctx.rms, ctx.territory, ctx.visits)
  };
}

async function downloadSummaryReport() {
  const ctx = await reportContext();
  const rec = await selectedReportMonth(ctx);
  if (!rec) return;
  const rows = rec.rows.filter((s) => !s.unmatched).map((s) => ({
    RM: s.rmName,
    Region: s.region,
    "Adj. Target": s.adjustedTarget,
    "Expected by Now": s.expectedByNow,
    Achieved: s.achieved,
    "Ach %": s.achievementPctLabel,
    Pace: s.paceLabel,
    Green: s.greenDays,
    Red: s.redDays,
    Invalid: s.invalidDays,
    "Base Town": s.baseTownDays,
    "Other TTY": s.otherTtyDays,
    Leave: s.leaveDays,
    Holiday: s.holidayDays,
    Meeting: s.meetingDays,
    "Office Work": s.officeworkDays,
    Missing: s.missingDays,
    "Towns not vis. (3M)": (s.townsNotVisited ?? "—") + (s.regionTownCount ? " / " + s.regionTownCount : ""),
    "Plan %": s.planAdherenceLabel,
    "Total KMs": s.totalKmsLabel,
    "Avg KMs / day": s.avgKmsPerVisitDayLabel
  }));
  downloadSheet("rm_monthly_summary_" + rec.month + ".xlsx", rows, "Summary");
  showToast("Summary downloaded.");
}

async function downloadDayReport() {
  const ctx = await reportContext();
  const rec = await selectedReportMonth(ctx);
  if (!rec) return;
  const rows = [];
  rec.rows.filter((s) => !s.unmatched).forEach((s) => {
    (s.days || []).forEach((d) => {
      rows.push({
        RM: s.rmName,
        Region: s.region,
        Date: formatDisplayDate(d.dateISO),
        Day: d.dayName,
        Status: d.status,
        Towns: d.towns || "",
        "Trip start": d.tripStartLabel || "",
        "Trip end": d.tripEndLabel || "",
        "Trip hrs": d.dailyTripHours == null ? "—" : formatHours(d.dailyTripHours),
        "Prod start": d.prodStartLabel || "",
        "Prod end": d.prodEndLabel || "",
        "Prod hrs": d.dailyProdHours == null ? "—" : formatHours(d.dailyProdHours),
        "Travel hrs": d.dailyTravelHours == null ? "—" : formatHours(d.dailyTravelHours),
        "Total hrs": d.dailyTotalHours == null ? "—" : formatHours(d.dailyTotalHours),
        KMs: formatKms(d.dailyKms),
        "Day type": d.dayType,
        "Base town": d.isValidVisitDay ? (d.baseTownDay ? "Yes" : "No") : "—",
        "Plan deviation": d.planDeviationText || "",
        Remarks: d.remarks || ""
      });
    });
  });
  downloadSheet("rm_day_detail_" + rec.month + ".xlsx", rows, "Day detail");
  showToast("Day-wise report downloaded.");
}

async function downloadTownsReport() {
  const ctx = await reportContext();
  const rec = await selectedReportMonth(ctx);
  if (!rec) return;
  const rows = [];
  rec.rows.filter((s) => !s.unmatched).forEach((s) => {
    const grouped = s.townsNotVisitedGrouped || "";
    if (!grouped) {
      rows.push({
        RM: s.rmName,
        Region: s.region,
        Territory: "",
        Town: "",
        Count: "0 / " + (s.regionTownCount || 0),
        Note: s.townsNotVisitedNote || ""
      });
      return;
    }
    grouped.split(" · ").forEach((chunk) => {
      const parts = chunk.split(": ");
      const ter = parts[0] || "";
      const towns = (parts.slice(1).join(": ") || "").split(", ").filter(Boolean);
      towns.forEach((town) => {
        rows.push({
          RM: s.rmName,
          Region: s.region,
          Territory: ter,
          Town: town,
          Count: (s.townsNotVisited ?? "—") + (s.regionTownCount ? " / " + s.regionTownCount : ""),
          Note: s.townsNotVisitedNote || ""
        });
      });
    });
  });
  downloadSheet("towns_not_visited_" + rec.month + ".xlsx", rows, "Not visited");
  showToast("Towns not visited downloaded.");
}

async function downloadLeaveReport() {
  const ctx = await reportContext();
  const rec = await selectedReportMonth(ctx);
  if (!rec) return;
  const rows = [];
  rec.rows.filter((s) => !s.unmatched).forEach((s) => {
    (s.days || []).filter((d) => d.isLeave || d.isHoliday || d.isMeeting).forEach((d) => {
      rows.push({
        RM: s.rmName,
        Region: s.region,
        Date: formatDisplayDate(d.dateISO),
        Day: d.dayName,
        Status: d.status,
        Remarks: d.remarks || ""
      });
    });
  });
  downloadSheet("leave_holiday_meeting_" + rec.month + ".xlsx", rows, "Leave Holiday Meeting");
  showToast("Leave / holiday / meeting report downloaded.");
}

async function downloadPlanReport() {
  const ctx = await reportContext();
  const rec = await selectedReportMonth(ctx);
  if (!rec) return;
  const rows = [];
  rec.pack.rows.forEach((raw) => {
    const row = enrichVisitRow(raw, ctx.territory);
    if (!row.isVisit || !row.planDeviation) return;
    rows.push({
      RM: row.matchedRmName || row.managerName,
      Region: row.region,
      Date: formatDisplayDate(row.dateISO),
      "Planned town": row.plannedTownDisplay || row.plannedTown,
      "Tracker town": row.trackerTownDisplay || row.trackerPresence,
      Remarks: row.remarks || ""
    });
  });
  downloadSheet("plan_deviation_" + rec.month + ".xlsx", rows, "Plan deviation");
  showToast("Plan deviation report downloaded.");
}

document.getElementById("btn-report-summary").addEventListener("click", downloadSummaryReport);
document.getElementById("btn-report-days").addEventListener("click", downloadDayReport);
document.getElementById("btn-report-towns").addEventListener("click", downloadTownsReport);
document.getElementById("btn-report-leave").addEventListener("click", downloadLeaveReport);
document.getElementById("btn-report-plan").addEventListener("click", downloadPlanReport);
document.getElementById("report-month").addEventListener("change", refreshReports);
