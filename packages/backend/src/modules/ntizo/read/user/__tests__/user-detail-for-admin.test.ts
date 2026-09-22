import { describe, expect, it } from "bun:test";
import type { NtizoGraphqlContext } from "../../../graphql/context";
import { createUserReadHandlers } from "../graphql/handlers/queries.handlers";
import {
  GetUserDetailForAdminProjection,
  roleChangeFor,
} from "../app/use-cases/get-user-detail-for-admin.projection";
import type {
  UserAdminDetailRecord,
  UserAdminRepositoryPort,
} from "../app/ports/outbound/user-admin.repository.port";

const record: UserAdminDetailRecord = {
  id: "u2", email: "ana@exemplo.co.mz", name: "Ana Sitoe", avatarUrl: null,
  role: "customer", status: "active", phoneNumber: "+258845550142",
  emailVerified: true, phoneVerified: false, language: "pt-MZ",
  createdAt: "2026-09-14T08:00:00.000Z", workspaces: [],
};

function repo(found: UserAdminDetailRecord | null): UserAdminRepositoryPort {
  return {
    listAll: async () => [],
    countAll: async () => 0,
    findDetail: async () => found,
  };
}

function ctx(overrides: Partial<NtizoGraphqlContext> = {}): NtizoGraphqlContext {
  return {
    requesterUserId: "admin-1", email: null, firstName: null, lastName: null,
    role: "admin", requestId: null, ipAddress: null, userAgent: null,
    ...overrides,
  };
}

describe("roleChangeFor", () => {
  it("offers nothing on the requester's own account", () => {
    expect(roleChangeFor("admin", true)).toEqual({ to: null, blockedReason: "self" });
  });
  it("offers removal for another admin", () => {
    expect(roleChangeFor("admin", false)).toEqual({ to: "customer", blockedReason: null });
  });
  it("offers a grant for every role that is not admin", () => {
    for (const role of ["customer", "individual_provider", "organization_owner"]) {
      expect(roleChangeFor(role, false)).toEqual({ to: "admin", blockedReason: null });
    }
  });
});

describe("GetUserDetailForAdminProjection", () => {
  it("adds the server's role decision to what the repository found", async () => {
    const out = await new GetUserDetailForAdminProjection(repo(record)).execute({
      requesterUserId: "admin-1",
      userId: "u2",
    });
    expect(out).toEqual({ ...record, roleChange: { to: "admin", blockedReason: null } });
  });

  it("is a typed USER_NOT_FOUND for an id nobody has", async () => {
    await expect(
      new GetUserDetailForAdminProjection(repo(null)).execute({ requesterUserId: "admin-1", userId: "ghost" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });
});

describe("user.detailForAdmin handler", () => {
  function field(seen: { requesterUserId: string; userId: string }[]) {
    return createUserReadHandlers({
      getCurrentUser: { execute: async () => { throw new Error("unused"); } },
      listMyAddresses: { execute: async () => [] },
      listUsersForAdmin: { execute: async () => [] } as never,
      getUserDetailForAdmin: {
        execute: async (input: { requesterUserId: string; userId: string }) => {
          seen.push(input);
          return { ...record, roleChange: { to: "admin" as const, blockedReason: null } };
        },
      } as never,
    }).find((h) => h.key === "user.detailForAdmin")!;
  }

  it("refuses a non-admin with ADMIN_ONLY", async () => {
    const seen: { requesterUserId: string; userId: string }[] = [];
    await expect(field(seen).handler({ userId: "u2" }, ctx({ role: "customer" }))).rejects.toMatchObject({
      code: "ADMIN_ONLY",
    });
    expect(seen).toEqual([]);
  });

  it("refuses an admin role with nobody behind it", async () => {
    const seen: { requesterUserId: string; userId: string }[] = [];
    await expect(
      field(seen).handler({ userId: "u2" }, ctx({ requesterUserId: null })),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY" });
  });

  it("takes the requester from the session and the target from the input", async () => {
    const seen: { requesterUserId: string; userId: string }[] = [];
    await field(seen).handler({ userId: "u2", requesterUserId: "victim" }, ctx());
    expect(seen).toEqual([{ requesterUserId: "admin-1", userId: "u2" }]);
  });
});
