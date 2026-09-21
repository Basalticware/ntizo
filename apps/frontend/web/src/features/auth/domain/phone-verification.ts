import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * A link that opens WhatsApp on a chat with `businessNumber`, with `message`
 * already typed. `wa.me` wants the number as bare digits.
 */
export function whatsAppLink(businessNumber: string, message: string): string {
  return `https://wa.me/${businessNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

/** "+258841234567" → "+258 84 123 4567"; anything unreadable comes back as it was. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
