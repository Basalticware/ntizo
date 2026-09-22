import type { UnitOfWorkPort } from "@cosmneo/onion-lasagna/ports";
import type { OutboxPort } from "../../../../shared/app/ports/outbox.port";
import {
  type ExecutionContext,
  requireAuthenticated,
} from "../../../../shared/infrastructure/execution-context";
import type { AuthRolePort, RoleChangeLockPort, UserRepositoryPort } from "../ports/outbound";
import type {
  SetPlatformRoleInput,
  SetPlatformRoleOutput,
  SetPlatformRolePort,
} from "../ports/inbound/set-platform-role.command.port";
import {
  CannotChangeOwnRoleError,
  RequesterNotAdminError,
  UserNotFoundError,
} from "../../domain/exceptions";

/**
 * An administrator grants or removes platform administration.
 *
 * The handler's `requireAdmin` runs before this, against the role read when
 * the request began. That is not enough on its own: two admins removing each
 * other in the same instant would both pass it and leave the platform with
 * none. So the admin check is repeated here under a row lock. The lock
 * covers every admin's row and the target's row. The second of the two
 * transactions waits, finds its requester is no longer an admin, and is
 * refused.
 *
 * The target's row is locked as well, so two admins granting the same person
 * at once record one change, not two. The second one's `findById` runs after
 * the first commits, and reads the role already changed.
 */
export class SetPlatformRoleCommand implements SetPlatformRolePort {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly roleChangeLock: RoleChangeLockPort,
    private readonly authRole: AuthRolePort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly outboxPort: OutboxPort,
  ) {}

  async execute(ctx: ExecutionContext, input: SetPlatformRoleInput): Promise<SetPlatformRoleOutput> {
    const requester = requireAuthenticated(ctx);
    // First, and outside the transaction: it needs no database, and it is the
    // rule that keeps at least one admin — the requester stays one.
    if (input.userId === requester.userId) throw new CannotChangeOwnRoleError();

    return this.unitOfWork.atomicExecute(async () => {
      const admins = await this.roleChangeLock.lockForRoleChange(input.userId);
      if (!admins.includes(requester.userId)) throw new RequesterNotAdminError();

      const user = await this.userRepo.findById(input.userId);
      if (!user) throw new UserNotFoundError(input.userId);

      if (user.changePlatformRole(input.role, requester.userId)) {
        await this.roleChangeLock.writeRole(user.id, user.role);
        await this.authRole.setRole(user.id, user.role);
        // Last, inside the transaction, as every command here does it: the
        // outbox row and the role commit or roll back together.
        await this.outboxPort.publish(user.pullEvents(), "user");
      }
      return { userId: user.id, role: user.role };
    });
  }
}
