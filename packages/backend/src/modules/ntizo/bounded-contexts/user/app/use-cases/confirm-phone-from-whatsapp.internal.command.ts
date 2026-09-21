import type { Locale } from "@ntizo/shared";
import type {
  AuthIdentityPort,
  PhoneVerificationCodeStorePort,
  PhoneVerificationRepliesPort,
  ProfileRepositoryPort,
} from "../ports/outbound";
import type {
  ConfirmPhoneFromWhatsAppInternalInput,
  ConfirmPhoneFromWhatsAppInternalPort,
  PhoneConfirmationOutcome,
} from "../ports/inbound/confirm-phone-from-whatsapp.internal.command.port";
import { extractVerificationCode } from "../../domain/value-objects/verification-code";

/**
 * Confirms the account whose number sent us its code.
 *
 * The account is found by the SENDER, never by the code. WhatsApp verified
 * the sender's number itself, so a message from X was sent by whoever holds
 * X; the code is what ties that message to the account that asked. Codes are
 * never searched on their own, so there is no code space to guess across.
 *
 * No attempt limit: only the holder of X can send from X, and only the
 * account holding X can be confirmed by it — guessing could only confirm the
 * guesser's own number, which the code on their screen already does.
 *
 * Every outcome is answered. A reply that fails is logged and swallowed: the
 * confirmation is already written, and Meta retrying the delivery would only
 * produce "already confirmed".
 */
export class ConfirmPhoneFromWhatsAppInternalCommand implements ConfirmPhoneFromWhatsAppInternalPort {
  private readonly now: () => Date;

  constructor(
    private readonly authIdentity: AuthIdentityPort,
    private readonly codeStore: PhoneVerificationCodeStorePort,
    private readonly profileRepo: ProfileRepositoryPort,
    private readonly replies: PhoneVerificationRepliesPort,
    deps: { now?: () => Date } = {},
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: ConfirmPhoneFromWhatsAppInternalInput): Promise<PhoneConfirmationOutcome> {
    const account = await this.authIdentity.findByPhoneNumber(input.senderPhone);
    const language: Locale | null = account
      ? ((await this.profileRepo.findByUserId(account.userId))?.language ?? null)
      : null;

    const outcome = await this.decide(input, account);

    try {
      await this.replies.send(input.senderPhone, outcome, language);
    } catch (error) {
      // console.error, not the logger: this runs from a webhook with no
      // request-scoped logger set, the same reason the Resend route logs so.
      console.error(`[phone-verification] could not answer a "${outcome}" message`, error);
    }
    return outcome;
  }

  private async decide(
    input: ConfirmPhoneFromWhatsAppInternalInput,
    account: { userId: string; verified: boolean } | null,
  ): Promise<PhoneConfirmationOutcome> {
    const code = extractVerificationCode(input.text);
    if (!code) return "no-code";
    if (!account) return "no-account";
    if (account.verified) return "already-confirmed";

    const pending = await this.codeStore.find(account.userId);
    const valid =
      pending !== null &&
      pending.code === code &&
      pending.phoneNumber === input.senderPhone &&
      pending.expiresAt.getTime() > this.now().getTime();
    if (!valid) return "invalid-code";

    // Conditional on the number still being the one the code was issued for.
    const changed = await this.authIdentity.markPhoneNumberVerified(account.userId, pending.phoneNumber);
    if (!changed) return "invalid-code";

    await this.codeStore.delete(account.userId);
    return "confirmed";
  }
}
