import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";

const fakes = vi.hoisted(() => ({
  start: vi.fn(),
  getSession: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@/features/user/data/user.repository", () => ({ startPhoneVerification: fakes.start }));
vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { getSession: fakes.getSession, $store: { notify: fakes.notify } },
}));

const { usePhoneVerification, POLL_INTERVAL_MS } = await import("../use-phone-verification");

const NOW = new Date("2026-09-21T14:37:00.000Z");
const TICKET = { code: "483920", businessNumber: "+258843002020", expiresAt: "2026-09-21T14:52:00.000Z" };
const message = (code: string) => `Olá Ntizo! O meu código de confirmação é ${code}`;

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fakes.start.mockReset().mockResolvedValue(TICKET);
  fakes.getSession.mockReset().mockResolvedValue({ data: { user: { phoneNumberVerified: false } } });
  fakes.notify.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePhoneVerification", () => {
  it("issues a code on mount and builds the WhatsApp link from it", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    expect(result.current.state.status).toBe("starting");
    await flush();
    expect(result.current.state).toMatchObject({
      status: "ready",
      code: "483920",
      businessNumber: "+258843002020",
      expiresAt: new Date(TICKET.expiresAt),
    });
    expect(result.current.state.status === "ready" && result.current.state.link).toContain(
      "https://wa.me/258843002020?text=",
    );
  });

  it("waits once the link is used, and confirms when the session says so", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    act(() => result.current.markSent());
    expect(result.current.state.status).toBe("waiting");

    fakes.getSession.mockResolvedValue({ data: { user: { phoneNumberVerified: true } } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    expect(fakes.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(result.current.state.status).toBe("confirmed");
    expect(fakes.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("checks at once when the person comes back to the tab", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    act(() => result.current.markSent());
    fakes.getSession.mockResolvedValue({ data: { user: { phoneNumberVerified: true } } });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.state.status).toBe("confirmed");
  });

  it("does not poll before the link is used", async () => {
    renderHook(() => usePhoneVerification(message));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    });
    expect(fakes.getSession).not.toHaveBeenCalled();
  });

  it("expires at the code's own expiry", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    act(() => result.current.markSent());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    });
    expect(result.current.state.status).toBe("expired");
  });

  it("issues a fresh code on restart", async () => {
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    fakes.start.mockResolvedValue({ ...TICKET, code: "777777" });
    await act(async () => {
      result.current.restart();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toMatchObject({ status: "ready", code: "777777" });
  });

  it("reports an unconfigured stage as unavailable, and an already-confirmed number as confirmed", async () => {
    fakes.start.mockRejectedValue(
      new GraphqlError(200, [{ message: "x", extensions: { code: "UNPROCESSABLE", originalCode: "PHONE_VERIFICATION_UNAVAILABLE" } }] as never),
    );
    const first = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(first.result.current.state.status).toBe("unavailable");

    fakes.start.mockRejectedValue(
      new GraphqlError(200, [{ message: "x", extensions: { code: "CONFLICT", originalCode: "PHONE_NUMBER_ALREADY_VERIFIED" } }] as never),
    );
    const second = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(second.result.current.state.status).toBe("confirmed");
  });

  it("refreshes the shared session when start finds the number already verified", async () => {
    fakes.start.mockRejectedValue(
      new GraphqlError(200, [{ message: "x", extensions: { code: "CONFLICT", originalCode: "PHONE_NUMBER_ALREADY_VERIFIED" } }] as never),
    );
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(result.current.state.status).toBe("confirmed");
    expect(fakes.getSession).toHaveBeenCalledWith({ query: { disableCookieCache: true } });
    expect(fakes.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("ignores a stale already-verified confirmation once a newer attempt has replaced it", async () => {
    let resolveGetSession!: (value: { data: { user: { phoneNumberVerified: boolean } } }) => void;
    fakes.start.mockRejectedValueOnce(
      new GraphqlError(200, [{ message: "x", extensions: { code: "CONFLICT", originalCode: "PHONE_NUMBER_ALREADY_VERIFIED" } }] as never),
    );
    fakes.getSession.mockImplementationOnce(
      () => new Promise((resolve) => (resolveGetSession = resolve)),
    );
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();

    fakes.start.mockResolvedValueOnce({ ...TICKET, code: "999999" });
    await act(async () => {
      result.current.restart();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toMatchObject({ status: "ready", code: "999999" });

    await act(async () => {
      resolveGetSession({ data: { user: { phoneNumberVerified: true } } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toMatchObject({ status: "ready", code: "999999" });
  });

  it("reports anything else as failed", async () => {
    fakes.start.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => usePhoneVerification(message));
    await flush();
    expect(result.current.state.status).toBe("failed");
  });

  it("ignores an answer that arrives after a newer request was made", async () => {
    let resolveFirst!: (value: typeof TICKET) => void;
    fakes.start
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ ...TICKET, code: "222222" });
    const { result } = renderHook(() => usePhoneVerification(message));
    await act(async () => {
      result.current.restart();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      resolveFirst({ ...TICKET, code: "111111" });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state).toMatchObject({ status: "ready", code: "222222" });
  });
});
