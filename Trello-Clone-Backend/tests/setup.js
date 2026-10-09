import { vi } from "vitest";

// Thiết lập các biến môi trường bắt buộc cho bộ test
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "super-secret-jwt-test-key-32-chars-long!!";
process.env.COOKIE_SECURE = "false";
process.env.ACCESS_TOKEN_TTL = "15m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";

// Mock mặc định cho Redis để tránh kết nối socket thật trong unit test
vi.mock("../src/config/redis.js", () => {
  const store = new Map();
  const mockRedis = {
    get: vi.fn(async (key) => store.get(key) || null),
    set: vi.fn(async (key, val) => store.set(key, val)),
    setex: vi.fn(async (key, ttl, val) => store.set(key, val)),
    del: vi.fn(async (key) => store.delete(key)),
    ping: vi.fn(async () => "PONG"),
    on: vi.fn(),
  };
  return {
    redis: mockRedis,
    redisHealthy: vi.fn(async () => true),
  };
});

// Mock realtime socket để không cố gắng emit qua socket thật
vi.mock("../src/realtime/index.js", () => ({
  emitToBoard: vi.fn(),
  emitToUser: vi.fn(),
}));

// Mock email queue
vi.mock("../src/queues/email.queue.js", () => ({
  enqueueEmail: vi.fn(),
}));
