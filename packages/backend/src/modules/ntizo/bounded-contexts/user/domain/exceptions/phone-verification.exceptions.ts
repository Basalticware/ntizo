import { ConflictError, UnprocessableError } from "@cosmneo/onion-lasagna";

/**
 * Refusals of "confirm my number by WhatsApp".
 *
 * The `code` strings are a PUBLIC CONTRACT: the verification screen branches
 * on them, and on `PHONE_VERIFICATION_UNAVAILABLE` it steps aside silently
 * instead of showing an error.
 */

export class PhoneNumberMissingError extends UnprocessableError {
  constructor() {
    super({ message: "This account has no phone number to confirm.", code: "PHONE_NUMBER_MISSING" });
    this.name = "PhoneNumberMissingError";
  }
}

export class PhoneNumberAlreadyVerifiedError extends ConflictError {
  constructor() {
    super({ message: "This phone number is already confirmed.", code: "PHONE_NUMBER_ALREADY_VERIFIED" });
    this.name = "PhoneNumberAlreadyVerifiedError";
  }
}

/**
 * The stage has no WhatsApp number configured, so a code issued now could
 * never be sent anywhere. qa and prod run this code before the SIM exists.
 */
export class PhoneVerificationUnavailableError extends UnprocessableError {
  constructor() {
    super({
      message: "Phone confirmation by WhatsApp is not configured on this stage.",
      code: "PHONE_VERIFICATION_UNAVAILABLE",
    });
    this.name = "PhoneVerificationUnavailableError";
  }
}
