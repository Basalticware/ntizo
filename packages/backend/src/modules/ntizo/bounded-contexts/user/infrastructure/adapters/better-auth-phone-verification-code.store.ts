import { desc, eq } from "drizzle-orm";
import type {
  PendingPhoneVerification,
  PhoneVerificationCodeStorePort,
} from "../../app/ports/outbound";
import { getDb } from "../../../../../better-auth/infrastructure/client/drizzle";
import { verification } from "../../../../../better-auth/infrastructure/database/schema";

type AuthDb = ReturnType<typeof getDb>;

/**
 * Pending WhatsApp codes, in better-auth's own table for short-lived codes.
 *
 * The second (and last) contained crossing into better-auth's tables from
 * this context, beside `BetterAuthIdentityAdapter`. Reusing `verification`
 * costs no migration; the identifier prefix keeps these rows apart from
 * better-auth's email and OTP rows.
 *
 * One row per account is guaranteed by the primary key, not by application
 * logic: `id` is set to the same value as `identifier`, so a second `replace`
 * for the same account collides with the first on the primary key and
 * `onConflictDoUpdate` turns that collision into the update it should have
 * been. Two concurrent `replace` calls therefore race to insert or update the
 * same row, never two different ones — a delete-then-insert pair could not
 * offer that, since two interleaved delete/delete/insert/insert sequences
 * both succeed under READ COMMITTED and leave two rows behind.
 */
export class BetterAuthPhoneVerificationCodeStore implements PhoneVerificationCodeStorePort {
  constructor(private readonly db: () => AuthDb = getDb) {}

  async replace(userId: string, pending: PendingPhoneVerification): Promise<void> {
    const identifier = identifierFor(userId);
    const value = `${pending.code}:${pending.phoneNumber}`;
    await this.db()
      .insert(verification)
      .values({
        id: identifier,
        identifier,
        value,
        expiresAt: pending.expiresAt,
      })
      .onConflictDoUpdate({
        target: verification.id,
        set: { value, expiresAt: pending.expiresAt, createdAt: new Date() },
      });
  }

  async find(userId: string): Promise<PendingPhoneVerification | null> {
    const [row] = await this.db()
      .select({ value: verification.value, expiresAt: verification.expiresAt })
      .from(verification)
      .where(eq(verification.identifier, identifierFor(userId)))
      .orderBy(desc(verification.createdAt))
      .limit(1);
    if (!row) return null;
    const separator = row.value.indexOf(":");
    if (separator < 0) return null;
    return {
      code: row.value.slice(0, separator),
      phoneNumber: row.value.slice(separator + 1),
      expiresAt: row.expiresAt,
    };
  }

  async delete(userId: string): Promise<void> {
    await this.db().delete(verification).where(eq(verification.identifier, identifierFor(userId)));
  }
}

function identifierFor(userId: string): string {
  return `whatsapp-phone:${userId}`;
}
