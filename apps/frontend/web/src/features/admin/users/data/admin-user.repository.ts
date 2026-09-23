import { queryOptions } from "@tanstack/react-query";
import { GraphqlError, sessionGraphql } from "@/shared/lib/graphql/session-graphql";
import type { AdminUser, AdminUserDetail } from "../domain/types";

const ALL = `
  query UserAllForAdmin($input: UserAllForAdminInput!) {
    userAllForAdmin(input: $input) {
      id email name role status phoneNumber providerCount createdAt
    }
  }`;

const DETAIL = `
  query UserDetailForAdmin($input: UserDetailForAdminInput!) {
    userDetailForAdmin(input: $input) {
      id email name avatarUrl role status phoneNumber emailVerified phoneVerified language createdAt
      workspaces { providerId name slug logoUrl providerStatus memberRole joinedAt }
      roleChange { to blockedReason }
    }
  }`;

const SET_ROLE = `
  mutation UserAdminSetPlatformRole($input: UserAdminSetPlatformRoleInput!) {
    userAdminSetPlatformRole(input: $input) { userId role }
  }`;

export const adminUserQueries = {
  all: (input: { role?: string; search?: string; limit?: number; offset?: number }) =>
    queryOptions({
      queryKey: ["admin", "users", input],
      queryFn: async (): Promise<AdminUser[]> => {
        const d = await sessionGraphql<{ userAllForAdmin: AdminUser[] }>(ALL, {
          input,
        });
        return d.userAllForAdmin;
      },
    }),

  detail: (userId: string) =>
    queryOptions({
      queryKey: ["admin", "user", userId],
      queryFn: async (): Promise<AdminUserDetail> => {
        const d = await sessionGraphql<{ userDetailForAdmin: AdminUserDetail }>(DETAIL, {
          input: { userId },
        });
        return d.userDetailForAdmin;
      },
      // An empty id would come back FORBIDDEN and read as a permissions problem.
      enabled: userId.length > 0,
      // A stale link is not worth retrying.
      retry: (failures, error) =>
        !(error instanceof GraphqlError && error.code === "USER_NOT_FOUND") && failures < 2,
    }),
};

export async function setPlatformRole(userId: string, role: "admin" | "customer"): Promise<void> {
  await sessionGraphql(SET_ROLE, { input: { userId, role } });
}
