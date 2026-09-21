/** A code waiting to arrive from WhatsApp. */
export interface PendingPhoneVerification {
  code: string;
  /** The E.164 number the code was issued for. */
  phoneNumber: string;
  expiresAt: Date;
}

/** One pending code per account: issuing a new one replaces the old. */
export interface PhoneVerificationCodeStorePort {
  replace(userId: string, pending: PendingPhoneVerification): Promise<void>;
  find(userId: string): Promise<PendingPhoneVerification | null>;
  delete(userId: string): Promise<void>;
}
