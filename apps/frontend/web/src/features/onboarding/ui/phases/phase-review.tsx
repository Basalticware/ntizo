import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Clock, LayoutGrid } from "lucide-react";
import { buttonVariants } from "@ntizo/frontend-ui";
import { HeroQuestion } from "@/features/onboarding/ui/wizard-chrome";

/**
 * The end of the wizard: the application is in.
 *
 * Not a celebration. The reference finishes with confetti because its operator
 * is live at that moment; ours is `pending` and cannot be found by a customer
 * until an administrator approves it, so a party here would be telling someone
 * they have something they do not.
 *
 * What it does instead is say what happens next and hand over a real thing to
 * do, because the workspace is usable while the application waits.
 */
export function PhaseReview({ providerName }: { providerName: string }) {
  const { t } = useTranslation("onboarding");

  return (
    <div className="text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--color-warn-bg)]">
        <Clock className="h-7 w-7 text-[var(--color-warn-fg)]" />
      </span>

      <div className="mt-6">
        <HeroQuestion title={t("review.title", { name: providerName })} />
      </div>

      <p className="mx-auto text-[16.5px] leading-[1.5] -mt-4 max-w-[52ch] text-[var(--color-muted-foreground)]">
        {t("review.body")}
      </p>

      <ul className="mx-auto mt-8 grid max-w-[46ch] list-none gap-3 p-0 text-left">
        {["profile", "services", "team"].map((key) => (
          <li
            key={key}
            className="flex text-[15px] text-[var(--color-ink-2)] items-start gap-3 rounded-[14px] bg-[var(--color-blue-softer)] px-5 py-4"
          >
            <LayoutGrid className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" />
            {t(`review.meanwhile.${key}`)}
          </li>
        ))}
      </ul>

      <div className="mt-9">
        <Link to="/provider" className={buttonVariants()}>
          {t("review.cta")}
        </Link>
      </div>
    </div>
  );
}
