import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ah } from "../../middleware/errorHandler.js";
import * as c from "./apiKeys.controller.js";

export const apiKeysRouter = Router();

// Tất cả các route API Key đều yêu cầu người dùng phải đăng nhập trước
apiKeysRouter.use(authenticate);

// -----------------------------------------------------------------------------
// 1. Phân hệ Người Dùng Tự Phục Vụ (Self-Service)
// -----------------------------------------------------------------------------

// Lấy danh sách các scope hợp lệ
apiKeysRouter.get("/scopes", ah(c.getScopes));

// Danh sách các API Key của chính mình
apiKeysRouter.get("/me", ah(c.listUserKeys));

// Tạo API Key mới (trả về plaintext 1 lần duy nhất)
apiKeysRouter.post("/me", ah(c.createKey));

// Đổi tên hoặc cập nhật scopes của key
apiKeysRouter.patch("/me/:id", ah(c.updateUserKey));

// Thu hồi (revoke) key của chính mình
apiKeysRouter.delete("/me/:id", ah(c.revokeUserKey));

// -----------------------------------------------------------------------------
// 2. Phân hệ Quản Trị Hệ Thống (Admin Governance) — Yêu cầu quyền Quản trị
// -----------------------------------------------------------------------------

// Lấy chính sách & cấu hình hạn ngạch hệ thống (max keys, default rate limit...)
apiKeysRouter.get("/admin/settings", authorize("system.manage_settings"), ah(c.getAdminSettings));

// Cập nhật chính sách & cấu hình hạn ngạch hệ thống
apiKeysRouter.patch("/admin/settings", authorize("system.manage_settings"), ah(c.updateAdminSettings));

// Xem danh sách toàn bộ API Key trong toàn hệ thống
apiKeysRouter.get("/admin", authorize("system.manage_settings"), ah(c.listAdminKeys));

// Xem chi tiết 1 API Key
apiKeysRouter.get("/admin/:id", authorize("system.manage_settings"), ah(c.getAdminKey));

// Thu hồi khẩn cấp bất kỳ API Key nào
apiKeysRouter.post("/admin/:id/revoke", authorize("system.manage_settings"), ah(c.revokeAdminKey));

// Điều chỉnh riêng hạn mức Rate Limit và ngày hết hạn của 1 key
apiKeysRouter.patch("/admin/:id/limits", authorize("system.manage_settings"), ah(c.updateAdminKeyLimits));
