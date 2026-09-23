import type { UserRole } from "@ntizo/shared";

/**
 * Mirrors the platform role onto better-auth's own `role` column.
 *
 * Nothing authorizes against that column; the GraphQL context reads
 * `ntizo_user.user.role`. It is written only so the two stop disagreeing,
 * which is what sent an admin promotion done by hand to the wrong column.
 */
export interface AuthRolePort {
  setRole(userId: string, role: UserRole): Promise<void>;
}
