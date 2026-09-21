import type { PhoneVerificationChannelPort } from "../../app/ports/outbound";
import { infraStore } from "../../../../../../shared/infrastructure/stores/infra-store";

/** Reads the stage's WhatsApp number from the request-scoped env on every call. */
export class EnvPhoneVerificationChannel implements PhoneVerificationChannelPort {
  businessNumber(): string | null {
    const value = infraStore.getEnv().WHATSAPP_BUSINESS_NUMBER?.trim();
    return value ? value : null;
  }
}
