import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Check, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, cn } from "@ntizo/frontend-ui";
import { initialsFrom } from "@/shared/lib/initials";
import { memberDayFree } from "@/features/directory/availability/domain/day-strip";
import type { Start } from "@/features/directory/availability/domain/types";

/**
 * "Anyone", or one specific performer — only when a service actually has
 * more than one.
 *
 * Until 2026-08-13 this comment said `memberIds` could not be shown as
 * names, because the platform had deliberately not published them. That was
 * a real, considered choice, and it was reversed on 2026-08-13: `serviceById`
 * now publishes each performer's first name and photo
 * (`ServiceDetailDTO.performers`), so this picker takes an optional
 * `performers` list and labels a matching id with its real first name
 * instead of a position.
 *
 * The public `availability.forService` query itself still never carries a
 * name — see `domain/types.ts`'s `distinctMemberIds` doc comment — which is
 * exactly why the numbered fallback survives rather than being deleted: a
 * caller with no `performers` to hand, or one whose list doesn't cover a
 * given id, still needs a label for every id that query returns. It also
 * survives *with* `performers` supplied: `firstName` carries a `.default("")`
 * in its schema, so a member whose profile has no first name resolves to an
 * empty string, and this component treats that exactly like "no match"
 * rather than rendering a blank button — "Professional 1", "Professional 2",
 * a stable position in the sorted id list.
 *
 * **A row of person cards, always open (2026-10-07).** It was a framed list
 * folded on the current choice behind an "Escolher profissional" toggle, and
 * opened into rows with an empty radio ring each — a form to fill in for a
 * question most customers answer with the default. The user asked for it to
 * be better; now every choice is on screen as a small card — a face, a first
 * name, and how much of the day that person still has free — and the chosen
 * one wears the primary border and a tick. On a phone the cards are one row
 * that scrolls sideways (a salon with twelve staff costs no height); from
 * `sm` they wrap into a grid of equal cards.
 *
 * **The sub-lines are a sum over `days[].starts[].memberIds`** — who is free
 * at each moment — and cost no extra query. A count of moments is not a seat
 * index: how many openings a day holds is a fact a customer is being invited
 * to act on, where which seat they would occupy is not, and nothing here
 * publishes the second.
 *
 * **Hand it the whole roster's day, never one narrowed to the chosen
 * performer.** These rows speak for the people the customer has *not* picked
 * as much as for the one they have; fed a narrowed day they report zero for
 * everybody else, which is a list of twelve saying eleven things that are not
 * true. See `daysFor`.
 */
