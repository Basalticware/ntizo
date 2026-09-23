import type { UserRole } from "@ntizo/shared";
import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";

/** The only two roles an administrator hands out; provider access comes from membership. */
export type AssignablePlatformRole = Extract<UserRole, "admin" | "customer">;

export interface SetPlatformRoleInput {
  userId: string;
  role: AssignablePlatformRole;
}

export interface SetPlatformRoleOutput {
  userId: string;
  role: UserRole;
}

export interface SetPlatformRolePort {
  execute(ctx: ExecutionContext, input: SetPlatformRoleInput): Promise<SetPlatformRoleOutput>;
}
