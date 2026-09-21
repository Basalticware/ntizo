import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";

/** What the screen needs to open WhatsApp with the message already typed. */
export interface PhoneVerificationTicket {
  code: string;
  /** E.164 of the number to send it to. */
  businessNumber: string;
  expiresAt: Date;
}

export interface StartPhoneVerificationPort {
  execute(ctx: ExecutionContext): Promise<PhoneVerificationTicket>;
}
