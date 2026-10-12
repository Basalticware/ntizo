import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/**
 * A thin bar across the top while the router is still deciding where to go.
 *
 * A guarded route — the provider panel checks the session, then fetches the
 * account's workspaces, before anything renders — left the previous page on
 * screen, unchanged and unresponsive-looking, for as long as that took. A
 * tester read it as the click not having worked (2026-10-12). This is the sign
 * that it did.
 *
 * Shown only after a short wait, so the navigations that are instant do not
 * flash a bar for a frame.
 */
export function NavigationProgress() {
  const { t } = useTranslation("common");
  const loading = useRouterState({ select: (s) => s.status === "pending" });
  const [visible, setVisible] = useState(false);
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (!loading) {
      setVisible(false);
      setGrown(false);
      return;
    }
    const show = window.setTimeout(() => setVisible(true), 120);
    // A frame later, so the width transition has a start to run from.
    const grow = window.setTimeout(() => setGrown(true), 160);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(grow);
    };
  }, [loading]);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={t("loading")}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className="h-full bg-[var(--color-primary)] transition-[width] duration-[2500ms] ease-out"
        style={{ width: grown ? "85%" : "8%" }}
      />
    </div>
  );
}
