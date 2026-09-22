import { NotFoundError } from "@cosmneo/onion-lasagna";
import type { UserAdminDetailDTO } from "@ntizo/shared/read-models";
import type { UserAdminRepositoryPort } from "../ports/outbound/user-admin.repository.port";

export interface GetUserDetailForAdminInput {
  requesterUserId: string;
  userId: string;
}

/**
 * The one role move this page may offer.
 *
 * Here and not in the repository, whose contract is that its answer does not
 * vary by who asks. This one does: the requester's own account offers
 * nothing, which is also why no "last admin" case exists — the person reading
 * is an admin, and is never the one changed.
 */
export function roleChangeFor(role: string, isSelf: boolean): UserAdminDetailDTO["roleChange"] {
  if (isSelf) return { to: null, blockedReason: "self" };
  return { to: role === "admin" ? "customer" : "admin", blockedReason: null };
}

export class GetUserDetailForAdminProjection {
  constructor(private readonly repo: UserAdminRepositoryPort) {}

  async execute(input: GetUserDetailForAdminInput): Promise<UserAdminDetailDTO> {
    const found = await this.repo.findDetail(input.userId);
    // A typed 404, like the provider detail: a stale link is a page, not a crash.
    if (!found) {
      throw new NotFoundError({ message: `No user with id "${input.userId}"`, code: "USER_NOT_FOUND" });
    }
    return { ...found, roleChange: roleChangeFor(found.role, input.userId === input.requesterUserId) };
  }
}
