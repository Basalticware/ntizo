import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  CalendarClock,
  FileCheck,
  IdCard,
  MapPin,
  Smartphone,
  Tag,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { SiteHeader } from "@/shared/components/site-header";
import { Footer } from "@/features/landing/ui/footer";
import { CONTACT } from "@/shared/lib/contact";
import { buttonVariants, cn } from "@ntizo/frontend-ui";
import { PUBLIC_PAGE_CLASS } from "@/features/landing/ui/public-page";
import {
  IconItems,
  PhotoHero,
  PhotoSplit,
  SPLIT_BODY_CLASS,
  SPLIT_TITLE_CLASS,
  SoftBand,
} from "@/shared/components/photo-sections";

/**
 * The public case for becoming a provider.
 *
 * Public on purpose. Until now the only way in was a row inside the account
 * menu, so the one person the funnel exists for — someone who has not signed up
 * — could never see it.
 *
 * **Drawn as `/about` is** (October 2026, at the owner's request): the
 * user's electrician full-bleed under the white title, why join beside a
 * second photograph, the steps as numbered icons on the soft blue band, what
 * you need as three unboxed icons, and the ask on the navy band. The pieces
 * are the shared ones (`photo-sections.tsx`); this file only arranges them.
 * The cards it used to draw — the steps and the requirements, each a bordered
 * box — are gone with the rest of the text-in-boxes look.
 *
 * Every colour is a token, so the page follows dark mode; the only literals
 * are the white words and the black scrim over the photograph, which are the
 * same in either theme.
 */
export function BecomeProviderPage() {
  const { t } = useTranslation("becomeProvider");
  const { data: user } = useCurrentUser();

  // Both ends of this land in the wizard. Signed in, straight there; signed
  // out, through registration carrying the intent — which is what stops the
  // chain breaking at "registered, now on the customer home, and the thing
  // they came for is nowhere".
  const cta: CtaTarget = user
    ? { to: "/onboarding" }
    : { to: "/sign-up", search: { next: "/onboarding" } };

  return (
    <main className={PUBLIC_PAGE_CLASS}>
      <SiteHeader current="none" />
      <Hero cta={cta} t={t} />
      <WhyJoin t={t} />
      <Steps t={t} />
      <Requirements t={t} />
      <ClosingBand cta={cta} t={t} />
      <Footer />
    </main>
  );
}

type T = (key: string) => string;

/**
 * Where the page's call to action goes.
 *
 * Signed in it is the wizard. Signed out it is registration carrying the
 * intent as a *search param* — a query string inside `to` would be read as
 * part of the path and never match a route.
 */
type CtaTarget =
  | { to: "/onboarding"; search?: undefined }
  | { to: "/sign-up"; search: { next: string } };

/**
 * The page's primary action: the system's filled blue button, which reads on
 * the photograph's scrim and on the navy band alike. No arrow after the label.
 */
function PrimaryCta({ cta, label }: { cta: CtaTarget; label: string }) {
  return (
    <Link
      to={cta.to}
      {...(cta.search ? { search: cta.search } : {})}
      className={buttonVariants()}
    >
      {label}
    </Link>
  );
}

/** A section heading off the photographs: `/about`'s 26px navy. */
const SECTION_TITLE_CLASS =
  "text-[24px] leading-tight font-extrabold tracking-[-0.01em] text-[var(--color-headline)] md:text-[26px]";

/**
 * The claim on the home's own photograph — the user's electrician, the
 * site's artwork rather than anybody's listing, so `alt=""`.
 *
 * The second button is outlined in white rather than the system's blue
 * outline, whose card-coloured fill would put a white slab on the picture.
 *
 * The three proof items are the home hero's: a white disc, a blue icon, white
 * words. The second says how the customer pays — M-Pesa — and nothing more.
 * It once said "guaranteed payment", which nothing in the booking flow backs:
 * the customer is charged once the provider confirms, and no step holds the
 * money or promises its release.
 */
