import { z } from "zod";

/** One workspace a person belongs to, as the admin detail page lists it. */
export const userAdminWorkspaceReadModel = z.object({
  providerId: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  /** The business's own status: `pending` | `active` | `rejected` | `suspended` | `archived`. */
  providerStatus: z.string(),
  /** This person's role in it: `owner` | `admin` | `staff`. */
  memberRole: z.string(),
  /** ISO 8601. */
  joinedAt: z.string(),
});

/**
 * One person, as the administration detail page sees them.
 *
 * The list's restraint, kept: no bio, no date of birth, no gender, no
 * timezone. What is added is what an administrator checks when opening one
 * account: whether the email and phone are confirmed, the language they read,
 * where they work, and the one role move available.
 *
 * `roleChange` is the server's decision, not the page's: `to` is the role the
 * one available button would set, and `blockedReason` says why there is none.
 */
export const userAdminDetailReadModel = z.object({
  id: z.string().min(1),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  phoneNumber: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  language: z.string(),
  /** ISO 8601. */
  createdAt: z.string(),
  workspaces: z.array(userAdminWorkspaceReadModel),
  roleChange: z.object({
    to: z.enum(["admin", "customer"]).nullable(),
    blockedReason: z.enum(["self"]).nullable(),
  }),
});

export type UserAdminWorkspaceDTO = z.infer<typeof userAdminWorkspaceReadModel>;
export type UserAdminDetailDTO = z.infer<typeof userAdminDetailReadModel>;
