import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, Check, Smartphone, Tag, Timer } from "lucide-react";
import { Skeleton, cn } from "@ntizo/frontend-ui";
import type { ServiceDetailOptionDTO } from "@ntizo/shared/read-models";
import { addDays, localDateAt } from "@ntizo/shared/datetime";
import {
  formatAmount,
  optionDurationMinutes,
} from "@/features/directory/services/domain/service-card";
import type { Start } from "@/features/directory/availability/domain/types";
import { useServiceAvailability } from "@/features/directory/availability/viewmodel/use-service-availability";
import { MessageProviderButton } from "@/features/directory/ui/provider-rail";

/** How many days the rail offers before the calendar takes over. */
const RAIL_DAYS = 5;
/** How many starting times it shows for the chosen day — two rows of four. */
const RAIL_SLOTS = 8;

/**
 * What the chosen package costs, when it can start, and how to act on it —
 * the booking card of `client/servico-detalhe.html`.
 *
 * The headline is `option.amountMinor`, unaltered and in exact spelling
 * (`formatAmount`, "1 200,00 MTn"): the provider prices with the platform's
 * fee already in mind, so the customer pays exactly the listed price — the
 * decision of 2026-08-30.
 *
 * **The chosen package is passed in, never chosen here.** `ServiceOptions`
 * renders the rows in the body and `ServiceDetailPage` holds which one is
 * selected, so this card cannot show a total for one package while the body
 * highlights another.
 *
 * **The days and times are the real calendar's**, from the same
 * `availability.forService` the checkout reads — the next five days and the
 * first starts of the chosen one. Choosing one only carries it into the link:
 * the booking itself is still made at `/book/<serviceId>`, step 1 of
 * checkout, which shows the whole week and holds the slot. The calendar tile
 * goes there too, for a day past the five. With nothing free this week the
 * two headings go, and the button still opens the checkout's calendar.
 *
 * **The verification line is conditional on a fact.** `providerVerified`
 * means an administrator accepted at least one of this business's documents;
 * a sentence that is always printed lies.
 */
