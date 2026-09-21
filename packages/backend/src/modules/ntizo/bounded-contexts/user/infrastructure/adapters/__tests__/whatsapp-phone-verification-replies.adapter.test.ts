import { describe, expect, it } from "bun:test";
import {
  phoneVerificationReply,
  WhatsAppPhoneVerificationReplies,
} from "../whatsapp-phone-verification-replies.adapter";

const CTX = { phone: "+258841112233", contactEmail: "ola@ntizo.co.mz" };

describe("phoneVerificationReply", () => {
  it("speaks Portuguese to pt-MZ, pt-PT and an unknown language", () => {
    const expected = "✅ Número confirmado. Pode voltar à Ntizo.";
    expect(phoneVerificationReply("confirmed", "pt-MZ", CTX)).toBe(expected);
    expect(phoneVerificationReply("confirmed", "pt-PT", CTX)).toBe(expected);
    expect(phoneVerificationReply("confirmed", null, CTX)).toBe(expected);
  });

  it("speaks English to every other language", () => {
    expect(phoneVerificationReply("confirmed", "de-DE", CTX)).toBe("✅ Number confirmed. You can go back to Ntizo.");
  });

  it("names the number that has no account", () => {
    expect(phoneVerificationReply("no-account", null, CTX)).toBe(
      "Não encontrámos nenhuma conta Ntizo com o número +258841112233. Envie a mensagem a partir do WhatsApp do número que registou.",
    );
  });

  it("points a message with no code at the help address", () => {
    expect(phoneVerificationReply("no-code", "pt-MZ", CTX)).toBe(
      "Este número serve só para confirmar contas Ntizo. Para ajuda, escreva para ola@ntizo.co.mz.",
    );
  });

  it("has the two remaining replies", () => {
    expect(phoneVerificationReply("invalid-code", "pt-MZ", CTX)).toBe(
      "Este código já não é válido. Volte à Ntizo e toque outra vez em Confirmar pelo WhatsApp.",
    );
    expect(phoneVerificationReply("already-confirmed", "pt-MZ", CTX)).toBe("O seu número já está confirmado.");
  });
});

describe("WhatsAppPhoneVerificationReplies", () => {
  it("sends the composed reply to the sender", async () => {
    const sent: { to: string; body: string }[] = [];
    const replies = new WhatsAppPhoneVerificationReplies(
      { sendText: async (to, body) => void sent.push({ to, body }) },
      () => "ola@ntizo.co.mz",
    );
    await replies.send("+258879801517", "already-confirmed", "en-US");
    expect(sent).toEqual([{ to: "+258879801517", body: "Your number is already confirmed." }]);
  });
});
