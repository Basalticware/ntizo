import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import {
  WEEKDAY_ORDER,
  compareRules,
  formatHours,
  groupRules,
  minutesToLabel,
  nextIntervalOn,
  patternMinutes,
  rulesOn,
  seedDay,
  weekdayLabel,
  withoutRule,
  type WeekRuleGroup,
} from "../domain/week";
import type { WeeklyRuleDraft } from "../domain/types";
import { RuleDrawer } from "./rule-drawer";

/**
 * One member's working week as seven rows, Monday first: the day, whether it
 * is worked at all, and its intervals as chips.
 *
 * It replaces a list of rule cards — "09:00 – 13:00 on M T W T F" — which
 * stored the week the way the drawer edits it and made the reader rebuild the
 * week from it in their head. Seven rows are the week itself: which days are
 * off is visible without reading anything, and Saturday being shorter is a
 * shorter row.
 *
 * Still the same draft underneath. Every control here hands the page a whole
 * new list of rows, `setWeeklyPattern` still replaces the week in one call,
 * and the drawer still edits one rule's days, hours and shape — opened on one
 * interval, it can extend that interval to other days in the same go.
 *
 * The draft lives one level up, in the page, because the week drawn below it
 * is the same data; saving lives there too, as a bar raised only when the
 * draft differs from what was fetched.
 */
