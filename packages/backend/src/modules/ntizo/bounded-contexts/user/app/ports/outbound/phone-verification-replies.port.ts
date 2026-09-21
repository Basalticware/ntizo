import type { Locale } from "@ntizo/shared";
import type { PhoneConfirmationOutcome } from "../inbound/confirm-phone-from-whatsapp.internal.command.port";

/** Answers the sender, in WhatsApp, where they are when the answer matters. */
export interface PhoneVerificationRepliesPort {
  send(to: string, outcome: PhoneConfirmationOutcome, language: Locale | null): Promise<void>;
}
