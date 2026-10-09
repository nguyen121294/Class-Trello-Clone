import * as service from "./apiKeys.service.js";
import {
  createApiKeySchema,
  updateApiKeySchema,
  adminUpdateLimitsSchema,
  adminRevokeKeySchema,
  adminSettingsSchema,
} from "./apiKeys.schema.js";

// -----------------------------------------------------------------------------
// User Controllers
// -----------------------------------------------------------------------------

export const getScopes = async (_req, res) => {
  res.json(service.getAvailableScopes());
};

export const listUserKeys = async (req, res) => {
  res.json(await service.listUserKeys(req.user.id));
};

export const createKey = async (req, res) => {
  const input = createApiKeySchema.parse(req.body);
  const result = await service.createKey(req.user.id, input);
  res.status(201).json(result);
};

export const updateUserKey = async (req, res) => {
  const input = updateApiKeySchema.parse(req.body);
  const result = await service.updateUserKey(req.user.id, req.params.id, input);
  res.json(result);
};

export const revokeUserKey = async (req, res) => {
  const result = await service.revokeUserKey(req.user.id, req.params.id);
  res.json(result);
};

// -----------------------------------------------------------------------------
// Admin Controllers
// -----------------------------------------------------------------------------

export const listAdminKeys = async (req, res) => {
  const { page, limit, status, q } = req.query;
  res.json(await service.listAdminKeys({ page, limit, status, q }));
};

export const getAdminKey = async (req, res) => {
  res.json(await service.getAdminKey(req.params.id));
};

export const revokeAdminKey = async (req, res) => {
  const { reason } = adminRevokeKeySchema.parse(req.body);
  const result = await service.revokeAdminKey(req.params.id, reason, req.user.id);
  res.json(result);
};

export const updateAdminKeyLimits = async (req, res) => {
  const input = adminUpdateLimitsSchema.parse(req.body);
  const result = await service.updateAdminKeyLimits(req.params.id, input);
  res.json(result);
};

export const getAdminSettings = async (_req, res) => {
  res.json(await service.getAdminSettings());
};

export const updateAdminSettings = async (req, res) => {
  const input = adminSettingsSchema.parse(req.body);
  const result = await service.updateAdminSettings(input, req.user.id);
  res.json(result);
};
