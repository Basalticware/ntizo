import { describe, expect, it } from "bun:test";
import { infraStore, type InfraEnvBindings } from "../../../../../../../shared/infrastructure/stores/infra-store";
import { EnvPhoneVerificationChannel } from "../env-phone-verification-channel.adapter";

const ENV: InfraEnvBindings = {
  STAGE: "dev",
  LOG_LEVEL: "info",
  DATABASE_URL: "",
  BETTER_AUTH_SECRET: "x",
  RESEND_API_KEY: "",
  EMAIL_FROM: "x",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
};

describe("EnvPhoneVerificationChannel", () => {
  it("answers with the configured number", async () => {
    await infraStore.runAsync({ ...ENV, WHATSAPP_BUSINESS_NUMBER: "+258843002020" }, async () => {
      expect(new EnvPhoneVerificationChannel().businessNumber()).toBe("+258843002020");
    });
  });

  it("treats an absent or blank value as not configured", async () => {
    await infraStore.runAsync(ENV, async () => {
      expect(new EnvPhoneVerificationChannel().businessNumber()).toBeNull();
    });
    await infraStore.runAsync({ ...ENV, WHATSAPP_BUSINESS_NUMBER: "  " }, async () => {
      expect(new EnvPhoneVerificationChannel().businessNumber()).toBeNull();
    });
  });
});
