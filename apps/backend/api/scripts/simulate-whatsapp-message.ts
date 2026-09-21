/**
 * Plays Meta for a local run: signs an inbound WhatsApp message the way Meta
 * does and posts it to the local API, so the whole confirmation works with no
 * Meta account. Replies print in the `wrangler dev` terminal.
 *
 *   bun scripts/simulate-whatsapp-message.ts +258841234567 "Olá Ntizo! O meu código de confirmação é 483920"
 *
 * Reads WHATSAPP_APP_SECRET from the environment (bun loads .env); it must
 * match the value in .dev.vars that `wrangler dev` runs with.
 */
import { createHmac } from "node:crypto";

const [from, text] = process.argv.slice(2);
const secret = process.env.WHATSAPP_APP_SECRET;
const url = process.env.WHATSAPP_WEBHOOK_URL ?? "http://localhost:8788/api/webhooks/whatsapp";

if (!from?.startsWith("+") || !text || !secret) {
  console.error('Usage: WHATSAPP_APP_SECRET=… bun scripts/simulate-whatsapp-message.ts +2588… "text"');
  process.exit(1);
}

const body = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "local",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "local", phone_number_id: "local" },
            messages: [
              {
                from: from.slice(1),
                id: `wamid.local.${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: text },
              },
            ],
          },
        },
      ],
    },
  ],
});

const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
  },
  body,
});
console.log(res.status, await res.text());