export function MemberPicker({
  memberIds,
  selectedMemberId,
  onChange,
  performers,
  starts,
  locale,
  timezone,
}: {
  memberIds: readonly string[];
  /** `undefined` is "anyone" — the same absence `availability.forService` itself reads that way. */
  selectedMemberId: string | undefined;
  onChange: (memberId: string | undefined) => void;
  /** First names and photos to label the roster with, keyed by matching `id`. Optional, and blank names inside it fall back same as no match at all. */
  performers?: readonly { id: string; firstName: string; avatarUrl: string | null }[];
  /** The starts of the day currently on screen — what every sub-line counts. */
  starts: readonly Start[];
  locale: string;
  /** The **service's** zone, never the device's — see `formatTime`. */
  timezone: string;
}) {
  const { t } = useTranslation("directory");

  // One performer means the question has one answer, and asking it is
  // noise — the same rule the provider-side screen already applies to its
  // own person picker (`isIndividualProvider`).
  if (memberIds.length <= 1) return null;

  const rows: { id: string | undefined; name: string; detail: string; free: boolean; face: React.ReactNode }[] = [
    {
      id: undefined,
      name: t("availabilityMemberAnyone"),
      detail: freeLine(t, locale, timezone, starts, undefined),
      free: memberDayFree(starts, undefined).count > 0,
      face: (
        // Stacked heads rather than a face or a monogram: this row is not
        // a person, and a `?` circle in the same place as eleven real
        // photographs reads as a performer whose picture failed to load.
        <Avatar className="h-11 w-11">
          <AvatarFallback>
            <Users className="h-5 w-5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      ),
    },
    ...memberIds.map((id, index) => {
      // A blank `firstName` (the schema's own `.default("")`) is treated
      // as no match at all, not as a name to render — see the doc
      // comment above.
      const performer = performers?.find((p) => p.id === id);
      const name = performer?.firstName
        ? performer.firstName
        : t("availabilityMemberOption", { number: index + 1 });
      return {
        id,
        name,
        detail: freeLine(t, locale, timezone, starts, id),
        free: memberDayFree(starts, id).count > 0,
        face: (
          <Avatar className="h-11 w-11">
            {/* `AvatarImage` rather than a bare `<img>`: with both
                children mounted a 404'd photo pushes the fallback out
                of the clipped circle, so the monogram never appears —
                see that component's own doc comment. */}
            {performer?.avatarUrl && <AvatarImage src={performer.avatarUrl} alt="" />}
            <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
          </Avatar>
        ),
      };
    }),
  ];
  return (
    <div className="grid gap-2.5">
      <span className="text-xs font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase">
        {t("availabilityMemberLabel")}
      </span>
      {/* An id the roster does not carry (a stale link) ticks nothing, which
          is the honest reading of a choice nothing here can name. */}
      <div
        role="radiogroup"
        aria-label={t("availabilityMemberLabel")}
        className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {rows.map((row) => (
          <MemberCard
            key={row.id ?? "anyone"}
            selected={selectedMemberId === row.id}
            onClick={() => onChange(row.id)}
            name={row.name}
            detail={row.detail}
            free={row.free}
            face={row.face}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A start time in the **service's** own zone, never the reader's device.
 *
 * A Maputo service read on a device clocked to UTC has already cost this flow
 * one empty grid under a live confirm button; "a próxima às 12:30" printed
 * two hours out is the same substitution wearing different clothes, and it is
 * harder to notice because the sentence still looks right.
 */
function formatTime(startsAt: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(startsAt),
  );
}

/**
 * The muted second line of a row: how much of the shown day this person still
 * has free, and when the next of it is.
 *
 * **It borrows the day card's own word for the same number** — "6 livres",
 * matching `availabilityDayFree`'s "17 livres" on the strip above. It said
 * "6 horas" first, and that was a different unit dressed as the same one: the
 * number is bookable *starts*, so six of them on a thirty-minute service is
 * three hours and on a ninety-minute one is nine. Two numbers on one screen
 * that a customer cannot add up are worse than one.
 *
 * **A person with nothing free that day says so and stays selectable.** They
 * are not dropped from the list and they are not `disabled`: a customer may
 * well pick them precisely to go looking at another day, and a roster that
 * changed length as the week was browsed would make the list a moving target.
 * That line names no day — "sem horários", not "sem horas hoje", which was
 * false on every day but one and read as a claim about today to somebody
 * looking at next Tuesday. The selected date is on the card directly above
 * the list, so repeating it in twelve rows would cost the space the row
 * hasn't got to say something already on screen.
 * `disabled` is separately out of the question — the day cards already
 * learned that a disabled button is pulled out of the tab order, so the very
 * label explaining why it cannot be used is the one thing that can never be
 * announced.
 */
function freeLine(
  t: TFunction,
  locale: string,
  timezone: string,
  starts: readonly Start[],
  memberId: string | undefined,
): string {
  const { count, nextStartsAt } = memberDayFree(starts, memberId);
  if (count === 0 || nextStartsAt === null) return t("availabilityMemberNone");
  return t("availabilityMemberFree", {
    count,
    time: formatTime(nextStartsAt, locale, timezone),
  });
}

function MemberCard({
  selected,
  onClick,
  name,
  detail,
  free,
  face,
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  detail: string;
  free: boolean;
  face: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      // The two visible lines, joined. A button with an `aria-label` is
      // announced by that label alone, so a card labelled with the name only
      // would hide the half of it that decides the choice — including "sem
      // horários", which is the whole reason that card is still here.
      aria-label={`${name}, ${detail}`}
      onClick={onClick}
      className={cn(
        "relative flex w-[136px] shrink-0 snap-start flex-col items-center gap-2 rounded-xl border bg-[var(--color-card)] px-3 pt-4 pb-3.5 text-center transition-colors sm:w-auto",
        selected
          ? "border-[var(--color-primary)] bg-[var(--color-blue-softer)] shadow-[0_0_0_1px_var(--color-primary)]"
          : "border-[var(--color-border)] hover:border-[var(--color-blue-line)] hover:bg-[var(--color-blue-softer)]",
      )}
    >
      {/* The tick only on the chosen card: an empty ring on every other one
          is what made the list read as a form. */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
      {face}
      <span aria-hidden="true" className="grid w-full min-w-0 gap-0.5">
        <span
          className={cn(
            "line-clamp-2 text-[14px] leading-tight font-semibold",
            selected ? "text-[var(--color-primary)]" : "text-[var(--color-headline)]",
          )}
        >
          {name}
        </span>
        <span
          className={cn(
            "line-clamp-2 text-[12px] leading-snug",
            free ? "text-[var(--color-ok-fg)]" : "text-[var(--color-faint)]",
          )}
        >
          {detail}
        </span>
      </span>
    </button>
  );
}
