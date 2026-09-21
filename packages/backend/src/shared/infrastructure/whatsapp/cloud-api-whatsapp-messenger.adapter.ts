import type { WhatsAppMessengerPort } from "./whatsapp-messenger.port";

/** Pinned rather than "latest": a version bump is a deliberate edit, not a surprise. */
export const WHATSAPP_GRAPH_API_VERSION = "v25.0";

export class CloudApiWhatsAppMessengerAdapter implements WhatsAppMessengerPort {
  /** `fetchFn` is injectable so the request shape is testable; production passes nothing. */
  constructor(
    private readonly config: { accessToken: string; phoneNumberId: string },
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendText(to: string, body: string): Promise<void> {
    const res = await this.fetchFn(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      // The status and Meta's own explanation; never the recipient or the body.
      throw new Error(`[whatsapp] Meta refused the message: ${res.status} ${await res.text()}`);
    }
  }
}
