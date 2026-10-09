import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../src/config/db.js";
import {
  checkOrgCodeAvailable,
  registerOrganization,
} from "../../src/modules/auth/auth.service.js";
import { verifyAccessToken } from "../../src/modules/auth/tokens.js";

// Mock prisma client for unit tests
vi.mock("../../src/config/db.js", () => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
    userRole: {
      count: vi.fn(),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({ id: "rt-1" }),
    },
    accessAudit: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    workspace: {
      create: vi.fn(),
    },
    board: {
      create: vi.fn(),
    },
    list: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return {
    prisma: mockPrisma,
    dbHealthy: vi.fn(async () => true),
  };
});

describe("AuthService - Business Logic Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkOrgCodeAvailable", () => {
    it("authService_checkOrgCode_returnsFalseForShortCode", async () => {
      // Given: Code ngắn hơn 2 ký tự hoặc rỗng
      const code = "a";

      // When: Kiểm tra tính khả dụng của mã
      const result = await checkOrgCodeAvailable(code);

      // Then: Trả về available = false và không truy vấn DB
      expect(result.available).toBe(false);
      expect(result.code).toBe("a");
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    });

    it("authService_checkOrgCode_returnsTrueWhenAvailable", async () => {
      // Given: Mã công ty hợp lệ và chưa tồn tại trong DB
      const code = "SMARTLOG";
      prisma.organization.findUnique.mockResolvedValueOnce(null);

      // When: Kiểm tra
      const result = await checkOrgCodeAvailable(code);

      // Then: Chuẩn hoá thành chữ thường và trả về available = true
      expect(result.available).toBe(true);
      expect(result.code).toBe("smartlog");
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { code: "smartlog" },
        select: { id: true },
      });
    });

    it("authService_checkOrgCode_returnsFalseWhenAlreadyTaken", async () => {
      // Given: Mã công ty đã tồn tại trong DB
      const code = "trello";
      prisma.organization.findUnique.mockResolvedValueOnce({ id: "org-123" });

      // When: Kiểm tra
      const result = await checkOrgCodeAvailable(code);

      // Then: available = false
      expect(result.available).toBe(false);
      expect(result.code).toBe("trello");
    });
  });

  describe("registerOrganization (B2B Onboarding)", () => {
    const validPayload = {
      orgName: "Công ty Cổ phần LogiTech",
      orgCode: "logitech",
      name: "Nguyễn Văn Quản Trị",
      username: "admin",
      password: "SecurePassword@123",
    };

    it("authService_registerOrg_throwsConflictOnDuplicateCode", async () => {
      // Given: Mã tổ chức đã tồn tại
      prisma.organization.findUnique.mockResolvedValueOnce({ id: "existing-org" });

      // When & Then: Thao tác đăng ký phải quăng Conflict error ORG_CODE_TAKEN
      await expect(
        registerOrganization(validPayload, "127.0.0.1")
      ).rejects.toMatchObject({
        status: 409,
        code: "ORG_CODE_TAKEN",
      });
    });

    it("authService_registerOrg_throwsConflictOnDuplicateUser", async () => {
      // Given: Mã tổ chức chưa có, nhưng user UPN (admin@logitech) đã tồn tại
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce({ id: "existing-user" });

      // When & Then: Phải quăng Conflict error USER_TAKEN
      await expect(
        registerOrganization(validPayload, "127.0.0.1")
      ).rejects.toMatchObject({
        status: 409,
        code: "USER_TAKEN",
      });
    });

    it("authService_registerOrg_createsOrgUserAndWorkspaceSuccessfully", async () => {
      // Given: Mã tổ chức và tài khoản đều mới, roles super_admin & ws_owner có sẵn
      prisma.organization.findUnique.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.role.findUnique
        .mockResolvedValueOnce({ id: "role-super-admin", key: "super_admin" })
        .mockResolvedValueOnce({ id: "role-ws-owner", key: "ws_owner" });

      const mockOrg = { id: "new-org-id", name: validPayload.orgName, code: "logitech" };
      const mockUser = { id: "new-user-id", email: "admin@logitech", tokenVersion: 1, orgId: "new-org-id" };
      const mockWs = { id: "new-ws-id", name: "Không gian làm việc chính", orgId: "new-org-id" };

      // Mô phỏng transaction Prisma thành công
      prisma.$transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          organization: { create: vi.fn().mockResolvedValue(mockOrg) },
          user: { create: vi.fn().mockResolvedValue(mockUser) },
          userRole: { create: vi.fn().mockResolvedValue({ id: "ur-1" }) },
          workspace: { create: vi.fn().mockResolvedValue(mockWs) },
          board: { create: vi.fn().mockResolvedValue({ id: "board-1" }) },
          list: { create: vi.fn().mockResolvedValue({ id: "list-1" }) },
        };
        return callback(tx);
      });

      // When: Thực hiện đăng ký
      const res = await registerOrganization(validPayload, "127.0.0.1");

      // Then: Trả về thông tin Org, User và bộ token JWT hợp lệ
      expect(res.org.id).toBe("new-org-id");
      expect(res.userId).toBe("new-user-id");
      expect(res.tokens.accessToken).toBeDefined();
      expect(res.tokens.refreshToken).toBeDefined();

      // Kiểm tra token JWT giải mã được thông tin đúng
      const decoded = verifyAccessToken(res.tokens.accessToken);
      expect(decoded.user_id).toBe("new-user-id");
      expect(decoded.token_version).toBe(1);
    });
  });
});
