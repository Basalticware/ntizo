import { useTranslation } from "react-i18next";
import { Calendar } from "lucide-react";
import type { WeeklyHoursDTO } from "@ntizo/shared/read-models";
import { groupWeekdays, hasAnyHours } from "@/features/directory/domain/weekly-hours";
import { minutesToLabel } from "@/shared/domain/week-format";
import { RailCard } from "@/features/directory/ui/rail-card";

/**
 * The provider's usual working week, in the sticky rail — "Segunda a sexta
 * 08:00 – 18:00", "Sábado 09:00 – 14:00", and so on, one row per run of
 * consecutive identical days that `groupWeekdays` has already collapsed.
 *
 * Renders nothing at all when `hasAnyHours` says no weekday has an interval.
 * Seven closed days is what a provider who never opened the availability
 * screen looks like, not a business that is genuinely never open — and
 * printing seven rows of "Closed" states the second thing as fact on the
 * strength of the first.
 *
 * `<dt>`'s label gets `first-letter:uppercase` rather than a capital baked
 * into `groupWeekdays`: `Intl` returns Portuguese weekday names lowercase
 * ("segunda a sexta"), which is correct running-text Portuguese, but wrong
 * the moment the word is a heading on its own line, which is the only way
 * this component uses it. Capitalising inside the domain function would be
 * right here and wrong everywhere else that label might be read mid-sentence.
 */
export function WeeklyHoursCard({ hours }: { hours: readonly WeeklyHoursDTO[] }) {
  const { t, i18n } = useTranslation("directory");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  if (!hasAnyHours(hours)) return null;

  const rows = groupWeekdays(hours, locale);

  return (
    <RailCard>
      <h2 className="flex items-center gap-3.5 text-base font-extrabold text-[var(--color-headline)]">
        <Calendar className="h-[19px] w-[19px] text-[#0a5afe]" strokeWidth={2} aria-hidden="true" />
        {t("availabilityHeading")}
      </h2>
      <dl className="mt-[18px] ml-2.5 grid gap-3 text-[15px] leading-[1.3] text-[#152b72]">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-between gap-4">
            <dt className="first-letter:uppercase">{row.label}</dt>
            {row.intervals.length > 0 ? (
              <dd className="font-medium text-[var(--color-headline)] tabular-nums">
                {row.intervals
                  .map((interval) => `${minutesToLabel(interval.startMinute)} – ${minutesToLabel(interval.endMinute)}`)
                  .join(", ")}
              </dd>
            ) : (
              <dd className="font-medium text-[var(--color-headline)]">
                {t("availabilityClosed")}
              </dd>
            )}
          </div>
        ))}
      </dl>
      <p className="mt-4 ml-2.5 text-[13px] leading-normal text-[#737ea3]">
        {t("availabilityUsualNote")}
      </p>
    </RailCard>
  );
}
