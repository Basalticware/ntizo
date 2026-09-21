import { describe, expect, it } from "vitest";
import { emailConfirmedCallbackURL } from "../email-callback";

describe("emailConfirmedCallbackURL", () => {
  it("lands on the phone invite first, carrying where the person was going", () => {
    expect(emailConfirmedCallbackURL("https://dev.ntizo.co.mz", "/book/svc-1?memberId=m1")).toBe(
      "https://dev.ntizo.co.mz/verify-phone?next=%2Fbook%2Fsvc-1%3FmemberId%3Dm1",
    );
  });

  it("goes home afterwards when there was nowhere in particular", () => {
    expect(emailConfirmedCallbackURL("https://dev.ntizo.co.mz", undefined)).toBe(
      "https://dev.ntizo.co.mz/verify-phone?next=%2F",
    );
  });

  it("never carries an outside address", () => {
    expect(emailConfirmedCallbackURL("https://dev.ntizo.co.mz", "//evil.example/x")).toBe(
      "https://dev.ntizo.co.mz/verify-phone?next=%2F",
    );
  });
});
