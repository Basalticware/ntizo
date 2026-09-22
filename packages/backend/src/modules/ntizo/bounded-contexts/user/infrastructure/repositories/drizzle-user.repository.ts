import { eq, or } from "drizzle-orm";
import type { RoleChangeLockPort, UserRepositoryPort } from "../../app/ports/outbound";
import { User } from "../../domain/aggregates/user.aggregate";
import { user } from "../../../../shared/infrastructure/database/user";
import { getDb } from "../../../../../better-auth/infrastructure/client/drizzle";

export class DrizzleUserRepository implements UserRepositoryPort, RoleChangeLockPort {
  async findById(id: string): Promise<User | null> {
    const db = getDb();
    const rows = await db.select().from(user).where(eq(user.id, id));
    const row = rows[0];
    if (!row) return null;
    return User.rehydrate({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      verificationStatus: row.verificationStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const db = getDb();
    const rows = await db.select().from(user).where(eq(user.email, email));
    const row = rows[0];
    if (!row) return null;
    return User.rehydrate({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      verificationStatus: row.verificationStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(aggregate: User): Promise<void> {
    const db = getDb();
    const json = aggregate.toJSON();
    await db
      .insert(user)
      .values({
        id: json.id,
        email: json.email,
        role: json.role,
        status: json.status,
        verificationStatus: json.verificationStatus,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
      })
      .onConflictDoUpdate({
        target: user.id,
        set: {
          email: json.email,
          role: json.role,
          status: json.status,
          verificationStatus: json.verificationStatus,
          updatedAt: json.updatedAt,
        },
      });
  }

  /**
   * `FOR UPDATE` on every admin row and on the target's row.
   *
   * Under READ COMMITTED a row another transaction changed is re-checked
   * against this WHERE once its lock is released, and the `role` returned is
   * the committed one. So an admin demoted a moment ago comes back as
   * `customer`, and is not counted.
   */
  async lockForRoleChange(targetUserId: string): Promise<string[]> {
    const rows = await getDb()
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(or(eq(user.role, "admin"), eq(user.id, targetUserId)))
      .for("update");
    return rows.filter((r) => r.role === "admin").map((r) => r.id);
  }
}
