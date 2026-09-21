import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/shared/lib/api/auth-client";
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";
import { startPhoneVerification } from "@/features/user/data/user.repository";
import { whatsAppLink } from "@/features/auth/domain/phone-verification";

/** One small session read per open waiting screen, for at most 15 minutes. */
export const POLL_INTERVAL_MS = 3000;

interface Ticket {
  code: string;
  businessNumber: string;
  expiresAt: Date;
  link: string;
}

export type PhoneVerificationState =
  | { status: "starting" }
  | ({ status: "ready" } & Ticket)
  | ({ status: "waiting" } & Ticket)
  | { status: "confirmed" }
  | { status: "expired" }
  | { status: "unavailable" }
  | { status: "failed" };

/**
 * Drives "confirm my number by WhatsApp".
 *
 * The code is issued on mount so the page's button can be a plain link: a
 * `window.open` that waits on a network answer first is a blocked popup on
 * iOS and in desktop browsers.
 *
 * While waiting it reads the session every 3 s and the moment the tab comes
 * back into view, skipping better-auth's 60-second cookie cache, which would
 * otherwise hide the confirmation for up to a minute.
 */
export function usePhoneVerification(messageFor: (code: string) => string) {
  const [state, setState] = useState<PhoneVerificationState>({ status: "starting" });
  const attempt = useRef(0);
  const messageRef = useRef(messageFor);
  messageRef.current = messageFor;

  const start = useCallback(async () => {
    const mine = ++attempt.current;
    setState({ status: "starting" });
    try {
      const ticket = await startPhoneVerification();
      if (mine !== attempt.current) return;
      setState({
        status: "ready",
        code: ticket.code,
        businessNumber: ticket.businessNumber,
        expiresAt: new Date(ticket.expiresAt),
        link: whatsAppLink(ticket.businessNumber, messageRef.current(ticket.code)),
      });
    } catch (error) {
      if (mine !== attempt.current) return;
      const code = error instanceof GraphqlError ? error.code : undefined;
      if (code === "PHONE_VERIFICATION_UNAVAILABLE") setState({ status: "unavailable" });
      else if (code === "PHONE_NUMBER_ALREADY_VERIFIED") setState({ status: "confirmed" });
      else setState({ status: "failed" });
    }
  }, []);

  useEffect(() => {
    void start();
    // Invalidates the in-flight request, so StrictMode's double mount keeps
    // only the second code — the one the server actually has.
    return () => {
      attempt.current++;
    };
  }, [start]);

  const expiresAt =
    state.status === "ready" || state.status === "waiting" ? state.expiresAt.getTime() : null;
  useEffect(() => {
    if (expiresAt === null) return;
    const id = setTimeout(() => setState({ status: "expired" }), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(id);
  }, [expiresAt]);

  const waiting = state.status === "waiting";
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;

    async function check() {
      try {
        const { data } = await authClient.getSession({ query: { disableCookieCache: true } });
        const verified = (data?.user as { phoneNumberVerified?: boolean | null } | undefined)
          ?.phoneNumberVerified;
        if (verified && !cancelled) {
          setState({ status: "confirmed" });
          // The header and Conta → Segurança read the shared session store.
          // $store is on the runtime client (better-auth/client config.mjs) but not on its public type.
          (authClient as unknown as { $store: { notify(s: string): void } }).$store.notify(
            "$sessionSignal",
          );
        }
      } catch {
        // A failed read is retried by the next tick.
      }
    }

    const onReturn = () => {
      if (document.visibilityState === "visible") void check();
    };
    const id = setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [waiting]);

  const markSent = useCallback(() => {
    setState((s) => (s.status === "ready" ? { ...s, status: "waiting" as const } : s));
  }, []);

  const restart = useCallback(() => {
    void start();
  }, [start]);

  return { state, markSent, restart };
}
