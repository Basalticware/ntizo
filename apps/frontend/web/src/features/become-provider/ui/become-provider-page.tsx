import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MapPin, Smartphone, Tag } from "lucide-react";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { SiteHeader } from "@/shared/components/site-header";
import { Footer } from "@/features/landing/ui/footer";
import { SectionHead } from "@/features/landing/ui/section-head";
import { CONTACT } from "@/shared/lib/contact";
import { buttonVariants } from "@ntizo/frontend-ui";
import {
  CARD_BODY_CLASS,
  CARD_TITLE_CLASS,
  PUBLIC_CARD_CLASS,
  PUBLIC_PAGE_CLASS,
  STEP_MARKER_CLASS,
} from "@/features/landing/ui/public-page";

/**
 * The public case for becoming a provider.
 *
 * Public on purpose. Until now the only way in was a row inside the account
 * menu, so the one person the funnel exists for — someone who has not signed up
 * — could never see it.
 *
 * **It is drawn on the home page's rules, and that is the whole of this
 * file's styling.** It used to have a system of its own — a dark hero under a
 * generated gradient, a `#f2f8fe` ground, cards with artwork behind an
 * oversized `01`, a faint square grid, tracked-out uppercase eyebrows, and two
 * dark bands. The home shed all of that on 2026-09-07 and this page did not,
 * so the two read as two products. What replaced it is what the home already
 * does: white ground, `--color-headline` navy, one dark band at the end, and
 * no blue of its own — the page's only `--color-primary` is the search button
 * the header brings with it.
 *
 * **Four blocks, and nothing else** (October 2026): the hero, how it works,
 * what you need, and the navy ask. "Two ways to provide" became one line
 * under the steps and "One price, set by you" one sentence in the hero's
 * subtitle — the page said each thing twice, and readers stopped before the
 * button. `Steps` and `Requirements` take the card `CustomerReviews` draws,
 * down to the token.
 *
 * **On the October 2026 system** like the home: the 53px hero title of
 * `/services`, the system's buttons (filled blue, outlined blue), cards at
 * 24px padding, soft blue step markers, and `/services`' inset.
 *
 * Nothing here paints with inline styles any more, which is what
 * `LANDING_VARS` and `PAGE_TOP` existed to supply — every colour is a token,
 * so this page follows dark mode like the rest of the site rather than staying
 * light on a dark screen.
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
      <Hero cta={cta} t={t} />
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
 * part of the path and never match a route. Carrying it is what stops the
 * chain breaking at "registered, landed on the customer home, and the thing
 * they came for was never offered again".
 */
type CtaTarget =
  | { to: "/onboarding"; search?: undefined }
  | { to: "/sign-up"; search: { next: string } };

/**
 * The page's primary action: the system's filled button.
 *
 * It was a navy pill while the site kept blue for search and sign-in alone;
 * the October 2026 system made the filled blue `Button` every page's primary
 * action, and this page follows it.
 *
 * No arrow after the label: a "→" appended to a button is decoration the
 * listings dropped everywhere else.
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

/**
 * The claim, on white, with the header solid above it, and a photograph on
 * the right from `lg` — the home's provider photograph, the site's artwork
 * rather than anybody's listing, so `alt=""`.
 *
 * The subtitle carries the fee in one sentence: a fixed percentage of each
 * booking, no monthly fee. No number, and that is deliberate: the rate is per
 * provider (`commission_bps`) and administrator-set, not a platform-wide
 * constant safe to print in JSX. Until 2026-08-31 this page said "0%" and
 * called itself commission-free, which the decision of 2026-08-30 made false.
 *
 * The three proof lines are the home hero's own shape: a stroked icon at 20px
 * in the brand blue and a short line. The second says how the customer pays —
 * M-Pesa — and nothing more. It said "guaranteed payment", which nothing in
 * the booking flow backs: the customer is charged once the provider confirms,
 * and no step holds the money or promises its release.
 */