export function WeekRules({
  canEdit,
  locale,
  rules,
  onChange,
}: {
  /**
   * Whether the signed-in caller may change *this* member's week — read from
   * the live role and the live selection every render, never from whatever
   * this component first mounted with.
   */
  canEdit: boolean;
  locale: string;
  rules: readonly WeeklyRuleDraft[];
  onChange: (rules: WeeklyRuleDraft[]) => void;
}) {
  const { t } = useTranslation("provider");
  /**
   * What the drawer is open on: one existing row, or a new one started from a
   * day's "add" — or nothing.
   */
  const [editing, setEditing] = useState<
    | { kind: "row"; rule: WeeklyRuleDraft }
    | { kind: "new"; weekday: number }
    | null
  >(null);

  function commit(next: WeeklyRuleDraft[]) {
    onChange([...next].sort(compareRules));
  }

  // The row under edit is replaced by whatever the drawer hands back, so it
  // is out of both the overlap check and the list it is put back into.
  const base = editing?.kind === "row" ? withoutRule(rules, editing.rule) : [...rules];
  const initial: WeekRuleGroup | null =
    editing?.kind === "row" ? (groupRules([editing.rule])[0] ?? null) : null;
  const preset =
    editing?.kind === "new"
      ? { weekdays: [editing.weekday], ...nextIntervalOn(rules, editing.weekday) }
      : undefined;

  return (
    <div className="grid">
      <ul className="m-0 grid list-none divide-y divide-[var(--color-line-2)] p-0">
        {WEEKDAY_ORDER.map((weekday) => {
          const rows = rulesOn(rules, weekday);
          const on = rows.length > 0;
          const day = weekdayLabel(locale, weekday);
          return (
            <li
              key={weekday}
              className="grid gap-x-4 gap-y-2.5 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Toggle
                  label={day}
                  checked={on}
                  disabled={!canEdit}
                  onChange={(next) =>
                    commit(
                      next
                        ? [...rules, ...seedDay(rules, weekday)]
                        : rules.filter((r) => r.weekday !== weekday),
                    )
                  }
                />
                {/* The day's total beside its name on a phone, under it in
                    the narrow day column wider up. */}
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-x-3 sm:flex-col sm:items-start sm:gap-0.5">
                  <span
                    className={cn(
                      "truncate text-[15px] leading-5 font-semibold first-letter:uppercase",
                      on ? "text-[var(--color-headline)]" : "text-[var(--color-muted-foreground)]",
                    )}
                  >
                    {day}
                  </span>
                  {on ? (
                    <span className="shrink-0 text-[13px] leading-4 text-[var(--color-muted-foreground)] tabular-nums">
                      {formatHours(patternMinutes(rows), locale)}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {on ? (
                  rows.map((rule) => (
                    <IntervalChip
                      key={`${rule.startMinute}-${rule.endMinute}-${rule.bufferMinutes}-${rule.slotIntervalMinutes}-${rule.capacity}`}
                      day={day}
                      rule={rule}
                      canEdit={canEdit}
                      onEdit={() => setEditing({ kind: "row", rule })}
                      onRemove={() => commit(withoutRule(rules, rule))}
                    />
                  ))
                ) : (
                  <span className="text-[14px] text-[var(--color-muted-foreground)]">
                    {t("availabilityDayOff")}
                  </span>
                )}
                {on && canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: "new", weekday })}
                    aria-label={`${t("availabilityAddInterval")} — ${day}`}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 text-[14px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-blue-softer)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    <span className="max-sm:sr-only">{t("availabilityAddInterval")}</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Mounted only while open, and keyed on what it opened on — that is
          what seeds the drawer's fields, instead of an effect that could fire
          again while somebody is halfway through typing in them. */}
      {editing && (
        <RuleDrawer
          key={
            editing.kind === "row"
              ? `row-${editing.rule.weekday}-${editing.rule.startMinute}-${editing.rule.endMinute}`
              : `new-${editing.weekday}`
          }
          open
          onOpenChange={(open) => !open && setEditing(null)}
          locale={locale}
          initial={initial}
          preset={preset}
          others={base}
          onSubmit={(next) => commit([...base, ...next])}
        />
      )}
    </div>
  );
}

/**
 * One interval: its hours open the drawer, the cross removes it.
 *
 * A rule given its own buffer, grid or capacity carries a small mark, so the
 * one interval that sells differently from the rest can be found without
 * opening every one; the details are in its title and its accessible name.
 */
function IntervalChip({
  day,
  rule,
  canEdit,
  onEdit,
  onRemove,
}: {
  day: string;
  rule: WeeklyRuleDraft;
  canEdit: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("provider");
  const hours = `${minutesToLabel(rule.startMinute)} – ${minutesToLabel(rule.endMinute)}`;
  const shape = [
    rule.bufferMinutes !== null &&
      t("availabilityRuleBufferTag", { minutes: rule.bufferMinutes }),
    rule.slotIntervalMinutes !== null &&
      (rule.slotIntervalMinutes === 0
        ? t("availabilityRuleGridNone")
        : t("availabilityRuleGridTag", { minutes: rule.slotIntervalMinutes })),
    rule.capacity !== null && t("availabilityRuleCapacityTag", { bookings: rule.capacity }),
  ].filter((s): s is string => typeof s === "string");
  const named = `${day}, ${hours}`;

  const body = (
    <>
      <span className="tabular-nums">{hours}</span>
      {shape.length > 0 && (
        <>
          <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5 opacity-70" />
          <span className="sr-only">({shape.join(", ")})</span>
        </>
      )}
    </>
  );

  return (
    <span
      title={shape.length > 0 ? shape.join(" · ") : undefined}
      className="inline-flex h-9 items-center rounded-[10px] border border-[var(--color-blue-line)] bg-[var(--color-blue-softer)] text-[13.5px] font-semibold text-[var(--color-primary)] sm:text-[14px]"
    >
      {canEdit ? (
        <>
          <button
            type="button"
            onClick={onEdit}
            aria-label={t("availabilityRuleEditNamed", { hours: named })}
            className="inline-flex h-full cursor-pointer items-center gap-1.5 rounded-l-[10px] pr-1 pl-2.5 hover:bg-[var(--color-blue-soft)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          >
            {body}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("availabilityRuleRemoveNamed", { hours: named })}
            className="grid h-full w-7 cursor-pointer place-items-center rounded-r-[10px] text-[color-mix(in_srgb,var(--color-primary)_70%,transparent)] hover:bg-[var(--color-blue-soft)] hover:text-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3">{body}</span>
      )}
    </span>
  );
}

/** An on/off switch, named by the day it turns on. */
function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--color-card)] shadow-sm transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}
