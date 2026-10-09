import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate } from "../../src/middleware/authenticate.js";
import { signAccessToken } from "../../src/modules/auth/tokens.js";
import { prisma } from "../../src/config/db.js";
import { redis } from "../../src/config/redis.js";

vi.mock("../../src/config/db.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    userRole: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  dbHealthy: vi.fn(async () => true),
}));

vi.mock("../../src/modules/rbac/perms.js", () => ({
  getUserRoleKeys: vi.fn().mockResolvedValue(["user"]),
  getUserPermissions: vi.fn().mockResolvedValue([]),
}));

describe("Security Test Suite - Authentication & JWT Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authMiddleware_noToken_throwsUnauthorized", async () => {
    // Given: Request không có Header Authorization
    const req = { headers: {} };
    const res = {};
    const next = vi.fn();

    // When: Chạy middleware authenticate
    await authenticate(req, res, next);

    // Then: Phải quăng lỗi 401 NO_TOKEN
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        code: "NO_TOKEN",
      })
    );
  });

  it("authMiddleware_tamperedToken_throwsUnauthorizedInvalidToken", async () => {
    // Given: Token bị chỉnh sửa signature (giả mạo token)
    const validToken = signAccessToken({ user_id: "user-1", token_version: 1, jti: "jti-1" });
    const tamperedToken = validToken.slice(0, -6) + "FAKE99";

    const req = { headers: { authorization: `Bearer ${tamperedToken}` } };
    const res = {};
    const next = vi.fn();

    // When:
    await authenticate(req, res, next);

    // Then: Bị chặn ngay lập tức với mã INVALID_TOKEN
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        code: "INVALID_TOKEN",
      })
    );
  });

  it("authMiddleware_revokedJti_throwsUnauthorizedTokenRevoked", async () => {
    // Given: Token hợp lệ nhưng JTI đã bị thu hồi trong Redis (User đã logout)
    const jti = "revoked-jti-uuid";
    const token = signAccessToken({ user_id: "user-1", token_version: 1, jti });

    redis.get.mockResolvedValueOnce("true"); // Có trong blacklist Redis

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = vi.fn();

    // When:
    await authenticate(req, res, next);

    // Then: 401 TOKEN_REVOKED
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        code: "TOKEN_REVOKED",
      })
    );
  });

  it("authMiddleware_tokenVersionMismatch_throwsUnauthorizedTokenVersionMismatch", async () => {
    // Given: User đã đổi mật khẩu khiến tokenVersion tăng lên 2, nhưng token cũ mang version 1
    const jti = "jti-old-version";
    const token = signAccessToken({ user_id: "user-1", token_version: 1, jti });

    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-1",
      tokenVersion: 2, // Đã tăng lên 2
      isActive: true,
      orgId: "org-1",
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = vi.fn();

    // When:
    await authenticate(req, res, next);

    // Then: Bị vô hiệu hoá tức thì với mã TOKEN_VERSION_MISMATCH
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        code: "TOKEN_VERSION_MISMATCH",
      })
    );
  });

  it("authMiddleware_inactiveUser_throwsUnauthorizedUserInactive", async () => {
    // Given: Tài khoản user đã bị Admin vô hiệu hoá (isActive = false)
    const token = signAccessToken({ user_id: "user-locked", token_version: 1, jti: "jti-locked" });

    redis.get.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-locked",
      tokenVersion: 1,
      isActive: false, // Bị khoá
      orgId: "org-1",
    });

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    const next = vi.fn();

    // When:
    await authenticate(req, res, next);

    // Then: 401 USER_INACTIVE
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        code: "USER_INACTIVE",
      })
    );
  });
});
