import type { Locale } from "@ntizo/shared";
import type { PhoneVerificationRepliesPort } from "../../app/ports/outbound";
import type { PhoneConfirmationOutcome } from "../../app/ports/inbound/confirm-phone-from-whatsapp.internal.command.port";
import type { WhatsAppMessengerPort } from "../../../../../../shared/infrastructure/whatsapp";
import { infraStore } from "../../../../../../shared/infrastructure/stores/infra-store";

const DEFAULT_CONTACT_EMAIL = "ola@ntizo.co.mz";

type Ctx = { phone: string; contactEmail: string };

const PT: Record<PhoneConfirmationOutcome, (c: Ctx) => string> = {
  confirmed: () => "✅ Número confirmado. Pode voltar à Ntizo.",
  "no-account": (c) =>
    `Não encontrámos nenhuma conta Ntizo com o número ${c.phone}. Envie a mensagem a partir do WhatsApp do número que registou.`,
  "invalid-code": () =>
    "Este código já não é válido. Volte à Ntizo e toque outra vez em Confirmar pelo WhatsApp.",
  "already-confirmed": () => "O seu número já está confirmado.",
  "no-code": (c) => `Este número serve só para confirmar contas Ntizo. Para ajuda, escreva para ${c.contactEmail}.`,
};

const EN: Record<PhoneConfirmationOutcome, (c: Ctx) => string> = {
  confirmed: () => "✅ Number confirmed. You can go back to Ntizo.",
  "no-account": (c) =>
    `We couldn't find a Ntizo account with the number ${c.phone}. Send the message from the WhatsApp of the number you registered.`,
  "invalid-code": () => "This code is no longer valid. Go back to Ntizo and tap Confirm with WhatsApp again.",
  "already-confirmed": () => "Your number is already confirmed.",
  "no-code": (c) => `This number is only for confirming Ntizo accounts. For help, write to ${c.contactEmail}.`,
};

/**
 * Portuguese for the launch market and for anyone whose language is unknown,
 * English for everyone else. "No account" never has a profile to read, so it
 * always lands in Portuguese.
 */
export function phoneVerificationReply(
  outcome: PhoneConfirmationOutcome,
  language: Locale | null,
  ctx: Ctx,
): string {
  const table = language === null || language.startsWith("pt") ? PT : EN;
  return table[outcome](ctx);
}

export class WhatsAppPhoneVerificationReplies implements PhoneVerificationRepliesPort {
  constructor(
    private readonly messenger: WhatsAppMessengerPort,
    private readonly contactEmail: () => string = () =>
      infraStore.getEnv().CONTACT_INBOX_EMAIL || DEFAULT_CONTACT_EMAIL,
  ) {}

  async send(to: string, outcome: PhoneConfirmationOutcome, language: Locale | null): Promise<void> {
    const body = phoneVerificationReply(outcome, language, { phone: to, contactEmail: this.contactEmail() });
    await this.messenger.sendText(to, body);
  }
}
