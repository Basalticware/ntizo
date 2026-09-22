import { describe, expect, it } from "bun:test";
import type { UserRole } from "@ntizo/shared";
import { User } from "../user.aggregate";

describe("User.create", () => {
  it("records user.registered, so no future call site can create a user silently", async () => {
    const user = User.create({
      id: "u1",
      email: "ana@ntizo.test",
      firstName: "Ana",
      emailVerified: false,
    });

    const events = user.pullEvents();
    expect(events.map((e) => e.eventName)).toEqual(["user.registered"]);
    expect(events[0]!.aggregateId).toBe("u1");
    expect(events[0]!.payload).toEqual({
      userId: "u1",
      email: "ana@ntizo.test",
      firstName: "Ana",
      emailVerified: false,
    });
  });

  it("records the event with a null first name when none was given", () => {
    const user = User.create({ id: "u1", email: "ana@ntizo.test", emailVerified: false });
    expect((user.pullEvents()[0]!.payload as { firstName: string | null }).firstName).toBeNull();
  });

  it("hands each event out once", () => {
    const user = User.create({
      id: "u1",
      email: "ana@ntizo.test",
      firstName: "Ana",
      emailVerified: false,
    });
    expect(user.pullEvents()).toHaveLength(1);
    // Two publishes of one registration is two welcomes.
    expect(user.pullEvents()).toHaveLength(0);
  });
});

describe("User.rehydrate", () => {
  it("records nothing, because loading a row is not a registration", () => {
    const user = User.rehydrate({
      id: "u1",
      email: "ana@ntizo.test",
      role: "customer",
      status: "active",
      verificationStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Every read of a user row goes through here. An event recorded on
    // rehydrate would welcome somebody again on every sign-in.
    expect(user.pullEvents()).toEqual([]);
  });
});

describe("User.changePlatformRole", () => {
  const existing = (role: UserRole) =>
    User.rehydrate({
      id: "u2",
      email: "b@ntizo.test",
      role,
      status: "active",
      verificationStatus: null,
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

  it("grants admin and records who did it", () => {
    const user = existing("customer");
    expect(user.changePlatformRole("admin", "u-admin")).toBe(true);
    expect(user.role).toBe("admin");
    const events = user.pullEvents();
    expect(events.map((e) => e.eventName)).toEqual(["user.role.changed"]);
    expect(events[0]!.aggregateId).toBe("u2");
    expect(events[0]!.payload).toEqual({
      userId: "u2",
      from: "customer",
      to: "admin",
      changedByUserId: "u-admin",
    });
  });

  it("removes admin back to customer", () => {
    const user = existing("admin");
    expect(user.changePlatformRole("customer", "u-admin")).toBe(true);
    expect(user.role).toBe("customer");
    expect((user.pullEvents()[0]!.payload as { from: string }).from).toBe("admin");
  });

  it("records nothing when the role is already the one asked for", () => {
    const user = existing("admin");
    expect(user.changePlatformRole("admin", "u-admin")).toBe(false);
    expect(user.pullEvents()).toHaveLength(0);
    expect(user.updatedAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
