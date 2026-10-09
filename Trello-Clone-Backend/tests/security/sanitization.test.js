import { describe, it, expect, vi } from "vitest";
import { sanitizeBody } from "../../src/middleware/sanitize.js";

describe("Security Test Suite - Input Sanitization & Payload Protection", () => {
  it("sanitizeMiddleware_stripsControlCharsAndTrims", () => {
    // Given: Payload chứa ký tự điều khiển độc hại (ASCII < 32) và khoảng trắng thừa
    const req = {
      body: {
        title: "  \x00\x08Card tiêu đề sạch sẽ\x0B\x0C  ",
        description: "Dòng 1\nDòng 2\tTab hợp lệ\r\n", // Tab (9), newline (10), CR (13) được giữ
        nested: {
          comment: "  Bình luận độc hại \x1F ",
        },
        tags: ["  \x07Tag1  ", "Tag 2"],
      },
    };
    const res = {};
    const next = vi.fn();

    // When: Chạy middleware sanitizeBody
    sanitizeBody(req, res, next);

    // Then: Tất cả khoảng trắng thừa và ký tự điều khiển bị loại bỏ
    expect(req.body.title).toBe("Card tiêu đề sạch sẽ");
    expect(req.body.description).toBe("Dòng 1\nDòng 2\tTab hợp lệ");
    expect(req.body.nested.comment).toBe("Bình luận độc hại");
    expect(req.body.tags).toEqual(["Tag1", "Tag 2"]);
    expect(next).toHaveBeenCalled();
  });

  it("sanitizeMiddleware_preservesPasswordAndTokens", () => {
    // Given: Payload chứa password hoặc token có ký tự đặc biệt/khoảng trắng có chủ đích
    const req = {
      body: {
        username: "  user123  ",
        password: "  Secret P@ssword with Spaces \x00 ",
        refreshToken: " raw-token-value ",
      },
    };
    const res = {};
    const next = vi.fn();

    // When:
    sanitizeBody(req, res, next);

    // Then: Username bị trim, nhưng password và token được giữ nguyên vẹn để không làm hỏng xác thực
    expect(req.body.username).toBe("user123");
    expect(req.body.password).toBe("  Secret P@ssword with Spaces \x00 ");
    expect(req.body.refreshToken).toBe(" raw-token-value ");
    expect(next).toHaveBeenCalled();
  });
});
