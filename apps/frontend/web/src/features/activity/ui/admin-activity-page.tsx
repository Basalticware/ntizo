import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, ArrowRightLeft, Search } from "lucide-react";
import { ACTIVITY_TYPES, type ActivityType } from "@ntizo/shared";
import type { PlatformActivityEntryDTO } from "@ntizo/shared/read-models";
import { Avatar, AvatarFallback, Badge, Button, Input, Select } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { activityTypeKey } from "../domain/types";
import { describeActivity } from "../viewmodel/describe-activity";
import { usePlatformActivity } from "../viewmodel/use-activity";
import { activityIcon, activityTone } from "./activity-icon";
import { TimelineCard, TimelineDays, TimelineRow, TimelineSkeleton } from "./activity-list";

/**
 * What has happened on the platform: everybody's activity, newest first,
 * with who did each thing.
 *
 * The October mockup's timeline: the events under their day, each with its
 * time, the kind's tile, the actor's monogram, the sentence, who did it, and
 * the kind as a pill. The sentence comes from `describeActivity` against
 * this namespace's own `activityType.*` keys — the same renderer the
 * customer's feed uses, and the same timeline pieces (`activity-list.tsx`).
 * Read through `activityAll`, the admin-only field.
 *
 * Left out of the mockup, because the feed cannot back them: the stat cards
 * ("Hoje", "Últimos 7 dias", "Ações da equipa", "Eventos críticos"), the
 * "Visão geral" counts and the distribution donut — `activityAll` is
 * cursor-paged and returns no counts, so any number here would describe the
 * pages loaded so far, not the platform — and the user and date pickers,
 * which the query has no input for. The kind picker and the search are the
 * two filters it does take, and they sit where the mockup puts its row.
 */
export function AdminActivityPage() {
  const { t, i18n } = useTranslation("admin");
  // The count line under every console list is worded once, in `provider`.
  const { t: tp } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [type, setType] = useState<ActivityType | undefined>(undefined);
  const [search, setSearch] = useState("");

  const { entries, loading, failed, hasMore, loadMore } = usePlatformActivity({
    ...(type ? { type } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const filtered = type !== undefined || search.trim() !== "";

  usePageHeader(t("activityTitle"), t("activityHint"));

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      {failed && (
        <p role="alert" className="type-body mb-4 text-[var(--color-destructive)]">
          {t("activityError")}
        </p>
      )}

      <div className="grid items-end gap-5 md:grid-cols-[258px_minmax(0,1fr)]">
        <div className="grid gap-2">
          <label htmlFor="activity-type" className="text-[13.5px] font-medium text-[var(--color-ink-2)]">
            {t("activityPage.typeLabel")}
          </label>
          <Select
            id="activity-type"
            value={type ?? ""}
            onChange={(value) => setType((value || undefined) as ActivityType | undefined)}
            ariaLabel={t("activityTypeLabel")}
            triggerClassName={PICKER}
            options={[
              {
                value: "",
                label: t("activityPage.allTypes"),
                adornment: <ArrowRightLeft className="h-[18px] w-[18px] text-[var(--color-headline)]" />,
              },
              ...ACTIVITY_TYPES.map((value) => {
                // The same glyph the row leads with, so the picker reads as
                // the list it narrows.
                const Icon = activityIcon(value);
                return {
                  value,
                  label: t(`activityKind.${activityTypeKey(value)}`),
                  adornment: <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />,
                };
              }),
            ]}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--color-primary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("activitySearchPlaceholder")}
            aria-label={t("activitySearchPlaceholder")}
            className="h-11 rounded-[7px] pl-12 text-sm placeholder:text-[var(--color-faint)]"
          />
        </div>
      </div>

      <div className="mt-7">
        <TimelineCard title={t("activityPage.timeline")}>
          {loading ? (
            <TimelineSkeleton rows={6} />
          ) : entries.length === 0 ? (
            filtered ? (
              <EmptyCard icon={Search} title={t("activityNoMatchesTitle")} body={t("activityNoMatches")} />
            ) : (
              <EmptyCard badge={Activity} title={t("activityEmptyTitle")} body={t("activityEmpty")} />
            )
          ) : (
            <TimelineDays
              entries={entries}
              locale={locale}
              renderEntry={(entry, time) => (
                <TimelineRow
                  key={entry.id}
                  time={time}
                  type={entry.type}
                  avatar={<Actor entry={entry} />}
                  title={describeActivity(t, entry)}
                  sub={who(entry)}
                  aside={
                    <Badge tone={activityTone(entry.type)} className="h-[26px] px-3 text-[13px]">
                      {t(`activityKind.${activityTypeKey(entry.type)}`)}
                    </Badge>
                  }
                />
              )}
            />
          )}
        </TimelineCard>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {/* `activityAll` is cursor-paged and never returns a count: once
            another page exists, `entries.length` is only how many are loaded
            so far, and the line says "N shown" rather than claim a whole. */}
        {!loading && (
          <span className="type-body text-[var(--color-muted-foreground)]">
            {hasMore
              ? tp("peopleShownPartial", { shown: entries.length })
              : tp("peopleShown", { shown: entries.length, total: entries.length })}
          </span>
        )}
        {hasMore && (
          <Button variant="outline" size="sm" onClick={loadMore}>
            {t("activityLoadMore")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The mockup's picker: a 44px field with the glyph, the choice and the
 * chevron. `Select`'s `triggerClassName` replaces its own classes, so the
 * whole field is spelled here.
 */
const PICKER =
  "flex h-11 w-full items-center gap-[18px] rounded-[7px] border border-[var(--color-border)] bg-[var(--color-card)] pr-4 pl-[17px] text-left text-[14.5px] text-[var(--color-headline)] transition-colors hover:border-[var(--color-blue-line)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Who did it — the email beside the name, because an audit trail names
 * people by something that does not change when they edit their profile. An
 * account that is gone has neither, and says so with a dash rather than an
 * empty line.
 */
function who(entry: PlatformActivityEntryDTO): string {
  return [entry.actorName, entry.actorEmail].filter(Boolean).join(" · ") || "—";
}

/** The actor's monogram; the read carries no photo. */
function Actor({ entry }: { entry: PlatformActivityEntryDTO }) {
  return (
    <Avatar className="h-[38px] w-[38px]">
      <AvatarFallback className="bg-[var(--color-blue-soft)] text-[13px] font-semibold text-[color-mix(in_srgb,var(--color-primary)_75%,var(--color-headline))]">
        {initialsFrom(entry.actorName || entry.actorEmail || "?")}
      </AvatarFallback>
    </Avatar>
  );
}
