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

/** Rows a page of the list draws. The field's own default. */
export const ADMIN_USERS_PAGE_SIZE = 25;

export interface AdminUsersPage {
  items: AdminUser[];
  hasMore: boolean;
}

export const adminUserQueries = {
  /**
   * One page of the list, and whether there is another after it — one row
   * more is asked for than is drawn, because the read returns no total.
   */
  page: (input: { role?: string; search?: string; offset: number }) =>
    queryOptions({
      queryKey: ["admin", "users", "page", input],
      queryFn: async (): Promise<AdminUsersPage> => {
        const d = await sessionGraphql<{ userAllForAdmin: AdminUser[] }>(ALL, {
          input: { ...input, limit: ADMIN_USERS_PAGE_SIZE + 1 },
        });
        const rows = d.userAllForAdmin;
        return { items: rows.slice(0, ADMIN_USERS_PAGE_SIZE), hasMore: rows.length > ADMIN_USERS_PAGE_SIZE };
      },
    }),

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
