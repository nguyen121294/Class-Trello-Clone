import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireFeature } from "../../middleware/featureFlags.js";
import * as orgsService from "./organizations.service.js";

export const organizationsRouter = Router();

// Lãnh đạo giám sát (Executive) xem Dashboard Overview toàn công ty
organizationsRouter.get(
  "/executive/overview",
  authenticate,
  requireFeature("module_executive_dashboard"),
  async (req, res, next) => {
    try {
      const overview = await orgsService.getExecutiveOverview(req.user);
      res.json(overview);
    } catch (err) {
      next(err);
    }
  }
);

// Quản trị Platform Owner / Super Admin
organizationsRouter.get(
  "/organizations",
  authenticate,
  authorize("system.manage_settings"),
  async (_req, res, next) => {
    try {
      const orgs = await orgsService.listOrganizations();
      res.json(orgs);
    } catch (err) {
      next(err);
    }
  }
);

organizationsRouter.post(
  "/organizations",
  authenticate,
  authorize("system.manage_settings"),
  async (req, res, next) => {
    try {
      const org = await orgsService.createOrganization(req.body);
      res.status(201).json(org);
    } catch (err) {
      next(err);
    }
  }
);

organizationsRouter.get(
  "/organizations/:id",
  authenticate,
  async (req, res, next) => {
    try {
      const org = await orgsService.getOrganizationById(req.params.id);
      res.json(org);
    } catch (err) {
      next(err);
    }
  }
);
