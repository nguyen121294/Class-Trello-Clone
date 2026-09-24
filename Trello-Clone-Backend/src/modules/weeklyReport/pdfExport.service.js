/**
 * PDF / Print HTML Generator Service
 * Chuẩn hóa 100% theo mẫu file thực tế: W23 - 27_06_22 - Weekly Report _TMS Project.pptx
 */

export function generateWeeklyReportHtml(report, board) {
  const lastWeekTasks = report.tasks?.filter((t) => t.scopeType === "last_week") || [];
  const thisWeekTasks = report.tasks?.filter((t) => t.scopeType === "this_week") || [];
  const meetings = Array.isArray(report.meetings) ? report.meetings : [];

  const nearMilestoneTitle = report.nearMilestone?.title || "Chưa xác định";
  const weeksToGoliveText = report.weeksToGolive ? `${report.weeksToGolive} tuần` : "Chưa ấn định";

  const renderTableRows = (tasks) => {
    if (!tasks || tasks.length === 0) {
      return `<tr><td colspan="7" style="text-align: center; color: #888; padding: 16px;">Không có công việc nào trong danh sách.</td></tr>`;
    }

    return tasks
      .map(
        (t) => `
      <tr>
        <td style="font-size: 11px; white-space: nowrap;">${t.card?.dueDate ? new Date(t.card.dueDate).toLocaleDateString("vi-VN") : "Trong tuần"}</td>
        <td style="font-weight: 500;">
          ${t.card?.title || t.moduleName || "Công việc"}
          ${t.isCarriedOver ? `<span class="badge badge-carry">Chuyển tiếp</span>` : ""}
        </td>
        <td>${t.expectedResult || "-"}</td>
        <td style="font-weight: 500; color: #0284c7;">${t.internalPicsText || "Smartlog PIC"}</td>
        <td style="font-weight: 500; color: #16a34a;">${t.clientPicsText || "Foodlog PIC"}</td>
        <td>
          <span class="badge ${t.statusText === "Done" ? "badge-done" : "badge-doing"}">
            ${t.statusText || "Doing"}
          </span>
        </td>
        <td style="${t.progressEvaluation?.includes("Trễ") ? "color: #dc2626; font-weight: 600;" : "color: #16a34a;"}">
          ${t.progressEvaluation || "Đúng tiến độ"}
        </td>
      </tr>
    `
      )
      .join("");
  };

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo cáo tuần ${report.weekNumber} - ${board?.name || "Dự án"}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .slide-page {
      page-break-after: always;
      min-height: 180mm;
      box-sizing: border-box;
      padding: 10px 0;
    }
    .slide-page:last-child {
      page-break-after: auto;
    }
    .header-banner {
      background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%);
      color: #fff;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .header-banner h1 {
      margin: 0 0 6px 0;
      font-size: 24px;
      letter-spacing: -0.5px;
    }
    .header-banner p {
      margin: 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
    }
    .kpi-card .label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .kpi-card .value {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      border-left: 4px solid #0284c7;
      padding-left: 10px;
      margin: 20px 0 12px 0;
      text-transform: uppercase;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }
    table.data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      border-bottom: 2px solid #cbd5e1;
    }
    table.data-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
    }
    table.data-table tr:hover {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-done { background: #dcfce7; color: #15803d; }
    .badge-doing { background: #e0f2fe; color: #0369a1; }
    .badge-carry { background: #fef3c7; color: #b45309; margin-left: 6px; }
    .footer {
      margin-top: 30px;
      font-size: 10px;
      color: #94a3b8;
      text-align: right;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>

  <!-- SLIDE 1: BÌA & TỔNG QUAN -->
  <div class="slide-page">
    <div class="header-banner">
      <h1>BÁO CÁO TUẦN ${report.weekNumber} (${new Date(report.startDate).toLocaleDateString("vi-VN")} - ${new Date(report.endDate).toLocaleDateString("vi-VN")})</h1>
      <p>DỰ ÁN TRIỂN KHAI: <strong>${board?.name || "HỆ THỐNG QUẢN TRỊ DỰ ÁN"}</strong></p>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Cột mốc gần nhất (Milestone)</div>
        <div class="value">${nearMilestoneTitle}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Đếm ngược tới Golive</div>
        <div class="value" style="color: #0284c7;">${weeksToGoliveText}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Trạng thái báo cáo</div>
        <div class="value" style="color: #16a34a;">${report.status === "published" ? "Đã phát hành" : "Bản nháp (Draft)"}</div>
      </div>
    </div>

    <div class="section-title">1. Cuộc họp & Trao đổi trong tuần (Meetings & Schedule)</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 15%;">Thời gian</th>
          <th style="width: 45%;">Chủ đề cuộc họp</th>
          <th style="width: 40%;">Thành phần tham dự</th>
        </tr>
      </thead>
      <tbody>
        ${
          meetings.length > 0
            ? meetings
                .map(
                  (m) => `
              <tr>
                <td style="font-weight: 600;">${m.date || "-"}</td>
                <td>${m.topic || "-"}</td>
                <td>${m.attendees || "-"}</td>
              </tr>
            `
                )
                .join("")
            : `<tr><td colspan="3" style="text-align: center; color: #888; padding: 12px;">Không có cuộc họp đặc biệt trong tuần.</td></tr>`
        }
      </tbody>
    </table>

    <div class="footer">Xuất bản từ Trello Clone B2B SaaS • ${new Date().toLocaleDateString("vi-VN")}</div>
  </div>

  <!-- SLIDE 2: CÔNG VIỆC ĐÃ THỰC HIỆN TRONG TUẦN -->
  <div class="slide-page">
    <div class="section-title">2. Các công việc đã thực hiện trong tuần ${report.weekNumber}</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 10%;">Thời gian</th>
          <th style="width: 26%;">Nội dung công việc</th>
          <th style="width: 22%;">Kết quả kỳ vọng</th>
          <th style="width: 14%;">Smartlog PIC</th>
          <th style="width: 14%;">Foodlog PIC</th>
          <th style="width: 7%;">Tình trạng</th>
          <th style="width: 7%;">Tiến độ</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows(lastWeekTasks)}
      </tbody>
    </table>
    <div class="footer">Trang 2 • Báo cáo tuần ${report.weekNumber}</div>
  </div>

  <!-- SLIDE 3: KẾ HOẠCH TUẦN TIẾP THEO -->
  <div class="slide-page">
    <div class="section-title">3. Kế hoạch công việc tuần tiếp theo (Tuần ${report.weekNumber + 1})</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 10%;">Thời gian</th>
          <th style="width: 26%;">Nội dung công việc</th>
          <th style="width: 22%;">Kết quả kỳ vọng</th>
          <th style="width: 14%;">Smartlog PIC</th>
          <th style="width: 14%;">Foodlog PIC</th>
          <th style="width: 7%;">Tình trạng</th>
          <th style="width: 7%;">Tiến độ</th>
        </tr>
      </thead>
      <tbody>
        ${renderTableRows(thisWeekTasks)}
      </tbody>
    </table>
    <div class="footer">Trang 3 • Kế hoạch tuần ${report.weekNumber + 1}</div>
  </div>

</body>
</html>
  `;
}
