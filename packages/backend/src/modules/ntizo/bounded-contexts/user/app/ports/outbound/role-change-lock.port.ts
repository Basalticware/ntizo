/**
 * The row locks a platform-role change needs.
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
}
