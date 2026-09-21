import type { InfraEnvBindings } from "@ntizo/backend/shared/infra";
import type { Stage } from "@ntizo/backend/shared/infra/config";
import type { AppBindings } from "./types";

/**
 * The request-scoped env every entry point that is not an HTTP request opens:
 * the cron and the sweep scheduler's alarm. Moved out of `scheduled.ts`
 * unchanged, so the two cannot disagree about a fallback.
 */
export function toInfraEnv(env: AppBindings): InfraEnvBindings {
  return {
    STAGE: (env.STAGE as Stage) ?? "local",
    LOG_LEVEL: env.LOG_LEVEL ?? "info",
    DATABASE_URL: env.DATABASE_URL ?? "",
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? "dev-secret-change-me",
    RESEND_API_KEY: env.RESEND_API_KEY ?? "",
    EMAIL_FROM: env.EMAIL_FROM ?? "Ntizo <noreply@ntizo.co.mz>",
    // Same fallback configMiddleware uses: a notification email carrying a
    // link to nowhere is worse than one that only works in dev.
    APP_URL: env.APP_URL ?? "http://localhost:3000",
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? "",
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ?? "",
    // No `?? ""` on these, unlike every binding above: the adapter that
    // reads them distinguishes "absent" from "present", and an empty string
    // would be a value that fails at the gateway instead of a stage that
    // says it is not configured. This is the one scope that actually needs
    // them — the charge runs from the sweeps (the sweep scheduler's alarm, or
    // the hourly cron when it cannot tell the scheduler) and nowhere else today.
    MPESA_API_KEY: env.MPESA_API_KEY,
    MPESA_PUBLIC_KEY: env.MPESA_PUBLIC_KEY,
    MPESA_ENVIRONMENT: env.MPESA_ENVIRONMENT,
    MPESA_ORIGIN: env.MPESA_ORIGIN,
    MPESA_SERVICE_PROVIDER_CODE: env.MPESA_SERVICE_PROVIDER_CODE,
    CONTACT_INBOX_EMAIL: env.CONTACT_INBOX_EMAIL,
    WHATSAPP_ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_NUMBER: env.WHATSAPP_BUSINESS_NUMBER,
  };
}
