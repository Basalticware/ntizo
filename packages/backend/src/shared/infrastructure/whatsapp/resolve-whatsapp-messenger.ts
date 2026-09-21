import { infraStore } from "../stores/infra-store";
import { CloudApiWhatsAppMessengerAdapter } from "./cloud-api-whatsapp-messenger.adapter";
import { ConsoleWhatsAppMessengerAdapter } from "./console-whatsapp-messenger.adapter";
import type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";

/**
 * Picks the sender from the request-scoped env, the way `resolveEmailService`
 * picks the mail adapter. Must be called from inside a request.
 */
export function resolveWhatsAppMessenger(): WhatsAppMessengerPort {
  const env = infraStore.getEnv();
  const stage = env.STAGE ?? "local";

  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    return new CloudApiWhatsAppMessengerAdapter({
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    });
  }

  if (stage !== "local") {
    throw new Error(
      `[whatsapp] WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required when STAGE="${stage}".`,
    );
  }

  return new ConsoleWhatsAppMessengerAdapter();
}

/** Resolves on every send, so the check runs against the current request's env. */
export class LazyWhatsAppMessenger implements WhatsAppMessengerPort {
  async sendText(to: string, body: string): Promise<void> {
    await resolveWhatsAppMessenger().sendText(to, body);
  }
}
