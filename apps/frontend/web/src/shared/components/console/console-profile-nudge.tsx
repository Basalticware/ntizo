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
    <div className="rounded-[14px] bg-[var(--color-blue-softer)] px-6 pt-[18px] pb-5">
      <Crown aria-hidden="true" className="h-7 w-7 fill-[var(--color-star)] text-[var(--color-star)]" />
      <p className="mt-1 max-w-[170px] text-[17.5px] leading-[1.3] font-bold text-[var(--color-headline)]">{t("profileNudge.title")}</p>
      <p className="mt-1.5 max-w-[190px] text-[15.5px] leading-[1.45] text-[var(--color-muted-foreground)]">{t("profileNudge.body")}</p>
      <Link
        to="/provider/$slug/settings"
        params={{ slug }}
        className="mt-2.5 inline-flex items-center gap-2 text-base font-semibold text-[var(--color-primary)] hover:underline"
      >
        {t("profileNudge.cta")}
        <ArrowRight aria-hidden="true" className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}
