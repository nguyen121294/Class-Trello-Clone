import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireFeature } from "../../middleware/featureFlags.js";
import * as milestonesService from "./milestones.service.js";

export const milestonesRouter = Router();

milestonesRouter.get(
  "/boards/:boardId/milestones",
  authenticate,
  requireFeature("module_milestones"),
  async (req, res, next) => {
    try {
      const items = await milestonesService.listMilestones(req.params.boardId);
      res.json(items);
    } catch (err) {
      next(err);
    }
  }
);

milestonesRouter.post(
  "/boards/:boardId/milestones",
  authenticate,
  requireFeature("module_milestones"),
  async (req, res, next) => {
    try {
      const item = await milestonesService.createMilestone(req.params.boardId, req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }
);

milestonesRouter.patch(
  "/milestones/:id",
  authenticate,
  requireFeature("module_milestones"),
  async (req, res, next) => {
    try {
      const item = await milestonesService.updateMilestone(req.params.id, req.body);
      res.json(item);
    } catch (err) {
      next(err);
    }
  }
);

milestonesRouter.delete(
  "/milestones/:id",
  authenticate,
  requireFeature("module_milestones"),
  async (req, res, next) => {
    try {
      await milestonesService.deleteMilestone(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);
