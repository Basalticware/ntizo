import { isSafeInternalPath } from "@/shared/lib/zones";

/**
 * Where an email-confirmation link lands: the phone invite first, then where
 * the person was going.
 *
 * Absolute, because better-auth resolves a relative callback against the API
 * origin. `next` is checked here because it ends up in a URL a server
 * redirects to, and an unchecked one is an open redirect.
 */
export function emailConfirmedCallbackURL(origin: string, next: string | undefined): string {
  const destination = next && isSafeInternalPath(next) ? next : "/";
  return `${origin}/verify-phone?next=${encodeURIComponent(destination)}`;
}
