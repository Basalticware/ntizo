import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import { Skeleton, cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { relativeDayLabel, shortDate } from "@/shared/lib/relative-day";
import type { ActivityEntry } from "../domain/types";
import { ActivityKindIcon } from "./activity-icon";

/**
 * A feed of what happened, for whichever zone renders it.
 *
 * One component for all three — the provider's workspace, the customer's
 * account, the admin console — because a list of events is the same object in
 * each; only the events differ. What each zone supplies is its own words, so
 * "what happened here" can be a workspace, a person or a platform without the
 * list needing to know which.
 *
 * The strings arrive as props rather than through `useTranslation` for that
 * reason: a namespace would have to be one zone's, and the other two would be
 * borrowing it. `renderDescription` is the same idea applied to one row: the
 * list gets `type` + `payload`, and only the zone knows the `activityType.*`
 * namespace to read them through — see `domain/types.ts`'s `activityTypeKey`.
 *
 * Drawn as the October mockup's "Linha temporal": a card, the events grouped
 * under their day, each one a time, the kind's tile and the sentence. The
 * admin console's audit trail is built from the same pieces below, with the
 * actor added beside each event.
 */
export function ActivityList({
  entries,
  loading,
  title,
  hint,
  emptyTitle,
  emptyBody,
  locale,
  renderDescription,
  skeletonRows = 5,
}: {
  entries: readonly ActivityEntry[];
  loading: boolean;
  title: string;
  /** The line under the title, saying what this list covers. */
  hint?: string;
  emptyTitle: string;
  emptyBody: string;
  locale: string;
  /** Turns one entry's `type` + `payload` into the sentence this zone shows. */
  renderDescription: (entry: ActivityEntry) => string;
  /** How many placeholders to draw. Five fills a screen without lying. */
  skeletonRows?: number;
}) {
  return (
    <TimelineCard title={title} hint={hint}>
      {loading ? (
        <TimelineSkeleton rows={skeletonRows} />
      ) : entries.length === 0 ? (
        <EmptyCard badge={Activity} title={emptyTitle} body={emptyBody} />
      ) : (
        <TimelineDays
          entries={entries}
          locale={locale}
          renderEntry={(entry, time) => (
            <TimelineRow key={entry.id} time={time} type={entry.type} title={renderDescription(entry)} />
          )}
        />
      )}
    </TimelineCard>
  );
}

/** The card the timeline sits in: its heading, and the line under it. */
export function TimelineCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 pt-[18px] pb-[22px] sm:px-6"
    >
      <h2 className="m-0 text-[17.5px] font-bold text-[var(--color-headline)]">{title}</h2>
      {hint && <p className="mt-1 mb-0 text-sm text-[var(--color-muted-foreground)]">{hint}</p>}
      {children}
    </section>
  );
}

/**
 * Entries under the day they happened, newest day first — the order the
 * feeds already arrive in, so grouping never reorders. "Hoje" and "Ontem" in
 * the reader's language; older days by their weekday, with the date beside.
 * Days are the reader's own, which is the zone the times beside them are in.
 */
export function TimelineDays<E extends { occurredAt: string }>({
  entries,
  locale,
  renderEntry,
  now = new Date(),
}: {
  entries: readonly E[];
  locale: string;
  renderEntry: (entry: E, time: string) => ReactNode;
  now?: Date;
}) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const civil = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const clock = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" });
  const weekday = new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" });
  const today = civil.format(now);
  const yesterday = civil.format(new Date(now.getTime() - 86_400_000));

  const days: { key: string; first: string; entries: E[] }[] = [];
  for (const entry of entries) {
    const key = civil.format(new Date(entry.occurredAt));
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, first: entry.occurredAt, entries: [entry] });
  }

  return (
    <>
      {days.map((day, i) => {
        const near = day.key === today || day.key === yesterday;
        const name = near ? relativeDayLabel(day.first, timeZone, now, locale) : weekday.format(new Date(day.first));
        return (
          <div key={day.key}>
            <h3 className={cn("mb-2 flex items-center text-[15px] font-normal text-[var(--color-faint)]", i === 0 ? "mt-4" : "mt-[22px]")}>
              <b className="mr-3 text-base font-bold text-[var(--color-headline)]">
                {name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)}
              </b>
              <span aria-hidden="true" className="mr-2.5 text-[10px]">•</span>
              {shortDate(day.first, timeZone, locale, { year: true })}
            </h3>
            <ul className="m-0 grid list-none p-0">
              {day.entries.map((entry) => renderEntry(entry, clock.format(new Date(entry.occurredAt))))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/**
 * One event: the bullet, the time, the kind's tile, who did it when the feed
 * says, the sentence and the line under it, and a pill at the end.
 */
export function TimelineRow({
  time,
  type,
  avatar,
  title,
  sub,
  aside,
}: {
  time: string;
  type: string;
  avatar?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <li
      className={cn(
        "grid min-h-[58px] items-center gap-x-3 border-b border-[var(--color-line-2)] py-2 last:border-b-0 sm:gap-x-[18px]",
        avatar
          ? "grid-cols-[44px_38px_minmax(0,1fr)] sm:grid-cols-[22px_54px_38px_38px_minmax(0,1fr)_auto]"
          : "grid-cols-[44px_38px_minmax(0,1fr)] sm:grid-cols-[22px_54px_38px_minmax(0,1fr)_auto]",
      )}
    >
      <span aria-hidden="true" className="hidden h-[7px] w-[7px] justify-self-center rounded-full bg-[color-mix(in_srgb,var(--color-faint)_60%,white)] sm:block" />
      <span className="text-sm whitespace-nowrap tabular-nums text-[color-mix(in_srgb,var(--color-faint)_85%,var(--color-primary))]">{time}</span>
      <ActivityKindIcon type={type} />
      {avatar && <span className="hidden sm:block">{avatar}</span>}
      <div className="min-w-0">
        <p className="m-0 text-[14.5px] leading-[1.35] text-[var(--color-headline)]">{title}</p>
        {sub && <p className="m-0 mt-[3px] truncate text-[13.5px] leading-[1.35] text-[var(--color-faint)]">{sub}</p>}
      </div>
      {aside ? <span className="hidden justify-self-end sm:block">{aside}</span> : <span className="hidden sm:block" />}
    </li>
  );
}

/**
 * The loading state, built to the height of the row it stands in for: a
 * 58px row with the 38px tile, so the card does not change height the
 * moment the data lands.
 */
export function TimelineSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="m-0 mt-4 grid list-none p-0">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex min-h-[58px] items-center gap-[18px] border-b border-[var(--color-line-2)] py-2 last:border-b-0">
          <Skeleton className="h-4 w-[54px]" />
          <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-[9px]" />
          <div className="grid gap-1.5">
            <Skeleton className="h-[15px] w-56 max-w-full" />
            <Skeleton className="h-[13px] w-36" />
          </div>
        </li>
      ))}
    </ul>
  );
}