export function RailPriceSummary({
  option,
  locale,
  serviceId,
  providerId,
  providerVerified,
}: {
  option: ServiceDetailOptionDTO;
  locale: string;
  /** Where the primary goes: `/book/<serviceId>`, step 1 of checkout. */
  serviceId: string;
  providerId: string;
  providerVerified: boolean;
}) {
  const { t } = useTranslation("directory");
  const minutes = optionDurationMinutes(option);
  const isHourly = option.pricingMode === "hourly";
  const [picked, setPicked] = useState<Start | null>(null);

  const trustItems = [
    providerVerified ? t("trustVerified") : null,
    t("trustFeeIncluded"),
    t("trustMpesa"),
  ].filter((item): item is string => item !== null);

  return (
    <>
      <div className="rounded-xl border border-[#e9f0f8] p-6">
        <p className="flex flex-wrap items-baseline gap-2">
          {/* `data-testid` kept: this is the one total this card prints, so it
              is the handle every assertion about it reaches for. */}
          <b
            data-testid="booking-total"
            className="text-[37px] leading-none font-extrabold tracking-[-0.02em] text-[#00064f] tabular-nums"
          >
            {formatAmount(option.amountMinor, option.currency, locale)}
          </b>
          {isHourly && (
            <span className="text-base text-[var(--color-muted-foreground)]">{t("priceHourlySuffix")}</span>
          )}
        </p>
        {/* Which package that price belongs to. Printed for a single-option
            service too, where `ServiceOptions` renders nothing at all and
            this is the only place the package is named. */}
        <p className="mt-2 text-lg leading-[1.2] text-[#5b6899]">{option.name}</p>

        <dl className="mt-5 grid grid-cols-2 items-center rounded-[10px] border border-[#e9f0f8] py-3">
          {minutes !== null && (
            <PairCell icon={Timer} label={t("packageDuration")}>
              {t(isHourly ? "serviceMinimumMinutes" : "serviceDurationMinutes", { count: minutes })}
            </PairCell>
          )}
          <PairCell icon={Tag} label={t("railPriceLabel")} divided={minutes !== null}>
            {t(isHourly ? "pricingModeHourly" : "pricingModeFixed")}
          </PairCell>
        </dl>

        <RailSlotPicker serviceId={serviceId} optionId={option.id} locale={locale} picked={picked} onPick={setPicked} />

        <div className="mt-[22px] grid gap-2.5">
          {/* A link, and to a page: a purchase behind a dialog cannot be
              linked to, opened in a new tab, or survive the round trip
              through sign-in. `optionId` is the package this card is quoting
              — without it checkout books the service's default instead. */}
          <Link
            to="/book/$serviceId"
            params={{ serviceId }}
            search={{
              optionId: option.id,
              ...(picked
                ? { startsAt: picked.startsAt, memberId: [...picked.memberIds].sort()[0] }
                : {}),
            }}
            className="flex h-12 items-center justify-center gap-3 rounded-[10px] bg-[var(--color-blue-public)] text-base font-semibold text-white hover:opacity-90"
          >
            {t("bookThisService")}
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </Link>
          <MessageProviderButton
            providerId={providerId}
            className="h-11 rounded-[10px] bg-[#e9f3fe] text-[15px] font-medium text-[#1f6ff0] hover:bg-[var(--color-blue-soft)] hover:opacity-100"
          />
        </div>

        <ul className="mt-[22px] grid list-none gap-3 p-0">
          {trustItems.map((item) => (
            <li key={item} className="flex gap-3.5 text-sm leading-[1.45] text-[#6c78ac]">
              <Check className="mt-px h-[19px] w-[19px] shrink-0 text-[#1bbf55]" strokeWidth={2.4} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* How paying works on Ntizo, said once: the M-Pesa request arrives
          after the provider confirms. The same sentence for every service. */}
      <div className="flex items-center gap-3.5 rounded-xl border border-[#e9f0f8] px-5 py-4">
        <span aria-hidden="true" className="grid h-[46px] w-[43px] shrink-0 place-items-center rounded-lg bg-[#e8f8ee]">
          <Smartphone className="h-6 w-6 text-[#13923a]" />
        </span>
        <div className="min-w-0">
          <b className="block text-[15px] font-bold text-[#0e1261]">{t("mpesaCardTitle")}</b>
          <span className="mt-1 block text-[13px] leading-[1.45] text-[#6c78ac]">{t("mpesaCardBody")}</span>
        </div>
      </div>
    </>
  );
}

function PairCell({
  icon: Icon,
  label,
  divided = false,
  children,
}: {
  icon: typeof Timer;
  label: string;
  divided?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-3.5", divided && "border-l border-[#e9f0f8]")}>
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ebf5fe] text-[var(--color-blue-public)]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <dt className="text-[13px] leading-[1.25] text-[#6b7bab]">{label}</dt>
        <dd className="mt-[3px] text-[15px] leading-[1.25] font-bold text-[#01085f]">{children}</dd>
      </div>
    </div>
  );
}

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function dayLabel(dateIso: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/**
 * The tile's two lines, "Ter" over "25 Mar". Built from parts rather than
 * one format: `{ day, month: "short" }` prints "25/03" in Portuguese, and the
 * short weekday is the whole word ("terça") in some ICU builds — three
 * letters is what fits a 62px tile.
 */
function tileLines(dateIso: string, locale: string): [string, string] {
  const clean = (s: string) => s.replace(/\.$/, "");
  const weekday = clean(dayLabel(dateIso, locale, { weekday: "short" }));
  const month = clean(dayLabel(dateIso, locale, { month: "short" }));
  const day = dayLabel(dateIso, locale, { day: "numeric" });
  return [weekday.length > 4 ? weekday.slice(0, 3) : weekday, `${day} ${month}`];
}

/**
 * "Escolha a data" and "Horário disponível": the next five days, and the
 * first eight starts of the chosen one. A day with nothing free is shown and
 * refused, so the row keeps its shape. Renders nothing while the calendar has
 * nothing to offer this week — the button below still opens it.
 */
function RailSlotPicker({
  serviceId,
  optionId,
  locale,
  picked,
  onPick,
}: {
  serviceId: string;
  optionId: string;
  locale: string;
  picked: Start | null;
  onPick: (start: Start | null) => void;
}) {
  const { t } = useTranslation("directory");
  const [today] = useState(() => localDateAt(deviceTimeZone(), new Date()));
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const { data, isPending } = useServiceAvailability({
    serviceId,
    memberId: undefined,
    from: today,
    to: addDays(today, RAIL_DAYS - 1),
  });

  if (isPending) {
    return (
      <div className="mt-[26px] grid gap-3">
        <Skeleton className="h-[62px] w-full" />
        <Skeleton className="h-[90px] w-full" />
      </div>
    );
  }
  if (!data || !data.days.some((d) => d.starts.length > 0)) return null;

  const days = Array.from({ length: RAIL_DAYS }, (_, i) => addDays(today, i));
  const startsOn = (date: string) => data.days.find((d) => d.date === date)?.starts ?? [];
  const day = chosenDay ?? days.find((d) => startsOn(d).length > 0)!;
  const starts = startsOn(day).slice(0, RAIL_SLOTS);
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: data.timezone }).format(
      new Date(iso),
    );

  return (
    <>
      <h3 className="mt-[26px] text-lg leading-[1.1] font-bold text-[#000351]">{t("railChooseDate")}</h3>
      <div className="mt-3 flex gap-2">
        {days.map((date) => {
          const free = startsOn(date).length > 0;
          const on = date === day;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={on}
              aria-disabled={!free}
              aria-label={dayLabel(date, locale, { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => {
                if (!free) return;
                setChosenDay(date);
                onPick(null);
              }}
              className={cn(
                "grid h-[62px] flex-1 place-content-center rounded-[9px] text-center text-[13px] leading-[1.45] capitalize aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
                on ? "bg-[var(--color-blue-public)] text-white" : "bg-[#f0f7fe] text-[#7380ad]",
              )}
            >
              {tileLines(date, locale).map((line) => (
                <span key={line} aria-hidden="true">
                  {line}
                </span>
              ))}
            </button>
          );
        })}
        <Link
          to="/book/$serviceId"
          params={{ serviceId }}
          search={{ optionId }}
          aria-label={t("railMoreDates")}
          className="grid h-[62px] w-10 shrink-0 place-items-center rounded-[9px] bg-[#f0f7fe] text-[var(--color-blue-public)]"
        >
          <CalendarDays className="h-[21px] w-[21px]" aria-hidden="true" />
        </Link>
      </div>

      <h3 className="mt-[26px] text-lg leading-[1.1] font-bold text-[#000351]">{t("railChooseTime")}</h3>
      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {starts.map((start) => {
          const on = picked?.startsAt === start.startsAt;
          return (
            <button
              key={start.startsAt}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? null : start)}
              className={cn(
                "h-10 rounded-lg text-sm tabular-nums",
                on ? "bg-[var(--color-blue-public)] text-white" : "bg-[#f0f7fe] text-[#1a2468] hover:bg-[var(--color-blue-soft)]",
              )}
            >
              {time(start.startsAt)}
            </button>
          );
        })}
      </div>
    </>
  );
}
