import { ForbiddenError, NotFoundError } from "@cosmneo/onion-lasagna";

/** The `code` strings are a public contract; the admin page branches on them. */

export class UserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super({ message: `No user with id "${userId}"`, code: "USER_NOT_FOUND" });
    this.name = "UserNotFoundError";
  }
}

/**
 * The rule that keeps the platform from ever running out of administrators:
 * whoever makes a change is an admin and is not the one changed, so they are
 * still an admin afterwards.
 */
export class CannotChangeOwnRoleError extends ForbiddenError {
  constructor() {
    super({ message: "Nobody may change their own platform role.", code: "CANNOT_CHANGE_OWN_ROLE" });
    this.name = "CannotChangeOwnRoleError";
  }
}

/**
 * The requester stopped being an admin between the request's own check and
 * the row lock: another admin removed them in the same instant. It carries the same
 * public code as every handler's `requireAdmin`, because to the person
 * reading it, it is the same fact.
 */
export class RequesterNotAdminError extends ForbiddenError {
  constructor() {
    super({ message: "Only administrators may change a platform role.", code: "ADMIN_ONLY" });
    this.name = "RequesterNotAdminError";
  }
}
