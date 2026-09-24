// /me may return either a flat user or { user, roles, permissions }. Normalize.
export function meUser(u) {
  if (!u) return null;
  return u.user ?? u;
}

export function meRoles(u) {
  if (!u) return [];
  if (Array.isArray(u.roles)) return u.roles;
  if (Array.isArray(u.user?.roles)) return u.user.roles;
  return [];
}
