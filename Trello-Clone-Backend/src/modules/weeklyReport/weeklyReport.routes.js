import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireFeature } from "../../middleware/featureFlags.js";
import { prisma } from "../../config/db.js";
import * as weeklyService from "./weeklyReport.service.js";
import { generateWeeklyReportHtml } from "./pdfExport.service.js";

export const weeklyReportRouter = Router();

// Nút bấm cốt lõi: "⚡ Tạo Báo Cáo Tuần Tự Động"
weeklyReportRouter.post(
  "/boards/:boardId/weekly-reports/auto-generate",
  authenticate,
  requireFeature("module_weekly_report"),
  async (req, res, next) => {
    try {
      const report = await weeklyService.autoGenerateWeeklyReport(
        req.params.boardId,
        req.user.id
      );
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

// Lấy danh sách các kỳ báo cáo của Board
weeklyReportRouter.get(
  "/boards/:boardId/weekly-reports",
  authenticate,
  requireFeature("module_weekly_report"),
  async (req, res, next) => {
    try {
      const list = await weeklyService.listWeeklyReports(req.params.boardId);
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
);

// Chi tiết 1 bản báo cáo tuần
weeklyReportRouter.get(
  "/weekly-reports/:id",
  authenticate,
  requireFeature("module_weekly_report"),
  async (req, res, next) => {
    try {
      const details = await weeklyService.getWeeklyReportDetails(req.params.id);
      res.json(details);
    } catch (err) {
      next(err);
    }
  }
);

// Cập nhật nội dung báo cáo tuần
weeklyReportRouter.put(
  "/weekly-reports/:id",
  authenticate,
  requireFeature("module_weekly_report"),
  async (req, res, next) => {
    try {
      const updated = await weeklyService.updateWeeklyReport(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// Xuất file PDF / Trang in chuẩn mẫu TMS
weeklyReportRouter.get(
  "/weekly-reports/:id/pdf",
  authenticate,
  requireFeature("module_weekly_report"),
  async (req, res, next) => {
    try {
      const report = await weeklyService.getWeeklyReportDetails(req.params.id);
      const board = await prisma.board.findUnique({
        where: { id: report.boardId },
        select: { name: true },
      });
      const html = generateWeeklyReportHtml(report, board);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      next(err);
    }
  }
);

// Form check-in / Chấm công tuần cho thành viên
weeklyReportRouter.post(
  "/boards/:boardId/checkins",
  authenticate,
  async (req, res, next) => {
    try {
      const result = await weeklyService.submitMemberCheckin(
        req.params.boardId,
        req.user.id,
        req.body
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Lấy danh sách checkin tuần cho PM xem
weeklyReportRouter.get(
  "/boards/:boardId/checkins",
  authenticate,
  async (req, res, next) => {
    try {
      const list = await weeklyService.listMemberCheckins(
        req.params.boardId,
        req.query.weekNumber,
        req.query.year
      );
      res.json(list);
    } catch (err) {
      next(err);
    }
  }
);
