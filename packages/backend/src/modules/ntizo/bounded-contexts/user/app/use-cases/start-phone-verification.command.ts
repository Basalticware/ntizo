import type {
  AuthIdentityPort,
  PhoneVerificationChannelPort,
  PhoneVerificationCodeStorePort,
} from "../ports/outbound";
import type {
  PhoneVerificationTicket,
  StartPhoneVerificationPort,
} from "../ports/inbound/start-phone-verification.command.port";
import {
  type ExecutionContext,
  requireAuthenticated,
} from "../../../../shared/infrastructure/execution-context";
import {
  PhoneNumberAlreadyVerifiedError,
  PhoneNumberMissingError,
  PhoneVerificationUnavailableError,
} from "../../domain/exceptions";
import { generateVerificationCode } from "../../domain/value-objects/verification-code";

/** Long enough to switch to WhatsApp, find the chat, send, and come back. */
export const PHONE_VERIFICATION_TTL_MS = 15 * 60 * 1000;

/**
 * Issues the code the caller will send us from WhatsApp.
 *
 * The subject is always the caller. There is no input at all: the number is
 * the one already on the account, read here rather than supplied, so nobody
 * can aim a code at a number that is not theirs.
 *
 * Availability is checked first so an unconfigured stage never touches the
 * database. The screen treats that refusal as "step aside", not as an error.
 */
export class StartPhoneVerificationCommand implements StartPhoneVerificationPort {
  private readonly now: () => Date;
  private readonly generateCode: () => string;

  constructor(
    private readonly authIdentity: AuthIdentityPort,
    private readonly codeStore: PhoneVerificationCodeStorePort,
    private readonly channel: PhoneVerificationChannelPort,
    deps: { now?: () => Date; generateCode?: () => string } = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.generateCode = deps.generateCode ?? (() => generateVerificationCode());
  }

  async execute(ctx: ExecutionContext): Promise<PhoneVerificationTicket> {
    const requester = requireAuthenticated(ctx);

    const businessNumber = this.channel.businessNumber();
    if (!businessNumber) throw new PhoneVerificationUnavailableError();

    const phone = await this.authIdentity.findPhoneOf(requester.userId);
    if (!phone) throw new PhoneNumberMissingError();
    if (phone.verified) throw new PhoneNumberAlreadyVerifiedError();

    const code = this.generateCode();
    const expiresAt = new Date(this.now().getTime() + PHONE_VERIFICATION_TTL_MS);
    await this.codeStore.replace(requester.userId, {
      code,
      phoneNumber: phone.phoneNumber,
      expiresAt,
    });

    return { code, businessNumber, expiresAt };
  }
}
