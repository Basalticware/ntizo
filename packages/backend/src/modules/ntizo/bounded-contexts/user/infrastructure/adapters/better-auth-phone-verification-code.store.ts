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
 */
export class BetterAuthPhoneVerificationCodeStore implements PhoneVerificationCodeStorePort {
  constructor(private readonly db: () => AuthDb = getDb) {}

  async replace(userId: string, pending: PendingPhoneVerification): Promise<void> {
    const identifier = identifierFor(userId);
    await this.db().delete(verification).where(eq(verification.identifier, identifier));
    await this.db().insert(verification).values({
      id: crypto.randomUUID(),
      identifier,
      value: `${pending.code}:${pending.phoneNumber}`,
      expiresAt: pending.expiresAt,
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
