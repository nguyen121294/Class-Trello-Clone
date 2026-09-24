import { prisma } from "../config/db.js";
import { Forbidden, NotFound } from "../lib/errors.js";

/**
 * Kiểm tra và phân giải quyền truy cập vào Workspace theo 4 tầng RBAC
 * 
 * Tầng 0: platform_owner (Toàn quyền nền tảng)
 * Tầng 1: super_admin (Toàn quyền trong Organization)
 * Tầng 2: executive / auditor (Được quyền ĐỌC tất cả Workspace trong Org mà không cần mời; Không được sửa/xóa)
 * Tầng 3: ws_owner, ws_admin, ws_member (Chỉ làm việc trong Workspace được gán)
 * Ngoài ra: client (Chỉ đọc)
 */
export async function assertWorkspaceAccess(user, workspaceId, requiredRole = "ws_member") {
  if (!user) throw Forbidden("Yêu cầu đăng nhập.");

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true, orgId: true, isLocked: true },
  });

  if (!ws) throw NotFound("Không tìm thấy không gian làm việc (Workspace).");

  const roles = user.roles || [];

  // Tầng 0: Platform Owner
  if (roles.includes("platform_owner")) {
    return { role: "platform_owner", canWrite: true, ws };
  }

  // Cách ly dữ liệu tầng 1: Kiểm tra orgId nếu cả 2 bên đều có orgId
  if (user.orgId && ws.orgId && user.orgId !== ws.orgId) {
    throw Forbidden("Bạn không thuộc tổ chức sở hữu không gian làm việc này.");
  }

  // Tầng 1: Super Admin của Organization
  if (roles.includes("super_admin")) {
    return { role: "super_admin", canWrite: true, ws };
  }

  // Tầng 2: Executive (Lãnh đạo giám sát toàn diện)
  if (roles.includes("executive") || roles.includes("auditor")) {
    if (requiredRole === "ws_owner" || requiredRole === "ws_admin" || requiredRole === "write") {
      throw Forbidden("Lãnh đạo (Executive) chỉ có quyền giám sát, không được chỉnh sửa trực tiếp.");
    }
    return { role: "executive", canWrite: false, ws }; // Read-only
  }

  // Tầng 3: Chủ sở hữu Workspace
  if (ws.ownerId === user.id) {
    return { role: "ws_owner", canWrite: true, ws };
  }

  // Tầng 3: Thành viên được gán qua bảng user_roles (tenant_id = workspaceId)
  const userRole = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      tenantId: workspaceId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { role: true },
  });

  if (!userRole) {
    throw Forbidden("Bạn không có quyền truy cập vào không gian làm việc này.");
  }

  const roleKey = userRole.role.key;

  if (requiredRole === "ws_owner" && roleKey !== "ws_owner") {
    throw Forbidden("Yêu cầu quyền Chủ sở hữu (ws_owner).");
  }

  if (requiredRole === "ws_admin" && !["ws_owner", "ws_admin"].includes(roleKey)) {
    throw Forbidden("Yêu cầu quyền Quản trị viên (ws_admin).");
  }

  return { role: roleKey, canWrite: ["ws_owner", "ws_admin", "ws_member"].includes(roleKey), ws };
}

/**
 * Middleware bảo vệ route Workspace
 */
export function requireWorkspaceRole(requiredRole = "ws_member") {
  return async (req, _res, next) => {
    try {
      const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
      if (!workspaceId) return next();

      const access = await assertWorkspaceAccess(req.user, workspaceId, requiredRole);
      req.workspaceAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}
