import crypto from "node:crypto";
import { prisma } from "../../config/db.js";
import { redis } from "../../config/redis.js";
import { BadRequest, Forbidden, NotFound, TooManyRequests, Unauthorized } from "../../lib/errors.js";
import { AVAILABLE_SCOPES } from "./apiKeys.schema.js";

const DEFAULT_SETTINGS = {
  maxKeysPerUser: 5,
  defaultRateLimit: 120,
  allowUserApiKeys: true,
  maxExpiryDays: 365,
};

const SETTINGS_KEY = "api_keys_policy";

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function generatePlaintextKey() {
  const randomBytes = crypto.randomBytes(24);
  const randomPart = randomBytes.toString("base64url");
  const plaintext = `trello_live_${randomPart}`;
  const keyPrefix = plaintext.slice(0, 20); // e.g. "trello_live_7a8b9c..."
  const keyHash = sha256(plaintext);
  return { plaintext, keyPrefix, keyHash };
}

// -----------------------------------------------------------------------------
// System Settings for API Keys
// -----------------------------------------------------------------------------

export async function getAdminSettings() {
  const record = await prisma.setting.findUnique({
    where: { key: SETTINGS_KEY },
  });
  if (!record || !record.value) {
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...record.value };
}

export async function updateAdminSettings(input) {
  const current = await getAdminSettings();
  const updated = { ...current, ...input };

  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: updated },
    update: { value: updated },
  });

  return updated;
}

export function getAvailableScopes() {
  return AVAILABLE_SCOPES;
}

// -----------------------------------------------------------------------------
// User Self-Service API Key Methods
// -----------------------------------------------------------------------------

export async function listUserKeys(userId) {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return keys.map((k) => ({
    ...k,
    status: k.revokedAt ? "revoked" : k.expiresAt && new Date(k.expiresAt) < new Date() ? "expired" : "active",
  }));
}

export async function createKey(userId, { name, scopes, expiresAt }) {
  const settings = await getAdminSettings();

  if (!settings.allowUserApiKeys) {
    throw Forbidden("Tính năng tự tạo API Key hiện đang bị tạm khóa bởi Quản trị viên");
  }

  // Count active keys
  const now = new Date();
  const activeCount = await prisma.apiKey.count({
    where: {
      userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  if (activeCount >= settings.maxKeysPerUser) {
    throw BadRequest(
      `Bạn đã đạt hạn ngạch tối đa (${settings.maxKeysPerUser} API Keys đang hoạt động). Hãy thu hồi các key cũ trước khi tạo mới.`
    );
  }

  // Expiration check
  let parsedExpiry = null;
  if (expiresAt) {
    parsedExpiry = new Date(expiresAt);
    if (parsedExpiry <= now) {
      throw BadRequest("Ngày hết hạn phải ở thời điểm tương lai");
    }
  } else if (settings.maxExpiryDays && settings.maxExpiryDays > 0) {
    // Apply default max expiry if user didn't specify
    parsedExpiry = new Date(now.getTime() + settings.maxExpiryDays * 24 * 60 * 60 * 1000);
  }

  const { plaintext, keyPrefix, keyHash } = generatePlaintextKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      scopes,
      userId,
      rateLimit: settings.defaultRateLimit,
      expiresAt: parsedExpiry,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    ...apiKey,
    plaintext, // Returned ONCE upon creation
  };
}

export async function updateUserKey(userId, keyId, { name, scopes }) {
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId, revokedAt: null },
  });

  if (!existing) {
    throw NotFound("API Key không tồn tại hoặc đã bị thu hồi");
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (scopes !== undefined) data.scopes = scopes;

  return prisma.apiKey.update({
    where: { id: keyId },
    data,
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      expiresAt: true,
      updatedAt: true,
    },
  });
}

