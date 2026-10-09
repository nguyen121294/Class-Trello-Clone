import { Forbidden } from "../../lib/errors.js";

/**
 * Middleware enforcing that if an API Key was used to authenticate,
 * it must possess the required scope (e.g. "cards:read", "boards:read").
 * Normal JWT-authenticated user sessions bypass this check.
 *
 * @param {string} requiredScope
 */
export function requireApiKeyScope(requiredScope) {
  return (req, _res, next) => {
    // If authenticated via an API Key, verify scopes
    if (req.apiKey) {
      const scopes = req.apiKey.scopes || [];
      if (requiredScope && !scopes.includes(requiredScope)) {
        throw Forbidden(
          `API Key không có quyền truy cập phạm vi này (Yêu cầu scope: "${requiredScope}").`
        );
      }
    }
    next();
  };
}
