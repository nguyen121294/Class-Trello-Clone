import { z } from "zod";

export const AVAILABLE_SCOPES = [
  { key: "workspaces:read", label: "Read Workspaces", desc: "Xem danh sách và thông tin không gian làm việc" },
  { key: "boards:read", label: "Read Boards", desc: "Xem danh sách bảng, cấu hình nhãn, custom fields, thành viên" },
  { key: "lists:read", label: "Read Lists", desc: "Xem các cột và danh sách công việc" },
  { key: "cards:read", label: "Read Cards", desc: "Xem thẻ công việc, checklist, hạn chót, độ ưu tiên" },
  { key: "comments:read", label: "Read Comments", desc: "Đọc bình luận trao đổi trên thẻ" },
  { key: "attachments:read", label: "Read Attachments", desc: "Xem tệp đính kèm và link tải S3" },
  { key: "activity:read", label: "Read Activities", desc: "Xem lịch sử hoạt động và nhật ký thay đổi" },
  { key: "milestones:read", label: "Read Milestones", desc: "Xem các cột mốc dự án và ngày mục tiêu" },
  { key: "gantt:read", label: "Read Gantt & Dependencies", desc: "Xem quan hệ phụ thuộc giữa các công việc" },
  { key: "reports:read", label: "Read Weekly Reports", desc: "Xem các kỳ báo cáo tuần và check-in chấm công" },
  { key: "search:read", label: "Search Content", desc: "Tìm kiếm văn bản trên toàn hệ thống" },
  { key: "me:read", label: "Read Profile & Dashboard", desc: "Xem dashboard cá nhân và thông tin người dùng" },
  { key: "notifications:read", label: "Read Notifications", desc: "Xem thông báo cá nhân" },
  { key: "executive:read", label: "Read Executive Overview", desc: "Xem báo cáo tổng hợp KPI toàn doanh nghiệp" },
];

export const VALID_SCOPE_KEYS = AVAILABLE_SCOPES.map((s) => s.key);

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Tên gợi nhớ là bắt buộc").max(120, "Tên không quá 120 ký tự"),
  scopes: z
    .array(z.string())
    .min(1, "Cần chọn ít nhất 1 quyền hạn (scope)")
    .refine((scopes) => scopes.every((s) => VALID_SCOPE_KEYS.includes(s)), {
      message: "Chứa scope không hợp lệ trong hệ thống",
    }),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresInDays: z.number().int().min(0).max(3650).optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  scopes: z
    .array(z.string())
    .min(1)
    .refine((scopes) => scopes.every((s) => VALID_SCOPE_KEYS.includes(s)), {
      message: "Chứa scope không hợp lệ",
    })
    .optional(),
});

export const adminUpdateLimitsSchema = z.object({
  rateLimit: z.number().int().min(10).max(10000).optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const adminRevokeKeySchema = z.object({
  reason: z.string().trim().max(255).optional(),
});

export const adminSettingsSchema = z.object({
  maxKeysPerUser: z.number().int().min(1).max(100).optional(),
  defaultRateLimit: z.number().int().min(10).max(10000).optional(),
  allowUserApiKeys: z.boolean().optional(),
  maxExpiryDays: z.number().int().min(0).max(3650).nullable().optional(),
});
