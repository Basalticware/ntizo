import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  ListOrdered,
  MapPin,
  Plus,
  Smartphone,
} from "lucide-react";
import { toMpesaMsisdn } from "@ntizo/shared";
import { isValidPhoneNumber } from "libphonenumber-js";
import {
  Button,
  PhoneInput,
  Skeleton,
  buttonVariants,
  cn,
} from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { AddressForm } from "@/features/account/ui/address-form";
import {
  useAddressMutations,
  useMyAddresses,
} from "@/features/account/viewmodel/use-addresses";
import { useCurrentUser } from "@/features/user/viewmodel/use-current-user";
import { useUpdateMyProfile } from "@/features/account/viewmodel/use-update-profile";
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";
import { formatMoney } from "@/features/wallet/domain/money";
import { slotWording } from "@/features/checkout/domain/slot-wording";
import { toAddressInput } from "@/shared/domain/address-input";
import { canAccept } from "@/features/quotes/domain/status";
import {
  useAcceptQuote,
  useMyQuote,
} from "@/features/quotes/viewmodel/use-my-quotes";
import {
  BACK_LINK_CLASS,
  CUSTOMER_CARD,
  CardHead,
  CustomerPageHeading,
  DETAIL_GRID,
  FIELD_LABEL,
  Fact,
  MUTED_SMALL,
  NumberedSteps,
} from "@/features/account/ui/customer-page";

/** A saved address to choose, as a radio row: the request page's own. */
const ADDRESS_CHOICE =
  "flex cursor-pointer items-start gap-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] p-4 has-[:checked]:border-[var(--color-blue-line)] has-[:checked]:bg-[var(--color-blue-softer)]";

/** The rail's three numbered steps, in the order they actually happen. */
const NEXT_STEPS = [
  ["accept.next1Title", "accept.next1Body"],
  ["accept.next2Title", "accept.next2Body"],
  ["accept.next3Title", "accept.next3Body"],
] as const;

/**
 * The three `refusal` keys that are actually about the phone field.
 *
 * `refusal` is whole-form state — it equally holds `errorLapsed`,
 * `errorMoved`, `errorAddressRequired` and `errorGeneric`, none of which mean
 * the *number* is wrong. An explicit set (rather than a
 * `refusal.startsWith("accept.phone")` prefix test) is what this checks
 * against: a prefix would also light up for some future `accept.phone*`-
 * shaped key that has nothing to do with a refusal, and three literals is a
 * small enough list that spelling them out is no less clear than a pattern.
 */
const PHONE_REFUSALS = new Set([
  "accept.phoneRequired",
  "accept.phoneInvalid",
  "accept.phoneNotVodacom",
]);

