/**
 * Sends a free-form text message on WhatsApp.
 *
 * Only ever used to answer a message the person sent us first, which is what
 * keeps it free: a non-template message inside the 24-hour window that their
 * message opened is not charged.
 */
export interface WhatsAppMessengerPort {
  /** `to` in E.164 (`+258841234567`). Throws when the message was not accepted. */
  sendText(to: string, body: string): Promise<void>;
}
