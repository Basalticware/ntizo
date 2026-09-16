import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const fakes = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));

vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { sendVerificationEmail: fakes.sendVerificationEmail },
  API_BASE_URL: "",
  AUTH_API_URL_FALLBACK: "http://localhost:8788",
}));

const { ResendVerification } = await import("../resend-verification");

describe("ResendVerification", () => {
  it("says why when the new link was refused", async () => {
    fakes.sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests" },
    });
    render(<ResendVerification email="ana@example.com" callbackURL="http://localhost:3000/" />);

    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));

    expect(
      await screen.findByText("Too many attempts. Wait a moment and try again."),
    ).toBeInTheDocument();
    // Still there: a refusal is a reason to try again later, not a dead end.
    expect(screen.getByRole("button", { name: "Resend confirmation email" })).toBeEnabled();
  });

  it("does not send twice while the first request is still out", async () => {
    let finish: (v: unknown) => void = () => {};
    fakes.sendVerificationEmail.mockReset();
    fakes.sendVerificationEmail.mockReturnValue(new Promise((r) => (finish = r)));
    render(<ResendVerification email="ana@example.com" callbackURL="http://localhost:3000/" />);

    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();

    finish({ data: { status: true }, error: null });
    expect(await screen.findByText("We sent a new link to ana@example.com.")).toBeInTheDocument();
    expect(fakes.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});
