import { prisma } from "../../config/db.js";
import { NotFound, BadRequest } from "../../lib/errors.js";

/**
 * Tiện ích tính số tuần trong năm (ISO 8601)
 */
export function getISOWeekNumber(date = new Date()) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

/**
 * Lấy ngày đầu tuần (Thứ Hai) và cuối tuần (Chủ Nhật)
 */
export function getWeekDateRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

/**
 * Nút bấm cốt lõi: "TẠO BÁO CÁO TUẦN TỰ ĐỘNG"
 */
export async function autoGenerateWeeklyReport(boardId, userId) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      milestones: {
        where: { targetDate: { gte: new Date() } },
        orderBy: { targetDate: "asc" },
        take: 1,
      },
    },
  });

  if (!board) throw NotFound("Không tìm thấy dự án (Board).");

  const today = new Date();
  const weekNumber = getISOWeekNumber(today);
  const year = today.getFullYear();
  const { monday, sunday } = getWeekDateRange(today);

  // 1. Kiểm tra xem tuần này đã có bản nháp chưa
  let report = await prisma.weeklyReport.findUnique({
    where: {
      boardId_weekNumber_year: {
        boardId,
        weekNumber,
        year,
      },
    },
    include: { tasks: true },
  });

  // 2. Tìm Milestone gần nhất
  const nearMilestone = board.milestones?.[0] || null;

  // 3. Tính số tuần tới Golive
  let weeksToGolive = null;
  if (board.goliveDate) {
    const diffMs = new Date(board.goliveDate).getTime() - today.getTime();
    weeksToGolive = Math.max(0, Number((diffMs / (1000 * 60 * 60 * 24 * 7)).toFixed(1)));
  }

  // 4. Nếu chưa có báo cáo tuần này, tạo mới và quét task tuần trước
  if (!report) {
    report = await prisma.weeklyReport.create({
      data: {
        boardId,
        weekNumber,
        year,
        startDate: monday,
        endDate: sunday,
        nearMilestoneId: nearMilestone?.id || null,
        weeksToGolive,
        status: "draft",
        createdById: userId,
        meetings: [],
      },
    });

    // Quét báo cáo của tuần trước (nếu có)
    const prevWeek = weekNumber > 1 ? weekNumber - 1 : 52;
    const prevYear = weekNumber > 1 ? year : year - 1;

    const prevReport = await prisma.weeklyReport.findUnique({
      where: {
        boardId_weekNumber_year: {
          boardId,
          weekNumber: prevWeek,
          year: prevYear,
        },
      },
      include: {
        tasks: {
          include: { card: { include: { assignees: true } } },
        },
      },
    });

    const reportTasksToCreate = [];

    // Xử lý các task từ tuần trước
    if (prevReport?.tasks?.length) {
      for (const t of prevReport.tasks) {
        const card = t.card;
        const isDone = card.status?.toLowerCase() === "done" || t.statusText === "Done";

        // Bản ghi thể hiện kết quả tuần trước đã làm
        reportTasksToCreate.push({
          reportId: report.id,
          cardId: card.id,
          scopeType: "last_week",
          moduleName: t.moduleName || null,
          expectedResult: card.expectedResult || t.expectedResult || "Hoàn thành theo cam kết",
          internalPicsText: t.internalPicsText || "Team DEV",
          clientPicsText: t.clientPicsText || "Foodlog PIC",
          statusText: isDone ? "Done" : "Doing",
          progressEvaluation: isDone ? "Đúng tiến độ" : "Đang xử lý dở dang",
          isCarriedOver: false,
        });

        // NẾU CHƯA XONG: Tự động chuyển giao (Rollover) sang kế hoạch tuần này mà không cần chọn lại!
        if (!isDone) {
          reportTasksToCreate.push({
            reportId: report.id,
            cardId: card.id,
            scopeType: "this_week",
            moduleName: t.moduleName || null,
            expectedResult: card.expectedResult || t.expectedResult || "Tiếp tục hoàn thiện",
            internalPicsText: t.internalPicsText || "Team DEV",
            clientPicsText: t.clientPicsText || "Foodlog PIC",
            statusText: "Doing",
            progressEvaluation: "Chuyển tiếp từ tuần trước",
            isCarriedOver: true,
          });
        }
      }
    } else {
      // Nếu chưa có báo cáo tuần trước, lấy các thẻ đang thực hiện trong board
      const activeCards = await prisma.card.findMany({
        where: {
          list: { boardId },
          archived: false,
        },
        include: { assignees: true },
        take: 8,
      });

      for (const card of activeCards) {
        const internalPics = card.assignees
          ?.filter((a) => a.assigneeType === "internal")
          .map((a) => a.externalName || "Dev")
          .join(", ") || "Smartlog PIC";

        const clientPics = card.assignees
          ?.filter((a) => a.assigneeType === "client")
          .map((a) => a.externalName || "Client")
          .join(", ") || "Foodlog PIC";

        reportTasksToCreate.push({
          reportId: report.id,
          cardId: card.id,
          scopeType: "this_week",
          expectedResult: card.expectedResult || "Hoàn thành tính năng",
          internalPicsText: internalPics,
          clientPicsText: clientPics,
          statusText: card.status || "Doing",
          progressEvaluation: "Đúng tiến độ",
          isCarriedOver: false,
        });
      }
    }

    if (reportTasksToCreate.length > 0) {
      await prisma.weeklyReportTask.createMany({
        data: reportTasksToCreate,
      });
    }
  }

  return getWeeklyReportDetails(report.id);
}

