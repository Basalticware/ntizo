/**
 * DB-backed test for `DrizzleUserRepository.lockForRoleChange` against the
 * real dev database, for the same reason `catalog-unpublish-sweep.test.ts`
 * exists. A fake would prove the fake; only the shipped SQL, run against
 * real rows, proves the `FOR UPDATE` is there and covers the right rows.
 *
 * The proof of the lock is a second connection: while the first transaction
 * holds it, `FOR UPDATE NOWAIT` on a locked row must fail with SQLSTATE 55P03
 * (lock_not_available), and must succeed on a row outside the lock.
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as authSchema from "../../../../../better-auth/infrastructure/database/schema";
import { __runWithTransactionContextForTests } from "../../../../../../shared/infrastructure/database/tx-context";
import type { DrizzleDb } from "../../../../../../shared/infrastructure/database/connection";
import { DrizzleUserRepository } from "../../../../bounded-contexts/user/infrastructure/repositories/drizzle-user.repository";
import { bestEffortCleanup, DEV_DB_COLD_START_TIMEOUT_MS, openDevDbConnection } from "./dev-db-test-connection";
import { user } from "../user/schemas/user.schema";

setDefaultTimeout(DEV_DB_COLD_START_TIMEOUT_MS);

const sql = openDevDbConnection();
const other = openDevDbConnection();
const db = drizzle(sql, { schema: authSchema });
const repo = new DrizzleUserRepository();

const suffix = crypto.randomUUID();
const adminId = `role-lock-admin-${suffix}`;
const targetId = `role-lock-target-${suffix}`;
const bystanderId = `role-lock-bystander-${suffix}`;

let seeding: Promise<unknown> = Promise.resolve();
beforeAll(() => (seeding = db.insert(user).values([
  { id: adminId, email: `${adminId}@example.com`, role: "admin" },
  { id: targetId, email: `${targetId}@example.com`, role: "customer" },
  { id: bystanderId, email: `${bystanderId}@example.com`, role: "customer" },
])));

afterAll(async () => {
  await seeding.catch(() => undefined);
  await bestEffortCleanup([
    () => db.delete(user).where(inArray(user.id, [adminId, targetId, bystanderId])),
    () => sql.end(),
    () => other.end(),
  ]);
});

async function tryLockElsewhere(id: string): Promise<"locked" | "free"> {
  try {
    await other.begin(async (tx) => {
      await tx`SELECT id FROM ntizo_user."user" WHERE id = ${id} FOR UPDATE NOWAIT`;
    });
    return "free";
  } catch (error) {
    if ((error as { code?: string }).code === "55P03") return "locked";
    throw error;
  }
}

describe("DrizzleUserRepository.lockForRoleChange", () => {
  test("returns the admins and holds locks on them and on the target until the transaction ends", async () => {
    await seeding;
    let seen: string[] = [];
    let adminWhileHeld: string | undefined;
    let targetWhileHeld: string | undefined;
    let bystanderWhileHeld: string | undefined;

    await db.transaction(async (tx) => {
      seen = await __runWithTransactionContextForTests(tx as unknown as DrizzleDb, () =>
        repo.lockForRoleChange(targetId),
      );
      adminWhileHeld = await tryLockElsewhere(adminId);
      targetWhileHeld = await tryLockElsewhere(targetId);
      bystanderWhileHeld = await tryLockElsewhere(bystanderId);
    });

    expect(seen).toContain(adminId);
    expect(seen).not.toContain(targetId);
    expect(adminWhileHeld).toBe("locked");
    expect(targetWhileHeld).toBe("locked");
    expect(bystanderWhileHeld).toBe("free");
    // Released at commit.
    expect(await tryLockElsewhere(adminId)).toBe("free");
  });
});

describe("DrizzleUserRepository.save() and writeRole", () => {
  const staleId = `role-lock-stale-${crypto.randomUUID()}`;
  const writeRoleId = `role-lock-writerole-${crypto.randomUUID()}`;

  // Awaited fully here, once, rather than stashed for tests to re-await: a
  // drizzle insert builder re-sends its statement on every `await`/`.then()`
  // it receives, so a second await of the same builder is a second INSERT.
  beforeAll(async () => {
    await db.insert(user).values([
      { id: staleId, email: `${staleId}@example.com`, role: "customer" },
      { id: writeRoleId, email: `${writeRoleId}@example.com`, role: "customer" },
    ]);
  });

  afterAll(async () => {
    await bestEffortCleanup([
      () => db.delete(user).where(inArray(user.id, [staleId, writeRoleId])),
    ]);
  });

  test("save() of a stale aggregate never changes role", async () => {
    const stale = await __runWithTransactionContextForTests(db as unknown as DrizzleDb, () =>
      repo.findById(staleId),
    );
    if (!stale) throw new Error("seed row missing: " + staleId);

    // Simulate a role change committing between this aggregate's read and its
    // (unrelated) save — e.g. an admin was granted while this one loaded.
    await db.update(user).set({ role: "admin" }).where(eq(user.id, staleId));

    await __runWithTransactionContextForTests(db as unknown as DrizzleDb, () => repo.save(stale));

    const rows = await db.select({ role: user.role }).from(user).where(eq(user.id, staleId));
    expect(rows[0]?.role).toBe("admin");
  });

  test("writeRole sets the role", async () => {
    await __runWithTransactionContextForTests(db as unknown as DrizzleDb, () =>
      repo.writeRole(writeRoleId, "admin"),
    );

    const rows = await db.select({ role: user.role }).from(user).where(eq(user.id, writeRoleId));
    expect(rows[0]?.role).toBe("admin");
  });
});
