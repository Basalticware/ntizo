import { describe, expect, it, spyOn } from "bun:test";
import { infraStore, type InfraEnvBindings } from "../../stores/infra-store";
import {
  CloudApiWhatsAppMessengerAdapter,
  ConsoleWhatsAppMessengerAdapter,
  resolveWhatsAppMessenger,
  WHATSAPP_GRAPH_API_VERSION,
} from "..";

const BASE_ENV: InfraEnvBindings = {
  STAGE: "local",
  LOG_LEVEL: "info",
  DATABASE_URL: "",
  BETTER_AUTH_SECRET: "x",
  RESEND_API_KEY: "",
  EMAIL_FROM: "x",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

describe("CloudApiWhatsAppMessengerAdapter", () => {
  it("sends one text message through the Graph API with the bearer token", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    }) as unknown as typeof fetch;

    await new CloudApiWhatsAppMessengerAdapter(
      { accessToken: "token-1", phoneNumberId: "1234" },
      fakeFetch,
    ).sendText("+258841234567", "✅ Número confirmado.");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/1234/messages`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+258841234567",
      type: "text",
      text: { body: "✅ Número confirmado." },
    });
  });

  it("throws when Meta refuses the message", async () => {
    const fakeFetch = (async () =>
      new Response('{"error":{"message":"Invalid OAuth access token"}}', { status: 401 })) as unknown as typeof fetch;

    await expect(
      new CloudApiWhatsAppMessengerAdapter({ accessToken: "bad", phoneNumberId: "1234" }, fakeFetch).sendText(
        "+258841234567",
        "x",
      ),
    ).rejects.toThrow("401");
  });
});

describe("ConsoleWhatsAppMessengerAdapter", () => {
  it("prints the reply instead of sending it", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleWhatsAppMessengerAdapter().sendText("+258841234567", "✅ Número confirmado.");
    const printed = info.mock.calls.map((c) => String(c[0])).join("\n");
    info.mockRestore();
    expect(printed).toContain("+258841234567");
    expect(printed).toContain("✅ Número confirmado.");
  });
});

describe("resolveWhatsAppMessenger", () => {
  it("uses the Cloud API when the token and the number id are both set", async () => {
    await infraStore.runAsync(
      { ...BASE_ENV, STAGE: "dev", WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" },
      async () => {
        expect(resolveWhatsAppMessenger()).toBeInstanceOf(CloudApiWhatsAppMessengerAdapter);
      },
    );
  });

  it("prints to the terminal on a local run without them", async () => {
    await infraStore.runAsync({ ...BASE_ENV, STAGE: "local" }, async () => {
      expect(resolveWhatsAppMessenger()).toBeInstanceOf(ConsoleWhatsAppMessengerAdapter);
    });
  });

  it("refuses on a deployed stage without them rather than dropping replies", async () => {
    await infraStore.runAsync({ ...BASE_ENV, STAGE: "qa" }, async () => {
      expect(() => resolveWhatsAppMessenger()).toThrow("WHATSAPP_ACCESS_TOKEN");
    });
  });
});
