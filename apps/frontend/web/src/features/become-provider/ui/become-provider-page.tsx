import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Smartphone, Tag } from "lucide-react";
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
 * **The repeated groups are cards, on the home page's own shape.** The first
 * pass drew them as items on a hairline, which is what the home page looked
 * like at the time. The home has since become bordered cards end to end —
 * services, businesses, and now the reviews — so a hairline pitch made the
 * reader cross from a page of cards into what looked like a different
 * product. `Paths`, `Steps` and `Requirements` all take the card
 * `CustomerReviews` draws, down to the token, and the wide column gaps that
 * separated bare columns come down to the `gap-6` a row of cards uses.
 * `Pricing` keeps its hairline-free paragraph: it is one sentence, and a card
 * around one sentence is a box.
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
      <Paths t={t} />
      <Pricing t={t} />
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
 * The claim, on white, with the header solid above it.
 *
 * `SiteHeader` without `overlay`: the overlay variant exists to sit on
 * artwork, and there is no artwork now. The headline is one navy sentence
 * rather than half a sentence in blue — colouring a phrase inside a heading is
 * the tell the listings and the home both removed.
 *
 * The three trust lines are the home hero's own shape: a stroked icon at 20px
 * in the brand blue and a short line.
 */
function Hero({ cta, t }: { cta: CtaTarget; t: T }) {
  const proofs = [
    { Icon: Tag, label: t("trustFree") },
    { Icon: ShieldCheck, label: t("trustPaid") },
    { Icon: Smartphone, label: t("trustLocal") },
  ];

  return (
    <>
      <SiteHeader current="none" />
      <section className="public-inset pt-[22px] pb-14 lg:pt-10">
        <h1 className="max-w-[16ch] text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] lg:text-[53px]">
          {t("title")} {t("titleAccent")}
        </h1>
        <p className="mt-3.5 max-w-[52ch] text-[17px] leading-normal text-[var(--color-muted-foreground)]">
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
      </section>
    </>
  );
}

/**
 * The two kinds of provider.
 *
 * Ntizo's own distinction and the first real decision a visitor makes: a person
 * offering their own labour and an establishment with staff need different
 * calendars and different teams, and someone reading this is working out which
 * one they are.
 *
 * **No numerals.** They used to carry `01` and `02` over generated artwork,
 * and a number promises an order the reader has to follow. This is a choice
 * between two things, not a first and a second — so the hairline that opens
 * each column is the whole of the structure, and the differentiator stays one
 * sentence and one tag.
 */
function Paths({ t }: { t: T }) {
  const paths = ["individual", "organization"] as const;

  return (
    <section className="public-inset pt-4 pb-16">
      <SectionHead title={t("pathsTitle")} blurb={t("pathsBlurb")} />
      <div className="grid gap-6 md:grid-cols-2">
        {paths.map((key) => (
          <article
            key={key}
            className={PUBLIC_CARD_CLASS}
          >
            <h3 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--color-headline)]">
              {t(`path.${key}.title`)}
            </h3>
            <p className={`mt-2.5 ${CARD_BODY_CLASS}`}>{t(`path.${key}.body`)}</p>
            {/* One fact, not a list, and set as type rather than a tinted
                capsule — the thing that actually differs between the two. */}
            <span className="mt-4 block text-[14px] font-semibold text-[var(--color-primary)]">
              {t(`path.${key}.tag`)}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * The fee, stated in the reader's own column rather than shouted from a band.
 *
 * It is the first question anyone asks, so it gets a section of its own — but
 * on white, because the page now spends its one dark surface on the closing
 * ask. A second dark band was what made this page read as two pages stapled
 * together.
 *
 * No number, and that is deliberate: the rate is per provider
 * (`commission_bps`) and administrator-set, not a platform-wide constant safe
 * to print in JSX. Until 2026-08-31 this said "0%" and called itself
 * commission-free, which the decision of 2026-08-30 made false.
 */
function Pricing({ t }: { t: T }) {
  return (
    <section className="public-inset pb-16">
      <SectionHead title={t("pricingTitle")} />
      {/* One panel, full width, because there is one thing to say — on the
          soft blue the system gives a note, which sets it apart from the
          cards around it. */}
      <div className="rounded-[14px] bg-[var(--color-blue-softer)] p-6 md:p-7">
        <p className="max-w-[62ch] text-[17px] leading-relaxed text-[var(--color-ink-2)]">
          {t("pricingBody")}
        </p>
      </div>
    </section>
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
 * Step two says the application is reviewed, and that is not decoration:
 * registering creates a pending provider customers cannot find until an
 * administrator approves it. Leaving it out would make the wait look like a
 * fault.
 */
function Steps({ t }: { t: T }) {
  const steps = ["apply", "review", "publish", "earn"] as const;

  return (
    <section className="public-inset pb-16">
      {/* `stepsEyebrow` reads as a sentence, not a label — "From signing up to
          your first booking" — so it becomes the section's line now that the
          tracked-out uppercase eyebrows are gone. */}
      <SectionHead title={t("stepsTitle")} blurb={t("stepsEyebrow")} />
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
            <span className="mt-3 block text-[13px] font-semibold text-[var(--color-primary)]">
              {t(`step.${key}.tag`)}
            </span>
          </li>
        ))}
      </ol>
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
