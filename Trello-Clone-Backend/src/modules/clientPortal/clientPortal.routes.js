import { Router } from "express";
import { requireFeature } from "../../middleware/featureFlags.js";
import * as portalService from "./clientPortal.service.js";

export const clientPortalRouter = Router();

// Endpoint công khai an toàn cho khách xem bảng và Gantt chart
clientPortalRouter.get(
  "/portal/boards/:boardId",
  requireFeature("module_client_portal"),
  async (req, res, next) => {
    try {
      const data = await portalService.getClientBoardData(req.params.boardId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);
