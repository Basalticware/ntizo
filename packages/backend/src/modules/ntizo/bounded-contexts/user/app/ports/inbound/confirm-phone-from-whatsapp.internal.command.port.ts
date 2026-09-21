/** What became of one inbound message. Each one is answered in WhatsApp. */
export type PhoneConfirmationOutcome =
  | "confirmed"
  | "no-account"
  | "invalid-code"
  | "already-confirmed"
  | "no-code";

export interface ConfirmPhoneFromWhatsAppInternalInput {
  /** E.164: `"+"` and Meta's `from` digits. */
  senderPhone: string;
  /** The text of a text message; null for any other kind (audio, image...). */
  text: string | null;
}

/** Internal: only the signed WhatsApp webhook calls it. */
export interface ConfirmPhoneFromWhatsAppInternalPort {
  execute(input: ConfirmPhoneFromWhatsAppInternalInput): Promise<PhoneConfirmationOutcome>;
}
