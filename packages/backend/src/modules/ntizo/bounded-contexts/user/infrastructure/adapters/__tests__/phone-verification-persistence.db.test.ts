import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  user as authUser,
  verification,
} from "../../../../../../better-auth/infrastructure/database/schema";
import {
  bestEffortCleanup,
  DEV_DB_COLD_START_TIMEOUT_MS,
  openDevDbConnection,
} from "../../../../../shared/infrastructure/database/__tests__/dev-db-test-connection";
import { BetterAuthIdentityAdapter } from "../better-auth-identity.adapter";
import { BetterAuthPhoneVerificationCodeStore } from "../better-auth-phone-verification-code.store";

setDefaultTimeout(DEV_DB_COLD_START_TIMEOUT_MS);

const sql = openDevDbConnection();
const db = drizzle(sql);
const getDb = () => db as never;

const suffix = crypto.randomUUID().slice(0, 8);
const userId = `wa-test-${suffix}`;
// A number no real account can hold: +258 99 is not an allocated range.
const phone = `+25899${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

const identity = new BetterAuthIdentityAdapter(undefined, getDb);
const codes = new BetterAuthPhoneVerificationCodeStore(getDb);

beforeAll(async () => {
  await db.insert(authUser).values({
    id: userId,
    name: "WhatsApp Test",
    email: `${userId}@ntizo.test`,
    phoneNumber: phone,
    phoneNumberVerified: false,
  });
});

afterAll(async () => {
  await bestEffortCleanup([
    () => db.delete(verification).where(like(verification.identifier, `whatsapp-phone:${userId}`)),
    () => db.delete(authUser).where(eq(authUser.id, userId)),
    () => sql.end({ timeout: 5 }),
  ]);
});

describe("BetterAuthIdentityAdapter, phone confirmation", () => {
  test("reads the number and whether it is confirmed", async () => {
    expect(await identity.findPhoneOf(userId)).toEqual({ phoneNumber: phone, verified: false });
    expect(await identity.findByPhoneNumber(phone)).toEqual({ userId, verified: false });
  });

  test("finds nobody for a number no account holds, and nothing for an unknown account", async () => {
    expect(await identity.findByPhoneNumber("+258990000000")).toBeNull();
    expect(await identity.findPhoneOf(`missing-${suffix}`)).toBeNull();
  });

  test("does not confirm when the account's number is no longer the one the code was issued for", async () => {
    expect(await identity.markPhoneNumberVerified(userId, "+258990000001")).toBe(false);
    expect((await identity.findPhoneOf(userId))?.verified).toBe(false);
  });

  test("confirms when the number still matches", async () => {
    expect(await identity.markPhoneNumberVerified(userId, phone)).toBe(true);
    expect(await identity.findByPhoneNumber(phone)).toEqual({ userId, verified: true });
  });
});

describe("BetterAuthPhoneVerificationCodeStore", () => {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  test("keeps exactly one row even when two codes are issued at once", async () => {
    await Promise.all([
      codes.replace(userId, { code: "333333", phoneNumber: phone, expiresAt }),
      codes.replace(userId, { code: "444444", phoneNumber: phone, expiresAt }),
    ]);
    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, `whatsapp-phone:${userId}`));
    expect(rows).toHaveLength(1);
  });

  test("keeps one pending code per account, the latest", async () => {
    await codes.replace(userId, { code: "111111", phoneNumber: phone, expiresAt });
    await codes.replace(userId, { code: "222222", phoneNumber: phone, expiresAt });

    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, `whatsapp-phone:${userId}`));
    expect(rows).toHaveLength(1);

    const pending = await codes.find(userId);
    expect(pending?.code).toBe("222222");
    expect(pending?.phoneNumber).toBe(phone);
    expect(pending?.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  test("forgets the code once it is used", async () => {
    await codes.delete(userId);
    expect(await codes.find(userId)).toBeNull();
  });
});
