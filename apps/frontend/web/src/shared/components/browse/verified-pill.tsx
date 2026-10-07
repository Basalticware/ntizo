import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

/**
 * "Prestador verificado", on a card's photograph or above a name.
 *
 * Drawn only by a caller that knows the provider is verified — the pill has
 * no "not verified" state, because absence already says that and a red
 * "unverified" label would accuse a provider who simply has not been
 * reviewed yet. `floating` places it on the photograph's bottom-left.
 */
export function VerifiedPill({ floating = true }: { floating?: boolean }) {
  const { t } = useTranslation("directory");
  return (
    <span
      className={`${floating ? "absolute bottom-2.5 left-2.5 z-[2]" : ""} inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ok-bg)] px-2.5 py-1 text-[12px] leading-none font-semibold text-[var(--color-ok-fg)]`}
    >
      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
      {t("topRatedVerified")}
    </span>
  );
}
