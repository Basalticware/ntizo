import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithRouter } from "@/test/render-with-router";
import type { PhoneVerificationState } from "@/features/auth/viewmodel/use-phone-verification";

const fakes = vi.hoisted(() => ({
  state: { status: "starting" } as PhoneVerificationState,
  markSent: vi.fn(),
  restart: vi.fn(),
}));

vi.mock("@/features/auth/viewmodel/use-phone-verification", () => ({
  usePhoneVerification: () => ({ state: fakes.state, markSent: fakes.markSent, restart: fakes.restart }),
}));
vi.mock("@/shared/lib/api/auth-client", () => ({
  useSession: () => ({ data: { user: { phoneNumber: "+258879801517" } }, isPending: false }),
}));

const { VerifyPhone } = await import("../verify-phone");

const TICKET = {
  code: "483920",
  businessNumber: "+258843002020",
  expiresAt: new Date("2026-09-21T14:52:00.000Z"),
  link: "https://wa.me/258843002020?text=Hi%20Ntizo!%20My%20confirmation%20code%20is%20483920",
};
const ROUTES = ["/account", "/bookings"];

beforeEach(() => {
  fakes.markSent.mockReset();
  fakes.restart.mockReset();
});

describe("VerifyPhone", () => {
  it("offers WhatsApp as a real link, and marks the person as waiting when they use it", async () => {
    fakes.state = { status: "ready", ...TICKET };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });

    expect(screen.getByRole("heading", { name: /confirm your number/i })).toBeInTheDocument();
    expect(screen.getByText("Email confirmed")).toBeInTheDocument();
    expect(screen.getByText("+258 87 980 1517")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /change/i })).toHaveAttribute("href", "/account");

    const whatsapp = screen.getByRole("link", { name: /confirm with whatsapp/i });
    expect(whatsapp).toHaveAttribute("href", TICKET.link);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    fireEvent.click(whatsapp);
    expect(fakes.markSent).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument();
  });

  it("draws the same focus ring on the way out as on every other action", async () => {
    fakes.state = { status: "ready", ...TICKET };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("button", { name: /not now/i }).className).toContain("focus-visible:ring-2");
  });

  it("from the account, offers the way back instead of 'not now', and says nothing about the email", async () => {
    fakes.state = { status: "ready", ...TICKET };
    await renderWithRouter(<VerifyPhone />, { routes: ROUTES });
    expect(screen.queryByText("Email confirmed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /not now/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to account/i })).toHaveAttribute("href", "/account");
  });

  it("while waiting, shows the message and the code, and can reopen WhatsApp", async () => {
    fakes.state = { status: "waiting", ...TICKET };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /tap send in whatsapp/i })).toBeInTheDocument();
    expect(screen.getByText("483920")).toBeInTheDocument();
    expect(screen.getByText(/waiting for the message/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open whatsapp again/i })).toHaveAttribute("href", TICKET.link);
  });

  it("while waiting on a phone, puts the message right after the lede, before 'not now'", async () => {
    fakes.state = { status: "waiting", ...TICKET };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    const heading = screen.getByRole("heading", { name: /tap send in whatsapp/i });
    const code = screen.getByText("483920");
    const notNow = screen.getByRole("button", { name: /not now/i });
    expect(heading.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(code.compareDocumentPosition(notNow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("once confirmed, continues to where the person was going", async () => {
    fakes.state = { status: "confirmed" };
    const { router } = await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /number confirmed/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/bookings"));
  });

  it("when the code expired, asks for a new one", async () => {
    fakes.state = { status: "expired" };
    await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /the code has expired/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /get a new code/i }));
    expect(fakes.restart).toHaveBeenCalled();
  });

  it("as an invite on a stage without WhatsApp, steps aside to where the person was going", async () => {
    fakes.state = { status: "unavailable" };
    const { router } = await renderWithRouter(<VerifyPhone next="/bookings" />, { routes: ROUTES });
    await vi.waitFor(() => expect(router.state.location.pathname).toBe("/bookings"));
  });

  it("from the account, says it could not start and offers a retry", async () => {
    fakes.state = { status: "unavailable" };
    await renderWithRouter(<VerifyPhone />, { routes: ROUTES });
    expect(screen.getByRole("heading", { name: /couldn't start right now/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(fakes.restart).toHaveBeenCalled();
  });
});
