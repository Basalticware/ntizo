import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { profile, user } from "../../../../../shared/infrastructure/database/user/schemas";
import type { UserNameReaderPort } from "../../../app/ports/outbound/user-name-reader.port";

/**
 * The single place the Activity context reads a person's name.
 *
 * Display name first and the email second, the same fallback the admin users
 * list uses. A history row that names nobody at all is worse than one that
 * names an address.
 */
export class DrizzleUserNameReader implements UserNameReaderPort {
  async findNameById(userId: string): Promise<string | null> {
    const [row] = await getDb()
      .select({ email: user.email, displayName: profile.displayName })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;
    return row.displayName?.trim() || row.email;
  }
}
