import { describe, expect, it } from "vitest";
import { formatPhone, whatsAppLink } from "../phone-verification";

describe("whatsAppLink", () => {
  it("opens a chat with Ntizo's number and the message already typed", () => {
    expect(whatsAppLink("+258843002020", "Olá Ntizo! O meu código de confirmação é 483920")).toBe(
      "https://wa.me/258843002020?text=Ol%C3%A1%20Ntizo!%20O%20meu%20c%C3%B3digo%20de%20confirma%C3%A7%C3%A3o%20%C3%A9%20483920",
    );
  });

  it("keeps only the digits of the number", () => {
    expect(whatsAppLink("+258 84 300 2020", "x")).toBe("https://wa.me/258843002020?text=x");
  });
});

describe("formatPhone", () => {
  it("spaces an E.164 number the way people read it", () => {
    expect(formatPhone("+258841234567")).toBe("+258 84 123 4567");
  });

  it("returns anything it cannot read untouched", () => {
    expect(formatPhone("not a number")).toBe("not a number");
  });
});
