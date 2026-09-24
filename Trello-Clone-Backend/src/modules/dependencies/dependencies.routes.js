import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireFeature } from "../../middleware/featureFlags.js";
import * as depService from "./dependencies.service.js";

export const dependenciesRouter = Router();

dependenciesRouter.get(
  "/boards/:boardId/dependencies",
  authenticate,
  requireFeature("module_gantt"),
  async (req, res, next) => {
    try {
      const items = await depService.listDependencies(req.params.boardId);
      res.json(items);
    } catch (err) {
      next(err);
    }
  }
);

dependenciesRouter.post(
  "/dependencies",
  authenticate,
  requireFeature("module_gantt"),
  async (req, res, next) => {
    try {
      const item = await depService.addDependency(req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  }
);

dependenciesRouter.delete(
  "/dependencies/:id",
  authenticate,
  requireFeature("module_gantt"),
  async (req, res, next) => {
    try {
      await depService.removeDependency(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

// Kéo thả Gantt Mode 1: Cascade Push
dependenciesRouter.post(
  "/cards/:cardId/gantt-cascade",
  authenticate,
  requireFeature("module_gantt"),
  async (req, res, next) => {
    try {
      const result = await depService.cascadePushGanttTask(req.params.cardId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
