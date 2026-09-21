import { describe, expect, it } from "bun:test";
import { ConflictError, UnprocessableError } from "@cosmneo/onion-lasagna";
import {
  PhoneNumberAlreadyVerifiedError,
  PhoneNumberMissingError,
  PhoneVerificationUnavailableError,
} from "..";

// The codes are a public contract: the web branches on them.
describe("phone verification refusals", () => {
  it("names a missing number", () => {
    const error = new PhoneNumberMissingError();
    expect(error).toBeInstanceOf(UnprocessableError);
    expect(error.code).toBe("PHONE_NUMBER_MISSING");
  });

  it("names a number that is already confirmed", () => {
    const error = new PhoneNumberAlreadyVerifiedError();
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe("PHONE_NUMBER_ALREADY_VERIFIED");
  });

  it("names a stage with no WhatsApp configured", () => {
    const error = new PhoneVerificationUnavailableError();
    expect(error).toBeInstanceOf(UnprocessableError);
    expect(error.code).toBe("PHONE_VERIFICATION_UNAVAILABLE");
  });
});
