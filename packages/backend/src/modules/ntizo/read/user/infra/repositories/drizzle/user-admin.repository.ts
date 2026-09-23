import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { USER_ROLES } from "@ntizo/shared";
import type { UserAdminDTO } from "@ntizo/shared/read-models";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { user as betterAuthUser } from "../../../../../../better-auth/infrastructure/database/schema";
import { profile, user } from "../../../../../shared/infrastructure/database/user/schemas";
import { provider, providerMember } from "../../../../../shared/infrastructure/database/provider/schemas";
import { mediaUrl } from "../../../../../shared/infrastructure/media";
import type {
  UserAdminDetailRecord,
  UserAdminRepositoryPort,
} from "../../../app/ports/outbound/user-admin.repository.port";
import { resolveAvatarUrl } from "./user-read.repository";

/**
 * Aliased, not imported plain: better-auth's `user` table and ntizo's own
 * `user` table are both literally named `user` in Postgres (different
 * schemas), and drizzle's join typing keys nullability by table name — two
 * tables sharing one collapses the joined row's type to `never`. The alias
 * only changes the name drizzle tracks the join under; the generated SQL
 * still reads the same `better_auth.user` rows.
 */
const authUser = alias(betterAuthUser, "auth_user");

/**
 * Everyone on the platform, for the administration list.
 *
 * Columns are selected explicitly rather than `select()`. The profile table
 * carries a bio, a timezone and a gender, and none of them belong on a screen
 * that exists to answer "who is here and what can they do" — a `SELECT *` here
 * would put every future personal field on it by default.
 */
export class DrizzleUserAdminRepository implements UserAdminRepositoryPort {
  async listAll(
    role: string | undefined,
    search: string | undefined,
    limit: number,
    offset: number,
  ): Promise<UserAdminDTO[]> {
    // Built as a list so "no filters at all" is an absent WHERE rather than
    // `and(undefined, undefined)`, which drizzle will not type.
    const conditions = [];
    // The column is typed to the role union; the filter arrives as a string
    // from GraphQL. Narrowed against the enum rather than cast, so an unknown
    // role is no filter instead of a query that matches nothing.
    if (role && (USER_ROLES as readonly string[]).includes(role)) {
      conditions.push(eq(user.role, role as (typeof USER_ROLES)[number]));
    }
    if (search) {
      conditions.push(
        or(
          ilike(user.email, `%${search}%`),
          ilike(profile.displayName, `%${search}%`),
        )!,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await getDb()
      .select({
        id: user.id,
        email: user.email,
        name: profile.displayName,
        role: user.role,
        status: user.status,
        phoneNumber: profile.phoneNumber,
        createdAt: user.createdAt,
        // Counted in the query rather than fetched per row: a list of fifty
        // people would otherwise be fifty-one round trips.
        providerCount: sql<number>`(
          select count(*)::int from ${providerMember}
          where ${providerMember.userId} = ${user.id}
        )`,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      // Empty is not a name. The column defaults to "" rather than null, so
      // `?? null` alone would hand the UI a blank where it expects an absence.
      name: r.name?.trim() ? r.name : null,
      role: r.role,
      status: r.status,
      phoneNumber: r.phoneNumber?.trim() ? r.phoneNumber : null,
      providerCount: r.providerCount,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async countAll(): Promise<number> {
    const [row] = await getDb().select({ total: count() }).from(user);
    return row?.total ?? 0;
  }

  /**
   * One person, with the two verification flags from better-auth's own row
   * and the workspaces from `provider_member` — the same rows the list's
   * `providerCount` counts, so the two numbers cannot disagree.
   *
   * Columns are named one by one, as in `listAll`, so a personal field added
   * to the profile later does not appear here by default.
   */
  async findDetail(userId: string): Promise<UserAdminDetailRecord | null> {
    const db = getDb();
    const [row] = await db
      .select({
        id: user.id,
        email: user.email,
        name: profile.displayName,
        avatarKey: profile.avatarKey,
        avatarUrl: profile.avatarUrl,
        role: user.role,
        status: user.status,
        phoneNumber: profile.phoneNumber,
        language: profile.language,
        createdAt: user.createdAt,
        emailVerified: authUser.emailVerified,
        phoneVerified: authUser.phoneNumberVerified,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .leftJoin(authUser, eq(authUser.id, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;

    const workspaces = await db
      .select({
        providerId: provider.id,
        name: provider.name,
        slug: provider.slug,
        logoKey: provider.logoKey,
        providerStatus: provider.status,
        memberRole: providerMember.role,
        joinedAt: providerMember.joinedAt,
      })
      .from(providerMember)
      .innerJoin(provider, eq(provider.id, providerMember.providerId))
      .where(eq(providerMember.userId, userId))
      .orderBy(asc(providerMember.joinedAt));

    return {
      id: row.id,
      email: row.email,
      name: row.name?.trim() ? row.name : null,
      avatarUrl: resolveAvatarUrl(row.avatarKey ?? null, row.avatarUrl ?? null),
      role: row.role,
      status: row.status,
      phoneNumber: row.phoneNumber?.trim() ? row.phoneNumber : null,
      emailVerified: row.emailVerified === true,
      phoneVerified: row.phoneVerified === true,
      // The profile column defaults to en-US; a missing profile row reads the same.
      language: row.language ?? "en-US",
      createdAt: row.createdAt.toISOString(),
      workspaces: workspaces.map((w) => ({
        providerId: w.providerId,
        name: w.name,
        slug: w.slug,
        logoUrl: w.logoKey ? mediaUrl(w.logoKey) : null,
        providerStatus: w.providerStatus,
        memberRole: w.memberRole,
        joinedAt: w.joinedAt.toISOString(),
      })),
    };
  }
}
