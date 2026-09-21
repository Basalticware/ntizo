import type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";

/**
 * Local-development sender. Prints the reply instead of sending it, so the
 * whole confirmation can be exercised with `scripts/simulate-whatsapp-message.ts`
 * and no Meta account.
 */
export class ConsoleWhatsAppMessengerAdapter implements WhatsAppMessengerPort {
  async sendText(to: string, body: string): Promise<void> {
    console.info(
      [
        "",
        "┌─────────────────────────────────────────────────────────────",
        "│ WhatsApp (console adapter — nothing was actually sent)",
        `│ to   : ${to}`,
        `│ body : ${body}`,
        "└─────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}
