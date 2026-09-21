/** The WhatsApp number people send their code to, when this stage has one. */
export interface PhoneVerificationChannelPort {
  /** E.164, or null when the stage is not configured. */
  businessNumber(): string | null;
}
