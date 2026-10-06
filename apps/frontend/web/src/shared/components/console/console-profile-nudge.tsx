import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Crown } from "lucide-react";

/**
 * The card at the foot of a provider's sidebar. It leads to Settings, where
 * the profile is completed — the mockups' "Ver dicas" had nowhere true to go,
 * so the link says what it does.
 */
export function ConsoleProfileNudge({ slug }: { slug: string | undefined }) {
  const { t } = useTranslation("provider");
  if (!slug) return null;
  return (
    <div className="rounded-2xl bg-[color-mix(in_srgb,var(--color-primary)_6%,var(--color-background))] p-5">
      <Crown aria-hidden="true" className="h-6 w-6 fill-[#f5b301] text-[#f5b301]" />
      <p className="mt-3 text-base leading-snug font-bold text-[var(--color-headline)]">{t("profileNudge.title")}</p>
      <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">{t("profileNudge.body")}</p>
      <Link
        to="/provider/$slug/settings"
        params={{ slug }}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
      >
        {t("profileNudge.cta")}
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}
