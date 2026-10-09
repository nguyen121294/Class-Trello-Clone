import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertWorkspaceAccess } from "../../src/middleware/tenantGuard.js";
import { prisma } from "../../src/config/db.js";

vi.mock("../../src/config/db.js", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    userRole: {
      findFirst: vi.fn(),
    },
  },
  dbHealthy: vi.fn(async () => true),
}));

describe("Security Test Suite - Multi-Tenant Isolation & 4-Tier RBAC (BOLA/IDOR Defense)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tenantGuard_crossOrgAccess_throwsForbidden", async () => {
    // Given: User thuộc Organization A (org-A) cố truy cập Workspace thuộc Organization B (org-B)
    const user = {
      id: "attacker-user-id",
      orgId: "org-A",
      roles: ["ws_member"],
    };
    const workspaceId = "ws-target-in-org-b";

    prisma.workspace.findUnique.mockResolvedValueOnce({
      id: workspaceId,
      ownerId: "victim-owner-id",
      orgId: "org-B", // Khác org!
      isLocked: false,
    });

    // When & Then: Phải lập tức ném lỗi 403 Forbidden bảo vệ ranh giới Tenant
    await expect(
      assertWorkspaceAccess(user, workspaceId, "ws_member")
    ).rejects.toMatchObject({
      status: 403,
      message: "Bạn không thuộc tổ chức sở hữu không gian làm việc này.",
    });
  });

  it("tenantGuard_executiveRole_permitsRead_deniesWrite", async () => {
    // Given: Người dùng có vai trò Executive (Tầng 2 - Lãnh đạo giám sát toàn diện)
    const executiveUser = {
      id: "ceo-user-id",
      orgId: "org-A",
      roles: ["executive"],
    };
    const workspaceId = "ws-in-same-org";

    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      ownerId: "dept-head-id",
      orgId: "org-A",
      isLocked: false,
    });

    // When 1: Executive đọc Workspace (yêu cầu quyền đọc 'read')
    const readAccess = await assertWorkspaceAccess(executiveUser, workspaceId, "read");
    // Then 1: Cho phép đọc nhưng canWrite = false
    expect(readAccess.role).toBe("executive");
    expect(readAccess.canWrite).toBe(false);

    // When 2: Executive cố gắng thực hiện hành động ghi (yêu cầu 'write' hoặc 'ws_admin')
    // Then 2: Bị chặn với lỗi chỉ có quyền giám sát
    await expect(
      assertWorkspaceAccess(executiveUser, workspaceId, "ws_admin")
    ).rejects.toMatchObject({
      status: 403,
      message: "Lãnh đạo (Executive) chỉ có quyền giám sát, không được chỉnh sửa trực tiếp.",
    });
  });

  it("tenantGuard_unassignedUserInSameOrg_throwsForbidden", async () => {
    // Given: User thuộc cùng Org A, nhưng không phải là Owner và chưa được gán vào Workspace này
    const user = {
      id: "colleague-id",
      orgId: "org-A",
      roles: ["user"],
    };
    const workspaceId = "private-finance-ws";

    prisma.workspace.findUnique.mockResolvedValueOnce({
      id: workspaceId,
      ownerId: "finance-lead-id",
      orgId: "org-A",
      isLocked: false,
    });

    // Không tìm thấy bản ghi phân quyền trong user_roles
    prisma.userRole.findFirst.mockResolvedValueOnce(null);

    // When & Then: Phải ném lỗi 403 Không có quyền truy cập
    await expect(
      assertWorkspaceAccess(user, workspaceId, "ws_member")
    ).rejects.toMatchObject({
      status: 403,
      message: "Bạn không có quyền truy cập vào không gian làm việc này.",
    });
  });

  it("tenantGuard_platformOwner_hasFullAccessBypass", async () => {
    // Given: Platform Owner (Tầng 0 - Siêu quản trị hệ thống SaaS)
    const platformOwner = {
      id: "platform-root-id",
      roles: ["platform_owner"],
    };
    const workspaceId = "any-ws-id";

    prisma.workspace.findUnique.mockResolvedValueOnce({
      id: workspaceId,
      ownerId: "someone-else",
      orgId: "org-client-x",
      isLocked: false,
    });

    // When: Truy cập
    const access = await assertWorkspaceAccess(platformOwner, workspaceId, "ws_owner");

    // Then: Toàn quyền truy cập và chỉnh sửa
    expect(access.role).toBe("platform_owner");
    expect(access.canWrite).toBe(true);
  });
});
