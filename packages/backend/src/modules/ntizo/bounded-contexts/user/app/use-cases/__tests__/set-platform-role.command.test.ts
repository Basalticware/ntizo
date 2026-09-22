import { describe, expect, it } from "bun:test";
import type { BaseDomainEvent } from "@cosmneo/onion-lasagna";
import type { UnitOfWorkPort } from "@cosmneo/onion-lasagna/ports";
import type { UserRole } from "@ntizo/shared";
import type { OutboxPort } from "../../../../../shared/app/ports/outbox.port";
import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";
import { User } from "../../../domain/aggregates/user.aggregate";
import type { AuthRolePort, RoleChangeLockPort, UserRepositoryPort } from "../../ports/outbound";
import { SetPlatformRoleCommand } from "../set-platform-role.command";

/** Tracks whether a call happened inside the unit of work, which is what makes it atomic. */
const tx = { inside: false };

const uow: UnitOfWorkPort = {
  async atomicExecute<T>(work: () => Promise<T>): Promise<T> {
    tx.inside = true;
    try {
      return await work();
    } finally {
      tx.inside = false;
    }
  },
};

class FakeUsers implements UserRepositoryPort, RoleChangeLockPort {
  readonly byId = new Map<string, User>();
  readonly roleWrites: { id: string; role: UserRole; inside: boolean }[] = [];
  readonly lockedFor: string[] = [];
  constructor(seed: { id: string; role: UserRole }[]) {
    for (const s of seed) {
      this.byId.set(
        s.id,
        User.rehydrate({
          id: s.id,
          email: `${s.id}@ntizo.test`,
          role: s.role,
          status: "active",
          verificationStatus: null,
          createdAt: new Date("2026-09-01T00:00:00Z"),
          updatedAt: new Date("2026-09-01T00:00:00Z"),
        }),
      );
    }
  }
  async findById(id: string) {
    return this.byId.get(id) ?? null;
  }
  async findByEmail() {
    return null;
  }
  async save(user: User) {
    this.byId.set(user.id, user);
  }
  async lockForRoleChange(targetUserId: string) {
    this.lockedFor.push(targetUserId);
    return [...this.byId.values()].filter((u) => u.role === "admin").map((u) => u.id);
  }
  async writeRole(id: string, role: UserRole) {
    this.roleWrites.push({ id, role, inside: tx.inside });
    const existing = this.byId.get(id);
    if (existing) this.byId.set(id, User.rehydrate({ ...existing.toJSON(), role }));
  }
}

class SpyAuthRole implements AuthRolePort {
  readonly calls: { userId: string; role: UserRole; inside: boolean }[] = [];
  async setRole(userId: string, role: UserRole) {
    this.calls.push({ userId, role, inside: tx.inside });
  }
}

class SpyOutbox implements OutboxPort {
  readonly published: { event: BaseDomainEvent; aggregateType: string; inside: boolean }[] = [];
  async publish(events: BaseDomainEvent[], aggregateType: string) {
    for (const event of events) this.published.push({ event, aggregateType, inside: tx.inside });
  }
}

function as(userId: string): ExecutionContext {
  return {
    requester: {
      type: "authenticated",
      user: { userId, email: "", firstName: "", lastName: "", platformRole: "admin" },
    },
    metadata: { requestId: "r1", receivedAt: new Date() },
  };
}

function setup(seed: { id: string; role: UserRole }[]) {
  const users = new FakeUsers(seed);
  const authRole = new SpyAuthRole();
  const outbox = new SpyOutbox();
  const command = new SetPlatformRoleCommand(users, users, authRole, uow, outbox);
  return { users, authRole, outbox, command };
}

describe("SetPlatformRoleCommand", () => {
  it("grants admin: saves, mirrors and publishes, all inside the transaction", async () => {
    const { users, authRole, outbox, command } = setup([
      { id: "admin-1", role: "admin" },
      { id: "u2", role: "customer" },
    ]);

    const result = await command.execute(as("admin-1"), { userId: "u2", role: "admin" });

    expect(result).toEqual({ userId: "u2", role: "admin" });
    expect(users.lockedFor).toEqual(["u2"]);
    expect(users.roleWrites).toEqual([{ id: "u2", role: "admin", inside: true }]);
    expect(authRole.calls).toEqual([{ userId: "u2", role: "admin", inside: true }]);
    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]!.inside).toBe(true);
    expect(outbox.published[0]!.aggregateType).toBe("user");
    expect(outbox.published[0]!.event.payload).toEqual({
      userId: "u2",
      from: "customer",
      to: "admin",
      changedByUserId: "admin-1",
    });
  });

  it("removes admin back to customer", async () => {
    const { authRole, command } = setup([
      { id: "admin-1", role: "admin" },
      { id: "admin-2", role: "admin" },
    ]);

    const result = await command.execute(as("admin-1"), { userId: "admin-2", role: "customer" });

    expect(result).toEqual({ userId: "admin-2", role: "customer" });
    expect(authRole.calls).toEqual([{ userId: "admin-2", role: "customer", inside: true }]);
  });

  it("refuses to change the requester's own role, before taking any lock", async () => {
    const { users, command } = setup([{ id: "admin-1", role: "admin" }]);

    await expect(
      command.execute(as("admin-1"), { userId: "admin-1", role: "customer" }),
    ).rejects.toMatchObject({ code: "CANNOT_CHANGE_OWN_ROLE" });
    expect(users.lockedFor).toEqual([]);
    expect(users.roleWrites).toEqual([]);
  });

  it("refuses when, under the lock, the requester is no longer an admin", async () => {
    // The race: another admin removed this one a moment before this lock.
    const { users, outbox, command } = setup([
      { id: "was-admin", role: "customer" },
      { id: "admin-2", role: "admin" },
    ]);

    await expect(
      command.execute(as("was-admin"), { userId: "admin-2", role: "customer" }),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY" });
    expect(users.roleWrites).toEqual([]);
    expect(outbox.published).toEqual([]);
  });

  it("refuses an id nobody has", async () => {
    const { command } = setup([{ id: "admin-1", role: "admin" }]);

    await expect(
      command.execute(as("admin-1"), { userId: "ghost", role: "admin" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("does nothing, successfully, when the role is already the one asked for", async () => {
    const { users, authRole, outbox, command } = setup([
      { id: "admin-1", role: "admin" },
      { id: "admin-2", role: "admin" },
    ]);

    const result = await command.execute(as("admin-1"), { userId: "admin-2", role: "admin" });

    expect(result).toEqual({ userId: "admin-2", role: "admin" });
    expect(users.roleWrites).toEqual([]);
    expect(authRole.calls).toEqual([]);
    expect(outbox.published).toEqual([]);
  });
});
