import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "@/shared/lib/api/auth-client";
import { isSafeInternalPath } from "@/shared/lib/zones";
import { VerifyPhone } from "@/features/auth/components/verify-phone";

/**
 * Deliberately outside `_public`: that layout bounces anyone with a session,
 * and this screen needs one — the number being confirmed is read from the
 * session rather than retyped, so nobody can aim a code at a number that
 * isn't theirs.
 *
 * `next` makes it the invite every email-confirmation link lands on. As an
 * invite it steps aside before drawing anything when there is nothing to do
 * — no number (a Google sign-up) or one already confirmed. Reached from the
 * account without a number, the place to add one is the profile form.
 */
export const Route = createFileRoute("/verify-phone")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    // Explicit `undefined` rather than an absent key: the root route has no
    // `validateSearch` of its own, so it passes the raw query string through
    // unvalidated, and TanStack shallow-merges each ancestor's result onto
    // that — an empty object here would leave an unsafe `next` from the URL
    // sitting untouched in the merged search instead of being dropped.
    next: typeof search.next === "string" && isSafeInternalPath(search.next) ? search.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data: session } = await authClient.getSession();
    if (!session) throw redirect({ to: "/sign-in" });

    const user = session.user as { phoneNumber?: string | null; phoneNumberVerified?: boolean | null };
    if (search.next && (!user.phoneNumber || user.phoneNumberVerified)) {
      throw redirect({ href: search.next });
    }
    if (!search.next && !user.phoneNumber) throw redirect({ to: "/account" });
  },
  component: VerifyPhoneRoute,
});

function VerifyPhoneRoute() {
  const { next } = Route.useSearch();
  return <VerifyPhone next={next} />;
}
