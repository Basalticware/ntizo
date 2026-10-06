import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import { isPast } from "@/features/directory/availability/domain/day-strip";

function formatDate(dateIso: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "Seg" … "Dom": three letters, Monday first, in the reader's language. */
function weekdayHeads(cells: readonly string[], locale: string): string[] {
  return cells.slice(0, 7).map((dateIso) => {
    const word = formatDate(dateIso, locale, { weekday: "short" }).replace(/\.$/, "");
    const short = word.length > 4 ? word.slice(0, 3) : word;
    return short.charAt(0).toUpperCase() + short.slice(1);
  });
}

/**
 * The month, as `client/reserva.html` draws it: the month's name between two
 * chevrons, the weekdays, and the days in rows of seven, the chosen one a
 * blue disc.
 *
 * Driven by the real calendar: a day is offered only when
 * `availability.forService` returned a start on it, and a day before today or
 * with nothing free is drawn faint and refused — kept in place so the grid
 * keeps its shape. Days of the neighbouring months are faint too, and refused
 * the same way: the month on screen is the one being chosen from.
 *
 * Each day's name says how many starts it has — "terça-feira, 14 de outubro,
 * 8 horários livres" — which the old week strip printed on its cards and a
 * 60px number has no room for.
 */
export function MonthCalendar({
  month,
  cells,
  selectedDate,
  todayIso,
  locale,
  startsByDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: {
  /** The 1st of the month on screen. */
  month: string;
  /** Every day in the grid, Monday first — see `monthGrid`. */
  cells: readonly string[];
  selectedDate: string;
  todayIso: string;
  locale: string;
  startsByDate: ReadonlyMap<string, number>;
  onSelectDate: (dateIso: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}) {
  const { t } = useTranslation("directory");
  const monthLabel = formatDate(month, locale, { month: "long", year: "numeric" });
  const inMonth = (dateIso: string) => dateIso.slice(0, 7) === month.slice(0, 7);
  // There is nothing to choose before this month, so there is no going back
  // past it.
  const canGoBack = month.slice(0, 7) > todayIso.slice(0, 7);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between px-[22px]">
        <button
          type="button"
          aria-label={t("availabilityPreviousMonth")}
          onClick={onPreviousMonth}
          disabled={!canGoBack}
          className="grid h-[30px] w-[30px] place-items-center rounded-full text-[var(--color-headline)] hover:bg-[var(--color-muted)] disabled:opacity-30"
        >
          <ChevronLeft className="h-[30px] w-[30px]" strokeWidth={2} />
        </button>
        <span className="text-[21.6px] font-bold text-[var(--color-headline)] first-letter:uppercase">
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label={t("availabilityNextMonth")}
          onClick={onNextMonth}
          className="grid h-[30px] w-[30px] place-items-center rounded-full text-[var(--color-headline)] hover:bg-[var(--color-muted)]"
        >
          <ChevronRight className="h-[30px] w-[30px]" strokeWidth={2} />
        </button>
      </div>

      <div aria-hidden="true" className="mt-8 grid grid-cols-7 text-center text-base text-[#5c6b98]">
        {weekdayHeads(cells, locale).map((head) => (
          <span key={head}>{head}</span>
        ))}
      </div>

      <div className="mt-3.5 grid grid-cols-7 [grid-auto-rows:56px] sm:[grid-auto-rows:70px]">
        {cells.map((dateIso) => {
          const count = startsByDate.get(dateIso) ?? 0;
          const offered = inMonth(dateIso) && !isPast(dateIso, todayIso) && count > 0;
          const selected = inMonth(dateIso) && dateIso === selectedDate;
          const caption = !inMonth(dateIso) || isPast(dateIso, todayIso)
            ? null
            : count > 0
              ? t("availabilityDayFree", { count })
              : t("availabilityDayClosed");
          return (
            <button
              key={dateIso}
              type="button"
              aria-pressed={selected}
              aria-disabled={!offered}
              aria-label={[formatDate(dateIso, locale, { weekday: "long", day: "numeric", month: "long" }), caption]
                .filter(Boolean)
                .join(", ")}
              onClick={() => {
                if (offered) onSelectDate(dateIso);
              }}
              className={cn(
                "mx-auto grid h-12 w-12 place-items-center self-center rounded-full text-[17px] tabular-nums aria-disabled:cursor-default sm:h-[60px] sm:w-[60px] sm:text-[19px]",
                selected
                  ? "bg-[var(--color-blue-public)] font-semibold text-white"
                  : offered
                    ? "font-medium text-[#1a2758] hover:bg-[var(--color-blue-soft)]"
                    : inMonth(dateIso)
                      ? "font-normal text-[var(--color-faint)]"
                      : "font-normal text-[#b3bacb]",
              )}
            >
              <span aria-hidden="true">{formatDate(dateIso, locale, { day: "numeric" })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
