import type { UserRole } from "@ntizo/shared";

/**
 * The row locks and the one role write a platform-role change needs.
 *
 * Its own port rather than a method on `UserRepositoryPort`, so every
 * existing fake of that repository stays valid.
 */
export interface RoleChangeLockPort {
  /**
   * Locks every admin's row and the target's row until the surrounding
   * transaction ends, and returns the admins' ids.
   *
   * Call it only inside `unitOfWork.atomicExecute`; outside a transaction the
   * lock is released as soon as the statement ends.
   */
  lockForRoleChange(targetUserId: string): Promise<string[]>;

  /**
   * Writes `role` on an existing row. This is the only write allowed to
   * change `role` on a row that already exists — `UserRepositoryPort.save()`
   * no longer touches it. Call it only inside the same transaction as
   * `lockForRoleChange`, after re-checking the requester is still an admin.
   */
  writeRole(userId: string, role: UserRole): Promise<void>;
}
