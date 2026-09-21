import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/render-with-router";

vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { signUp: { email: vi.fn() }, signIn: { social: vi.fn() }, sendVerificationEmail: vi.fn() },
  API_BASE_URL: "",
  AUTH_API_URL_FALLBACK: "http://localhost:8788",
}));

const { SignUp } = await import("../sign-up");

describe("SignUp", () => {
  it("says the number is confirmed on WhatsApp, and promises no SMS", async () => {
    await renderWithRouter(<SignUp />, { routes: ["/sign-in", "/terms", "/privacy"] });
    expect(screen.getByText("You'll confirm it with a WhatsApp message.")).toBeInTheDocument();
    expect(screen.queryByText(/sms/i)).not.toBeInTheDocument();
  });
});