export async function getWeeklyReportDetails(reportId) {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: {
      nearMilestone: true,
      tasks: {
        include: {
          card: {
            select: { id: true, title: true, status: true, dueDate: true, jiraUrl: true },
          },
        },
      },
    },
  });

  if (!report) throw NotFound("Không tìm thấy báo cáo tuần.");
  return report;
}

export async function listWeeklyReports(boardId) {
  return prisma.weeklyReport.findMany({
    where: { boardId },
    orderBy: [{ year: "desc" }, { weekNumber: "desc" }],
    include: {
      nearMilestone: { select: { title: true, targetDate: true } },
      _count: { select: { tasks: true } },
    },
  });
}

export async function updateWeeklyReport(reportId, data) {
  const { meetings, tasks, status, weeksToGolive, nearMilestoneId } = data;

  const updatePayload = {};
  if (meetings !== undefined) updatePayload.meetings = meetings;
  if (status !== undefined) updatePayload.status = status;
  if (weeksToGolive !== undefined) updatePayload.weeksToGolive = weeksToGolive;
  if (nearMilestoneId !== undefined) updatePayload.nearMilestoneId = nearMilestoneId;

  await prisma.weeklyReport.update({
    where: { id: reportId },
    data: updatePayload,
  });

  // Cập nhật tasks nếu có
  if (tasks && Array.isArray(tasks)) {
    for (const t of tasks) {
      if (t.id) {
        await prisma.weeklyReportTask.update({
          where: { id: t.id },
          data: {
            scopeType: t.scopeType,
            moduleName: t.moduleName,
            expectedResult: t.expectedResult,
            internalPicsText: t.internalPicsText,
            clientPicsText: t.clientPicsText,
            statusText: t.statusText,
            progressEvaluation: t.progressEvaluation,
          },
        });
      }
    }
  }

  return getWeeklyReportDetails(reportId);
}

// ===== Form Chấm công / Check-in Tuần cho Thành viên =====

export async function submitMemberCheckin(boardId, userId, { weekNumber, year, doneText, planText, blockerText, hoursWorked }) {
  if (!doneText || !planText) {
    throw BadRequest("Vui lòng điền nội dung 'Tuần này đã làm gì' và 'Tuần tới sẽ làm gì'.");
  }

  const wNum = weekNumber || getISOWeekNumber(new Date());
  const yNum = year || new Date().getFullYear();

  return prisma.memberWeeklyCheckin.upsert({
    where: {
      boardId_userId_weekNumber_year: {
        boardId,
        userId,
        weekNumber: wNum,
        year: yNum,
      },
    },
    create: {
      boardId,
      userId,
      weekNumber: wNum,
      year: yNum,
      doneText: doneText.trim(),
      planText: planText.trim(),
      blockerText: blockerText?.trim() || null,
      hoursWorked: hoursWorked ? Number(hoursWorked) : null,
      status: "submitted",
    },
    update: {
      doneText: doneText.trim(),
      planText: planText.trim(),
      blockerText: blockerText?.trim() || null,
      hoursWorked: hoursWorked ? Number(hoursWorked) : null,
      status: "submitted",
    },
  });
}

export async function listMemberCheckins(boardId, weekNumber, year) {
  const wNum = weekNumber ? Number(weekNumber) : getISOWeekNumber(new Date());
  const yNum = year ? Number(year) : new Date().getFullYear();

  return prisma.memberWeeklyCheckin.findMany({
    where: {
      boardId,
      weekNumber: wNum,
      year: yNum,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
}