/** One saved address, as a line an envelope would carry — the same shape `request-page.tsx` prints. */
function addressSummary(address: {
  line1: string;
  line2: string | null;
  district: string | null;
  city: string;
}): string {
  return [
    [address.line1, address.line2].filter(Boolean).join(", "),
    [address.district, address.city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * `/quotes/$quoteId/accept` — plate 5, and the last customer screen before a
 * booking exists. Everything above is deciding; this page is committing:
 * read back what is being agreed, say where the M-Pesa prompt lands, one
 * button.
 *
 * **The phone is saved before the acceptance, in that order, and never
 * `Promise.all`.** A booking that reaches `PENDING_PAYMENT` with no number on
 * file cannot be charged, and the charge sweep starts the moment the quote
 * commits — there is no later screen this page can hand that repair to.
 *
 * **Lands on `/bookings/$bookingId`, not checkout's `/booking/$bookingId/confirm`.**
 * Both render a `PENDING_PAYMENT` booking correctly, but the checkout page
 * wears the three-step checkout header and this is not checkout's step 3 —
 * it is a quote turning into a booking. The booking detail's own "Pagar
 * agora" on a `PENDING_PAYMENT` row is what `nextFooter` already points a
 * customer back to if the M-Pesa prompt never arrives.
 *
 * **A taken slot is not a refusal to retry.** `QUOTE_SLOT_TAKEN` means the
 * backend has already returned the quote to `REQUESTED` with a fresh clock
 * and asked the provider again — pressing the button a second time would not
 * retry anything, so the button is replaced by the explanation instead of
 * sitting there disabled or bouncing back with the same refusal.
 *
 * **No `<main>`/`page-shell` of its own** — `_customer`'s own `CustomerShell`
 * already renders both around every page in this layout, the same note
 * `quote-page.tsx` and `request-page.tsx` both carry.
 */
export function AcceptQuotePage({ quoteId }: { quoteId: string }) {
  const { t, i18n } = useTranslation("quotes");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const navigate = useNavigate();

  const query = useMyQuote(quoteId);
  const q = query.data;

  // Every hook above the loading/error/not-found ladder, the same rule
  // `quote-page.tsx` and `request-page.tsx` both follow: a quote that turns
  // out not to exist must not have skipped a hook the render after it does.
  const { data: user } = useCurrentUser();
  const needsAddress = q ? q.address === null : false;
  const addresses = useMyAddresses({ enabled: needsAddress });
  const { add } = useAddressMutations();
  const profile = useUpdateMyProfile();
  const accept = useAcceptQuote();

  const [typedPhone, setTypedPhone] = useState<string | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [slotTaken, setSlotTaken] = useState(false);

  // The profile's own number wins until the customer types over it — derived
  // rather than seeded by an effect, because the profile arrives a render or
  // two after mount and an effect copying it in would either fight what the
  // customer had already started typing or need a flag to say it had run.
  const phone = typedPhone ?? user?.phoneNumber ?? "";

  async function submit() {
    setRefusal(null);

    const typed = phone.trim();
    if (typed === "") return setRefusal("accept.phoneRequired");
    // `isValidPhoneNumber` first, `toMpesaMsisdn` second, and never the other
    // way round — they refuse for different reasons and the customer has to
    // be told which. See `details-page.tsx`'s own note on this exact order.
    if (!isValidPhoneNumber(typed)) return setRefusal("accept.phoneInvalid");
    if (!toMpesaMsisdn(typed)) return setRefusal("accept.phoneNotVodacom");

    // The quote may have carried no address — a remote or at-provider
    // service whose provider did not ask. A booking past DRAFT must have
    // one, so it is asked for here instead.
    const chosen =
      q!.address === null
        ? (addresses.data?.find((a) => a.id === addressId) ?? null)
        : null;
    if (q!.address === null && chosen === null)
      return setRefusal("accept.errorAddressRequired");

    try {
      // The number first: a booking that reaches PENDING_PAYMENT without one
      // cannot be charged, and the charge sweep starts the moment the quote
      // commits.
      await profile.mutateAsync({ phoneNumber: typed });
      const { bookingId } = await accept.mutateAsync({
        quoteId,
        ...(chosen ? { address: toAddressInput(chosen) } : {}),
      });
      await navigate({ to: "/bookings/$bookingId", params: { bookingId } });
    } catch (error) {
      const code = error instanceof GraphqlError ? error.code : undefined;
      // A taken slot is not a refusal to retry: the backend has already put
      // the quote back to REQUESTED with a fresh clock and asked the
      // provider again.
      if (code === "QUOTE_SLOT_TAKEN") return setSlotTaken(true);
      setRefusal(
        code === "QUOTE_PROPOSAL_LAPSED"
          ? "accept.errorLapsed"
          : code === "QUOTE_TRANSITION"
            ? "accept.errorMoved"
            : code === "QUOTE_ADDRESS_REQUIRED"
              ? "accept.errorAddressRequired"
              : "accept.errorGeneric",
      );
    }
  }

  if (query.isLoading) {
    return (
      <div className="grid w-full max-w-[1400px] gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-48 w-full rounded-[14px]" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <p role="alert" className="type-body text-[var(--color-destructive)]">
        {t("detail.loadError")}
      </p>
    );
  }

  if (!q) {
    return (
      <EmptyCard
        framed
        title={t("detail.notFoundTitle")}
        body={t("detail.notFoundBody")}
      />
    );
  }

  const proposal = q.proposal;
  if (proposal === null || !canAccept(q)) {
    // The quote moved on since the customer opened this page — already
    // accepted, withdrawn, or closed by the provider from another tab. There
    // is nothing here to accept any more, so the page says so and points
    // back rather than rendering a form with nothing to submit.
    return (
      <div
        className={cn(
          CUSTOMER_CARD,
          "grid max-w-[640px] justify-items-start gap-4",
        )}
      >
        <p className="m-0 text-base text-[var(--color-ink-2)]">
          {t("accept.errorMoved")}
        </p>
        <Link
          to="/quotes/$quoteId"
          params={{ quoteId }}
          className={buttonVariants({ variant: "outline" })}
        >
          {t("accept.slotTakenAction")}
        </Link>
      </div>
    );
  }

  const when = slotWording(
    proposal.startsAt,
    proposal.endsAt,
    locale,
    q.timezone,
  );
  const totalAmount = formatMoney(
    proposal.priceMinor,
    proposal.currency,
    locale,
  );
  const busy = profile.isPending || accept.isPending;
  // Narrowed from `refusal`, which is whole-form state: a lapsed proposal, a
  // moved quote or a generic server error all set it too, and none of those
  // mean the number in the field is wrong. Marking the field invalid for
  // those would send a screen-reader user to correct the one thing that
  // isn't the problem.
  const phoneRefused = refusal !== null && PHONE_REFUSALS.has(refusal);

  const savedAddresses = addresses.data ?? [];
  const addressFormOpen =
    addingAddress || (!addresses.isPending && savedAddresses.length === 0);

  return (
    <div className="w-full max-w-[1400px]">
      <Link
        to="/quotes/$quoteId"
        params={{ quoteId }}
        className={BACK_LINK_CLASS}
      >
        <ArrowLeft aria-hidden="true" />
        {t("accept.back", { provider: q.providerName })}
      </Link>

      <CustomerPageHeading
        className="mt-5"
        title={t("accept.title")}
        subtitle={t("accept.lead")}
      />

      <form
        className={cn("mt-[30px]", DETAIL_GRID)}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid min-w-0 gap-6">
          {/* What is being agreed — read-only, on purpose. Every "change"
              a customer might want belongs to a page other than this one:
              the price and the slot are the provider's own proposal, and
              changing either is a new proposal, not an edit here. */}
          <section className={CUSTOMER_CARD}>
            <dl className="m-0 grid gap-5 sm:grid-cols-2">
              <Fact label={t("accept.service")}>
                <span className="font-semibold text-[var(--color-headline)]">
                  {q.serviceName}
                </span>
              </Fact>
              <Fact label={t("accept.provider")}>
                <span className="font-semibold text-[var(--color-headline)]">
                  {q.providerName}
                </span>
              </Fact>
              <Fact
                label={
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays
                      className="h-4 w-4 text-[var(--color-primary)]"
                      aria-hidden="true"
                    />
                    {t("accept.when")}
                  </span>
                }
              >
                <span className="block font-semibold text-[var(--color-headline)]">
                  {when.date}
                </span>
                <span className="tabular-nums">
                  {when.start} – {when.end}
                </span>
              </Fact>
              {q.address && (
                <Fact
                  label={
                    <span className="inline-flex items-center gap-2">
                      <MapPin
                        className="h-4 w-4 text-[var(--color-primary)]"
                        aria-hidden="true"
                      />
                      {t("accept.where")}
                    </span>
                  }
                >
                  {[
                    q.address.label,
                    q.address.line,
                    q.address.district,
                    q.address.city,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Fact>
              )}
              {proposal.note && (
                <Fact label={t("accept.includes")} className="sm:col-span-2">
                  <span className="whitespace-pre-line">{proposal.note}</span>
                </Fact>
              )}
            </dl>
            <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-[var(--color-line-2)] pt-5">
              <span className="text-[15px] text-[var(--color-ink-2)]">
                {t("accept.total")}
              </span>
              <span className="text-[22px] font-extrabold text-[var(--color-headline)] tabular-nums">
                {totalAmount}
              </span>
            </div>
          </section>

          {/* Where the M-Pesa prompt goes. Always editable, never a
              read-only value behind a "change" link: this is the first
              and only page that collects the number for a quote's own
              booking, so there is no earlier step to send the customer
              back to. */}
          <section className={CUSTOMER_CARD}>
            <div className="flex items-center gap-3">
              <Smartphone
                aria-hidden="true"
                className="h-[21px] w-[21px] shrink-0 text-[var(--color-primary)]"
              />
              <label htmlFor="accept-phone" className={FIELD_LABEL}>
                {t("accept.phoneLabel")}
              </label>
            </div>
            <div className="mt-3 max-w-md">
              <PhoneInput
                id="accept-phone"
                value={phone}
                onChange={(next) => {
                  setTypedPhone(next);
                  setRefusal(null);
                }}
                defaultCountry="MZ"
                locale={locale}
                searchPlaceholder={t("accept.countrySearchPlaceholder")}
                noResultsText={t("accept.countryNoResults")}
                countrySelectLabel={t("accept.countrySelectLabel")}
                aria-invalid={phoneRefused}
                aria-describedby="accept-phone-hint"
              />
            </div>
            <p id="accept-phone-hint" className={cn("m-0 mt-2", MUTED_SMALL)}>
              {t("accept.phoneHint", { amount: totalAmount })}
            </p>
          </section>

          {/* Asked here, and only here: the quote carried no address when
              the provider priced it, so a customer past this point must
              still give the platform somewhere to send them. */}
          {needsAddress && (
            <section className={CUSTOMER_CARD}>
              {addresses.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : addresses.isError ? (
                <div role="alert" className="grid justify-items-start gap-3">
                  <p className="type-body text-[var(--color-destructive)]">
                    {t("request.addressLoadError")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void addresses.refetch()}
                  >
                    {t("request.retry")}
                  </Button>
                </div>
              ) : (
                <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0">
                  <legend className="sr-only">
                    {t("request.addressLegend")}
                  </legend>

                  {savedAddresses.map((address) => (
                    <label key={address.id} className={ADDRESS_CHOICE}>
                      <input
                        type="radio"
                        name="accept-address"
                        value={address.id}
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                        className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-[var(--color-headline)]">
                          {address.label}
                        </span>
                        <span className={cn("block", MUTED_SMALL)}>
                          {addressSummary(address)}
                        </span>
                      </span>
                    </label>
                  ))}

                  {addressFormOpen ? (
                    <AddressForm
                      ariaLabel={t("request.addressLegend")}
                      submitting={add.isPending}
                      {...(savedAddresses.length > 0
                        ? { onCancel: () => setAddingAddress(false) }
                        : {})}
                      onSubmit={async (values) => {
                        const id = await add.mutateAsync(values);
                        await addresses.refetch();
                        setAddressId(id);
                        setAddingAddress(false);
                      }}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="justify-self-start"
                      onClick={() => setAddingAddress(true)}
                    >
                      <Plus aria-hidden="true" />
                      {t("request.addressAddAction")}
                    </Button>
                  )}
                </fieldset>
              )}
              <p className={cn("m-0 mt-3", MUTED_SMALL)}>
                {t("request.addressNote")}
              </p>
            </section>
          )}

          {refusal && (
            <p
              role="alert"
              className="m-0 text-[15px] font-medium text-[var(--color-destructive)]"
            >
              {t(refusal)}
            </p>
          )}

          {slotTaken ? (
            // In place of the button — there is nothing left to press. The
            // backend has already put the quote back to REQUESTED and asked
            // the provider again; pressing "Aceitar" a second time here
            // would not retry anything.
            <div className="grid gap-2 rounded-[14px] bg-[var(--color-blue-softer)] p-5 sm:p-6">
              <p className="m-0 text-base font-bold text-[var(--color-headline)]">
                {t("accept.slotTakenTitle")}
              </p>
              <p className="m-0 text-[15px] text-[var(--color-muted-foreground)]">
                {t("accept.slotTakenBody", { provider: q.providerName })}
              </p>
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId }}
                className={`${buttonVariants({ variant: "outline" })} mt-2 justify-self-start`}
              >
                {t("accept.slotTakenAction")}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>
                {t("accept.submit", { amount: totalAmount })}
              </Button>
              <Link
                to="/quotes/$quoteId"
                params={{ quoteId }}
                className={buttonVariants({ variant: "outline" })}
              >
                {t("accept.cancel")}
              </Link>
            </div>
          )}
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-6">
          <section className={CUSTOMER_CARD}>
            <CardHead icon={ListOrdered} title={t("accept.nextTitle")} />
            <div className="mt-5">
              <NumberedSteps
                steps={NEXT_STEPS.map(([titleKey, bodyKey]) => ({
                  key: titleKey,
                  title: t(titleKey),
                  body: t(bodyKey),
                }))}
              />
            </div>
          </section>
          <p className={cn("m-0", MUTED_SMALL)}>{t("accept.nextFooter")}</p>
        </aside>
      </form>
    </div>
  );
}