export async function revokeUserKey(userId, keyId) {
  const existing = await prisma.apiKey.findFirst({
    where: { id: keyId, userId, revokedAt: null },
  });

  if (!existing) {
    throw NotFound("API Key không tồn tại hoặc đã bị thu hồi trước đó");
  }

  return prisma.apiKey.update({
    where: { id: keyId },
    data: {
      revokedAt: new Date(),
      revokedReason: "Người dùng chủ động thu hồi",
      revokedByUserId: userId,
    },
    select: {
      id: true,
      name: true,
      revokedAt: true,
    },
  });
}

// -----------------------------------------------------------------------------
// Admin Governance Methods
// -----------------------------------------------------------------------------

export async function listAdminKeys({ page = 1, limit = 20, status, q }) {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const now = new Date();
  const where = {};

  if (status === "active") {
    where.revokedAt = null;
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
  } else if (status === "expired") {
    where.revokedAt = null;
    where.expiresAt = { lte: now };
  } else if (status === "revoked") {
    where.revokedAt = { not: null };
  }

  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { keyPrefix: { contains: term, mode: "insensitive" } },
      { user: { email: { contains: term, mode: "insensitive" } } },
      { user: { name: { contains: term, mode: "insensitive" } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.apiKey.count({ where }),
    prisma.apiKey.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimit: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    page: Number(page),
    limit: take,
    pages: Math.ceil(total / take),
    items: items.map((k) => ({
      ...k,
      status: k.revokedAt ? "revoked" : k.expiresAt && new Date(k.expiresAt) < now ? "expired" : "active",
    })),
  };
}

export async function getAdminKey(keyId) {
  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          orgId: true,
        },
      },
      revokedByUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!key) throw NotFound("API Key không tồn tại");
  return key;
}

export async function revokeAdminKey(keyId, reason, adminId) {
  const existing = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!existing) throw NotFound("API Key không tồn tại");

  return prisma.apiKey.update({
    where: { id: keyId },
    data: {
      revokedAt: new Date(),
      revokedReason: reason || "Quản trị viên thu hồi",
      revokedByUserId: adminId,
    },
  });
}

export async function updateAdminKeyLimits(keyId, { rateLimit, expiresAt }) {
  const existing = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!existing) throw NotFound("API Key không tồn tại");

  const data = {};
  if (rateLimit !== undefined) data.rateLimit = rateLimit;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

  return prisma.apiKey.update({
    where: { id: keyId },
    data,
  });
}

// -----------------------------------------------------------------------------
// Authentication Verification & Rate Limiting
// -----------------------------------------------------------------------------

export async function verifyAndRateLimitKey(rawKey) {
  const hash = sha256(rawKey);
  const now = new Date();

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash: hash,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          orgId: true,
          tokenVersion: true,
        },
      },
    },
  });

  if (!apiKey || !apiKey.user || !apiKey.user.isActive) {
    throw Unauthorized("INVALID_API_KEY", "API Key không hợp lệ, đã hết hạn hoặc bị thu hồi");
  }

  // Rate Limiting per Key per Minute via Redis
  const rateLimitKey = `rl:apikey:${apiKey.id}`;
  const currentCount = await redis.incr(rateLimitKey).catch(() => 1);
  if (currentCount === 1) {
    await redis.expire(rateLimitKey, 60).catch(() => undefined);
  }

  if (currentCount > apiKey.rateLimit) {
    throw TooManyRequests(
      "RATE_LIMITED",
      `API Key vượt quá giới hạn ${apiKey.rateLimit} lượt gọi / phút. Vui lòng thử lại sau ít phút.`
    );
  }

  // Throttled lastUsedAt update (only update once every 60 seconds to reduce DB writes)
  const touchKey = `touch:apikey:${apiKey.id}`;
  const shouldTouch = await redis.set(touchKey, "1", "EX", 60, "NX").catch(() => null);
  if (shouldTouch) {
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: now },
      })
      .catch(() => undefined);
  }

  return apiKey;
}