function Hero({ cta, t }: { cta: CtaTarget; t: T }) {
  const proofs = [
    { Icon: Tag, label: t("trustFree") },
    { Icon: Smartphone, label: t("trustPaid") },
    { Icon: MapPin, label: t("trustLocal") },
  ];

  return (
    <>
      <SiteHeader current="none" />
      <section className="public-inset grid items-center gap-12 pt-[22px] pb-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:pt-12">
        <div>
          <h1 className="max-w-[16ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] lg:text-[53px]">
            {t("title")} {t("titleAccent")}
          </h1>
          <p className="mt-4 max-w-[50ch] text-[17px] leading-normal text-[var(--color-muted-foreground)]">
            {t("subtitle")}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <PrimaryCta cta={cta} label={t("cta")} />
            {/* The system's second button — outlined in blue — for the second
                action in the same task: see who is already on the platform. */}
            <Link to="/providers" className={buttonVariants({ variant: "secondary" })}>
              {t("ctaSecondary")}
            </Link>
          </div>

          <ul className="mt-9 flex list-none flex-wrap gap-x-7 gap-y-2.5 p-0">
            {proofs.map(({ Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-[15px] font-medium text-[var(--color-ink-2)]">
                <Icon
                  className="h-5 w-5 text-[var(--color-primary)]"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <img
          src="/images/home-provider.jpg"
          alt=""
          data-testid="become-provider-photo"
          className="hidden h-[440px] w-full rounded-[14px] object-cover object-[50%_20%] lg:block"
        />
      </section>
    </>
  );
}

/**
 * What happens after signing up.
 *
 * **This one keeps its numbers**, because this one is a sequence: you cannot
 * publish before you are verified, and the reader needs the order. They are
 * small soft blue markers, the same shape `/about`'s flow uses, rather than
 * outlined numerals the size of the headline they sit above.
 *
 * Step four says what is true about money: the customer pays by M-Pesa once
 * the provider confirms the time, and the commission comes out of that price.
 * It used to say the payment was held until the job was done and then
 * released; nothing in the booking flow holds or releases money (there is no
 * disbursement yet, and the wallet ledger has no writer), so it no longer
 * says so.
 *
 * Step two says the application is reviewed, and that is not decoration:
 * registering creates a pending provider customers cannot find until an
 * administrator approves it. Leaving it out would make the wait look like a
 * fault.
 */
function Steps({ t }: { t: T }) {
  const steps = ["apply", "review", "publish", "earn"] as const;

  return (
    <section className="public-inset pb-16">
      <SectionHead title={t("stepsTitle")} />
      <ol className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((key, i) => (
          <li
            key={key}
            className={PUBLIC_CARD_CLASS}
          >
            <span aria-hidden="true" className={`mb-4 ${STEP_MARKER_CLASS}`}>
              {i + 1}
            </span>
            <h3 className={CARD_TITLE_CLASS}>{t(`step.${key}.title`)}</h3>
            <p className={`mt-1.5 ${CARD_BODY_CLASS}`}>{t(`step.${key}.body`)}</p>
          </li>
        ))}
      </ol>
      {/* What used to be "Two ways to provide": a choice made once, in the
          wizard, so one line here rather than two cards to weigh. */}
      <p className="mt-5 text-[15px] text-[var(--color-muted-foreground)]">{t("pathsLine")}</p>
    </section>
  );
}

/**
 * What you need before starting.
 *
 * Three conditions to check against yourself, so three cards — and still no
 * tinted disc with a tick in it beside each one. A tick says "done"; these
 * are things the reader has yet to bring.
 */
function Requirements({ t }: { t: T }) {
  const items = ["identity", "payout", "terms"] as const;

  return (
    <section className="public-inset pb-16">
      <SectionHead title={t("requirementsTitle")} blurb={t("requirementsBlurb")} />
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((key) => (
          <article
            key={key}
            className={PUBLIC_CARD_CLASS}
          >
            <h3 className={CARD_TITLE_CLASS}>{t(`requirement.${key}.title`)}</h3>
            <p className={`mt-1.5 ${CARD_BODY_CLASS}`}>{t(`requirement.${key}.body`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * The last ask, and the page's only dark surface.
 *
 * Drawn exactly as `ProviderBand` draws the home's: full width, plain navy,
 * no ornament — the navy ground is the whole of it — and the same filled blue
 * button, which reads on navy in both themes. A literal white button with
 * `--color-headline` text goes near-white on near-white in dark mode, which is
 * a bug this page's predecessor shipped once already.
 *
 * It carries the way out for someone not ready to commit — a question answered
 * by a person beats a form abandoned.
 */
function ClosingBand({ cta, t }: { cta: CtaTarget; t: T }) {
  return (
    <section className="relative mt-4 overflow-hidden bg-[var(--color-navy-surface)] text-[var(--color-navy-on)]">
      <div className="public-inset py-16">
        <h2 className="max-w-[18ch] text-[30px] leading-[1.08] font-extrabold tracking-[-0.02em] md:text-[36px]">
          {t("closingTitle")}
        </h2>
        <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-[var(--color-navy-on)]/75">
          {t("closingBody")}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <Link
            to={cta.to}
            {...(cta.search ? { search: cta.search } : {})}
            className={buttonVariants()}
          >
            {t("cta")}
          </Link>
          {/* No colour class of its own: it inherits `--color-navy-on` from
              the section, which is already the dark-aware light text this band
              needs. */}
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
