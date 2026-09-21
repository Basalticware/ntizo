import { describe, expect, it } from "bun:test";
import { extractVerificationCode, generateVerificationCode } from "../verification-code";

describe("generateVerificationCode", () => {
  it("is always six digits, keeping leading zeros", () => {
    const code = generateVerificationCode((buffer) => {
      buffer[0] = 42;
      return buffer;
    });
    expect(code).toBe("000042");
  });

  it("discards a draw that would bias the result and draws again", () => {
    // 4_294_967_295 is above the largest multiple of 1_000_000 that fits in a
    // uint32 (4_294_000_000); taking it modulo would favour low codes.
    const draws = [4_294_967_295, 7];
    const code = generateVerificationCode((buffer) => {
      buffer[0] = draws.shift()!;
      return buffer;
    });
    expect(code).toBe("000007");
    expect(draws).toEqual([]);
  });

  it("uses the platform's cryptographic source by default", () => {
    for (let i = 0; i < 50; i++) expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });
});

describe("extractVerificationCode", () => {
  it("finds the code in the pre-filled Portuguese message", () => {
    expect(extractVerificationCode("Olá Ntizo! O meu código de confirmação é 483920")).toBe("483920");
  });

  it("finds it whatever language the message was written in", () => {
    expect(extractVerificationCode("Hi Ntizo! My confirmation code is 012345")).toBe("012345");
  });

  it("does not take six digits out of a longer number", () => {
    expect(extractVerificationCode("ligue-me para 258841234567")).toBeNull();
  });

  it("returns null when there is no code", () => {
    expect(extractVerificationCode("Olá")).toBeNull();
  });

  it("returns null when there is no text at all", () => {
    expect(extractVerificationCode(null)).toBeNull();
  });
});
