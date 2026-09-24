import { prisma } from "../config/db.js";
import { redis } from "../config/redis.js";
import { Forbidden } from "../lib/errors.js";

const CACHE_TTL_SECONDS = 300;
const FLAGS_CACHE_KEY = "system:feature_flags";

/**
 * Lấy danh sách Feature Flags từ bảng settings (có cache Redis)
 */
export async function getFeatureFlags() {
  try {
    const cached = await redis.get(FLAGS_CACHE_KEY).catch(() => null);
    if (cached) return JSON.parse(cached);

    const setting = await prisma.setting.findUnique({
      where: { key: "feature_flags" },
    });

    const flags = setting?.value || {
      default_flags: {
        module_gantt: true,
        module_weekly_report: true,
        module_milestones: true,
        module_executive_dashboard: true,
        module_client_portal: true,
        max_workspaces_per_org: 50,
        max_users_per_org: 200,
      },
      tenant_overrides: {},
    };

    await redis
      .set(FLAGS_CACHE_KEY, JSON.stringify(flags), "EX", CACHE_TTL_SECONDS)
      .catch(() => undefined);

    return flags;
  } catch (err) {
    // Fallback nếu Redis hoặc DB chưa sẵn sàng
    return {
      default_flags: {
        module_gantt: true,
        module_weekly_report: true,
        module_milestones: true,
        module_executive_dashboard: true,
        module_client_portal: true,
      },
      tenant_overrides: {},
    };
  }
}

/**
 * Kiểm tra xem một tính năng có đang bật cho Organization cụ thể không
 */
export async function isFeatureEnabled(orgId, featureKey) {
  const flags = await getFeatureFlags();
  if (orgId && flags.tenant_overrides?.[orgId]?.[featureKey] !== undefined) {
    return Boolean(flags.tenant_overrides[orgId][featureKey]);
  }
  return Boolean(flags.default_flags?.[featureKey] ?? true);
}

/**
 * Middleware bắt buộc tính năng phải được kích hoạt
 */
export function requireFeature(featureKey) {
  return async (req, _res, next) => {
    try {
      const user = req.user;
      // Platform owner có quyền bypass feature flags để kiểm thử
      if (user?.roles?.includes("platform_owner")) {
        return next();
      }

      const enabled = await isFeatureEnabled(user?.orgId, featureKey);
      if (!enabled) {
        throw Forbidden(
          `Tính năng '${featureKey}' chưa được kích hoạt cho gói của tổ chức bạn.`
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function invalidateFeatureFlagsCache() {
  await redis.del(FLAGS_CACHE_KEY).catch(() => undefined);
}