function Hero({ cta, t }: { cta: CtaTarget; t: T }) {
  const proofs = [
    { Icon: Tag, label: t("trustFree") },
    { Icon: Smartphone, label: t("trustPaid") },
    { Icon: MapPin, label: t("trustLocal") },
  ];

  return (
    <PhotoHero
      photo="/images/home-hero.jpg"
      position="72% 28%"
      title={`${t("title")} ${t("titleAccent")}`}
      lede={t("lede")}
    >
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <PrimaryCta cta={cta} label={t("cta")} />
        <Link
          to="/providers"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "border border-white/70 text-white hover:bg-white/10",
          )}
        >
          {t("ctaSecondary")}
        </Link>
      </div>

      {/* Two even columns on a phone, as on the home hero. */}
      <ul className="mt-7 grid list-none grid-cols-2 gap-x-4 gap-y-3 p-0 sm:flex sm:flex-wrap sm:gap-x-10">
        {proofs.map(({ Icon, label }) => (
          <li
            key={label}
            className="flex min-w-0 items-center gap-2.5 text-[13.5px] leading-[1.35] font-semibold text-white sm:gap-3 sm:text-[14px]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white">
              <Icon className="h-5 w-5 text-[var(--color-blue-public)]" strokeWidth={2.2} aria-hidden="true" />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </PhotoHero>
  );
}

/**
 * Why join, beside a provider's portrait. The fee is said here, once: no
 * monthly fee, a fixed percentage of each booking, out of the price the
 * provider sets. No number, and that is deliberate: the rate is per provider
 * (`commission_bps`) and administrator-set, not a platform-wide constant safe
 * to print in JSX.
 */
function WhyJoin({ t }: { t: T }) {
  return (
    <PhotoSplit photo="/images/company/become-provider-why.jpg" position="50% 30%">
      <h2 className={SPLIT_TITLE_CLASS}>{t("whyTitle")}</h2>
      <p className={`mt-5 ${SPLIT_BODY_CLASS}`}>{t("why1")}</p>
      <p className={`mt-4 ${SPLIT_BODY_CLASS}`}>{t("why2")}</p>
    </PhotoSplit>
  );
}

/**
 * What happens after signing up — numbered, because it is a sequence: you
 * cannot publish before you are verified.
 *
 * Step two says the application is reviewed, and that is not decoration:
 * registering creates a pending provider customers cannot find until an
 * administrator approves it. Step four says what is true about money: the
 * customer pays by M-Pesa once the provider confirms the time, and the
 * commission comes out of that price. Nothing holds or releases money.
 */
function Steps({ t }: { t: T }) {
  const steps = [
    { key: "apply", Icon: UserPlus },
    { key: "review", Icon: BadgeCheck },
    { key: "publish", Icon: CalendarClock },
    { key: "earn", Icon: Wallet },
  ] as const;

  return (
    <SoftBand>
      <h2 className={`mb-8 ${SECTION_TITLE_CLASS}`}>{t("stepsTitle")}</h2>
      <IconItems
        numbered
        onBand
        items={steps.map(({ key, Icon }) => ({
          Icon,
          title: t(`step.${key}.title`),
          body: t(`step.${key}.body`),
        }))}
      />
      {/* What used to be "Two ways to provide": a choice made once, in the
          wizard, so one line here rather than two blocks to weigh. */}
      <p className="mt-8 text-[15px] text-[var(--color-muted-foreground)]">{t("pathsLine")}</p>
    </SoftBand>
  );
}

/**
 * What you need before starting: three things to check against yourself, as
 * icons with no box around them. No tick beside any — a tick says "done", and
 * these are things the reader has yet to bring.
 */
function Requirements({ t }: { t: T }) {
  const items = [
    { key: "identity", Icon: IdCard },
    { key: "payout", Icon: Smartphone },
    { key: "terms", Icon: FileCheck },
  ] as const;

  return (
    <section className="public-inset pt-16 md:pt-20">
      <h2 className={SECTION_TITLE_CLASS}>{t("requirementsTitle")}</h2>
      <p className="mt-2 mb-8 text-[16px] text-[var(--color-muted-foreground)]">{t("requirementsBlurb")}</p>
      <IconItems
        items={items.map(({ key, Icon }) => ({
          Icon,
          title: t(`requirement.${key}.title`),
          body: t(`requirement.${key}.body`),
        }))}
      />
    </section>
  );
}

/**
 * The last ask, on the navy band `/about` and the home end with.
 *
 * The button is the system's filled blue, which reads on navy in both themes.
 * A literal white button with `--color-headline` text goes near-white on
 * near-white in dark mode, which is a bug this page's predecessor shipped
 * once already. "Falar connosco" is the way out for someone not ready to
 * commit — a question answered by a person beats a form abandoned.
 */
function ClosingBand({ cta, t }: { cta: CtaTarget; t: T }) {
  return (
    <section className="mt-16 bg-[var(--color-navy-surface)] text-[var(--color-navy-on)] md:mt-20">
      <div className="public-inset py-12 md:py-14">
        <h2 className="max-w-[22ch] text-[24px] leading-[1.15] font-extrabold tracking-[-0.01em] md:text-[28px]">
          {t("closingTitle")}
        </h2>
        <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-[var(--color-navy-on)]/75">
          {t("closingBody")}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <PrimaryCta cta={cta} label={t("cta")} />
          {/* No colour class of its own: it inherits `--color-navy-on` from
              the section, the dark-aware light text this band needs. */}
          <a
            href={`mailto:${CONTACT.general}`}
            className="text-[15px] font-semibold underline decoration-[var(--color-navy-on)]/40 underline-offset-4"
          >
            {t("closingTalk")}
          </a>
        </div>
      </div>
    </section>
  );
}
