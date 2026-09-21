import { and, eq } from "drizzle-orm";
import type { AuthIdentityPort } from "../../app/ports/outbound";
import { PhoneNumberAlreadyInUseError } from "../../domain/exceptions";
import { getDb } from "../../../../../better-auth/infrastructure/client/drizzle";
import { user as authUser } from "../../../../../better-auth/infrastructure/database/schema";

/**
 * The one file in the user context that writes better-auth's tables.
 *
 * The read repository is explicit about never touching them, and that rule
 * stands: this is an adapter, which is the layer where a boundary crossing is
 * allowed to be named and contained rather than spread through use cases. The
 * phone lives in two places because two systems need it — the profile shows
 * it, the auth identity authenticates against it — and something has to keep
 * them equal.
 */
type UpdateFn = (
  userId: string,
  phoneNumber: string | null,
  verified: boolean,
) => Promise<void>;

type AuthDb = ReturnType<typeof getDb>;

/** postgres.js surfaces a unique violation as SQLSTATE 23505 on the error. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}

export class BetterAuthIdentityAdapter implements AuthIdentityPort {
  /**
   * `update` is injectable so the error mapping can be tested without a
   * database; `db` so the reads and the conditional write can be tested
   * against a real one. Production passes neither.
   */
  constructor(
    private readonly update: UpdateFn = async (userId, phoneNumber, verified) => {
      await getDb()
        .update(authUser)
        .set({ phoneNumber, phoneNumberVerified: verified })
        .where(eq(authUser.id, userId));
    },
    private readonly db: () => AuthDb = getDb,
  ) {}

  async setPhoneNumber(userId: string, phoneNumber: string | null): Promise<void> {
    try {
      await this.update(userId, phoneNumber, false);
    } catch (error) {
      // Only this one is translated. Anything else is an infrastructure
      // failure and must not arrive at the browser dressed as a rejected
      // phone number.
      if (isUniqueViolation(error)) throw new PhoneNumberAlreadyInUseError();
      throw error;
    }
  }

  async findPhoneOf(userId: string): Promise<{ phoneNumber: string; verified: boolean } | null> {
    const [row] = await this.db()
      .select({ phoneNumber: authUser.phoneNumber, verified: authUser.phoneNumberVerified })
      .from(authUser)
      .where(eq(authUser.id, userId))
      .limit(1);
    if (!row?.phoneNumber) return null;
    return { phoneNumber: row.phoneNumber, verified: row.verified === true };
  }

  async findByPhoneNumber(phoneNumber: string): Promise<{ userId: string; verified: boolean } | null> {
    const [row] = await this.db()
      .select({ userId: authUser.id, verified: authUser.phoneNumberVerified })
      .from(authUser)
      .where(eq(authUser.phoneNumber, phoneNumber))
      .limit(1);
    return row ? { userId: row.userId, verified: row.verified === true } : null;
  }

  async markPhoneNumberVerified(userId: string, issuedFor: string): Promise<boolean> {
    const rows = await this.db()
      .update(authUser)
      .set({ phoneNumberVerified: true })
      .where(and(eq(authUser.id, userId), eq(authUser.phoneNumber, issuedFor)))
      .returning({ id: authUser.id });
    return rows.length > 0;
  }
}
