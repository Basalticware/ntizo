// This file sits at bounded-contexts/notification/infrastructure/templates/ —
// the same depth as infrastructure/repositories/drizzle/ — so reaching
// packages/backend/src/shared takes six `../` segments, not five: templates ->
// infrastructure -> notification -> bounded-contexts -> ntizo -> modules -> src.
import { infraStore } from "../../../../../../shared/infrastructure/stores/infra-store";

/**
 * The eight this platform ships. Kept here rather than imported from the
 * frontend's i18n config: the backend must not depend on a bundle it never
 * loads, and this list changing is a deliberate act in both places.
 */
export const TEMPLATE_LOCALES = [
  "en-US", "pt-MZ", "pt-PT", "es-ES", "fr-FR", "it-IT", "de-DE", "nl-NL",
] as const;

export type TemplateLocale = (typeof TEMPLATE_LOCALES)[number];

/**
 * Re-exported from shared so better-auth's own mails and these templates
 * share one implementation. It moved there, not away: the behaviour and the
 * reasoning below it are unchanged.
 */
export { pickCopy } from "../../../../../../shared/infrastructure/email/templates/copy";

/** Every template module exports exactly this. */
export interface TemplateModule {
  render(
    locale: string,
    payload: Record<string, unknown>,
  ): { subject: string; html: string; text: string };
}

/**
 * Re-exported from shared for the same reason `pickCopy` is: better-auth's
 * verification mail greets a person by the first name they typed, and cannot
 * import from a bounded context.
 */
export { escapeHtml } from "../../../../../../shared/infrastructure/email/templates/copy";

/**
 * Where a link in an email should point.
 *
 * `APP_URL` is a per-request Worker binding, so this must be called inside a
 * request — every send is. Falls back to the local dev origin so a console
 * send is still clickable.
 */
export function appBaseUrl(): string {
  const env = infraStore.getEnv();
  return env.APP_URL ?? "http://localhost:3000";
}
