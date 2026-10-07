import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Button, Skeleton, buttonVariants, cn } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import { ServiceCard } from "@/shared/components/browse/service-card";
import { ProviderCard } from "@/shared/components/browse/provider-card";
import { listDisplayName } from "@/features/favourites/domain/list-name";
import type {
  FavouriteEntry,
  FavouriteList,
} from "@/features/favourites/domain/types";
import { useMyLists } from "@/features/favourites/viewmodel/use-my-lists";
import { useFavouriteListPage } from "@/features/favourites/viewmodel/use-list-page";
import { CustomerPageHeading } from "@/features/account/ui/customer-page";

/** How many card-shaped placeholders a cold load draws. */
const SKELETONS = 8;

/**
 * Everything the reader saved, on the cards they saved it from.
 *
 * This replaces a hardcoded empty state: the page said "you have not saved
 * anything yet" to everybody, including the people who had, because it never
 * asked. The backend has answered this since the favourites work shipped —
 * `favouriteListById` returns the entries with the list's own header — and the
 * three fields it needs were sitting unused in the repository with a comment
 * saying they belonged to this page.
 *
 * **One page, not the two the plan drew.** The plan had `/favourites` as a
 * grid of *list* cards and `/favourites/$listId` as the entries. A reader with
 * one list — which is everybody until they make a second — would then meet a
 * page whose entire content is one tile they have to click to reach what they
 * came for. So the entries are here, and the lists become a row of chips above
 * them, which appears only when there is more than one to choose between.
 *
 * **There is no "All" chip, and that is the server's shape rather than a
 * choice.** Every read of entries goes through `favouriteListById`, which
 * takes one list id; nothing answers "everything I ever saved". Faking it
 * client-side would mean one request per list and a cursor per list to merge,
 * for a view the API does not have.
 *
 * **The cards are the browse pages' own.** `ServiceCard` and `ProviderCard`,
 * not copies — the read model carries `serviceReadModel` and
 * `providerPublicReadModel` unchanged for exactly this, so a business saved
 * from `/providers` looks on this page like it did on that one.
 *
 * **No heart on these cards yet, deliberately.** Both cards take the control
 * as an optional slot and the home page's rails already pass nothing. Putting
 * `FavouriteButton` here would be the mistake the plan names: it quick-saves,
 * which unsaves from *everywhere*, and on a list's own page the heart has to
 * remove the entry from *this* list and leave the others alone. Doing that
 * needs each entry's other memberships, which is a request per card. It is a
 * real gap, not an oversight, and it is the next piece of work rather than a
 * wrong one shipped now.
 */
export function FavouritesPage() {
  const { t, i18n } = useTranslation("account");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { lists, loading: listsLoading } = useMyLists();
  const [chosenId, setChosenId] = useState<string | null>(null);

  // The server puts the default list first and `useMyLists` keeps that order,
  // so `lists[0]` is where the heart saves — the right list to open on. A
  // chosen id that no longer matches anything (a list deleted in another tab)
  // falls back to it rather than leaving the page with nothing to show.
  const current = lists.find((l) => l.id === chosenId) ?? lists[0];
  const { entries, loading, hasMore, loadingMore, loadMore } =
    useFavouriteListPage(current?.id, locale);

  return (
    <div className="w-full max-w-[1400px]">
      <CustomerPageHeading title={t("favouritesTitle")} />

      <div className="mt-[30px]">
        {/* The chips come before any branch below, so choosing a list does not
            make the row disappear while that list loads. */}
        {lists.length > 1 && (
          <ListChips
            lists={lists}
            currentId={current?.id}
            onChoose={setChosenId}
            label={t("favouritesListsLabel")}
          />
        )}

        {/* `listsLoading || loading` rather than `loading` alone. The entries
            query cannot start until `useMyLists` has answered with an id, and
            an infinite query that has not been enabled yet is pending
            forever — so between the two there is a moment where nothing is
            loading and nothing has arrived, which is precisely when a naive
            page tells somebody their favourites are gone. */}
        {listsLoading || loading ? (
          <CardSkeletons />
        ) : entries.length === 0 ? (
          <EmptyState
            hasOtherLists={lists.length > 1}
            isDefault={current?.isDefault ?? true}
            t={t}
          />
        ) : (
          <>
            <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {entries.map((entry) => (
                <li key={entryKey(entry)}>
                  <EntryCard entry={entry} locale={locale} />
                </li>
              ))}
            </ul>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {t(
                    loadingMore
                      ? "favouritesLoadingMore"
                      : "favouritesLoadMore",
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A saved listing is a service or a business, and the card follows.
 *
 * The switch is on `kind`, which the query selects inside both inline
 * fragments — see `LIST_BY_ID`. A `default` that renders nothing rather than
 * an exhaustiveness assertion: this discriminator arrives over the wire, so a
 * third kind added server-side must cost the reader one missing card, not a
 * blank page.
 */
function EntryCard({
  entry,
  locale,
}: {
  entry: FavouriteEntry;
  locale: string;
}) {
  if (entry.kind === "service") {
    return <ServiceCard service={entry.service} locale={locale} />;
  }
  if (entry.kind === "provider") {
    return <ProviderCard provider={entry.provider} locale={locale} />;
  }
  return null;
}

/**
 * A stable key per entry.
 *
 * The kind is part of it because a service and a business can legitimately
 * carry the same id — the same reason `targetType` rides in every favourites
 * query key.
 */
function entryKey(entry: FavouriteEntry): string {
  return entry.kind === "service"
    ? `service:${entry.service.id}`
    : `provider:${entry.provider.id}`;
}

/**
 * The lists, as a row to choose from.
 *
 * Drawn only above one list, so the common case — everybody, until they make
 * a second — is a page of saved things with nothing to operate above them.
 *
 * A `radiogroup` rather than tabs: these select which list the grid below is
 * of, and `aria-checked` is what says which one is current. Buttons rather
 * than links because the choice does not change the URL; that is the cost of
 * keeping this to one route, and it means a reload comes back to the default
 * list rather than the chosen one.
 *
 * Drawn as `StatusTabs` draws its boxes — the chosen one on the soft blue
 * ground with the count in a blue chip — so the row reads as the same
 * control the bookings and the quotes put over their lists.
 */
function ListChips({
  lists,
  currentId,
  onChoose,
  label,
}: {
  lists: FavouriteList[];
  currentId: string | undefined;
  onChoose: (id: string) => void;
  label: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="-mx-1 mb-7 flex gap-[15px] overflow-x-auto px-1 py-px [scrollbar-width:none]"
    >
      {lists.map((list) => {
        const current = list.id === currentId;
        return (
          <button
            key={list.id}
            type="button"
            role="radio"
            aria-checked={current}
            onClick={() => onChoose(list.id)}
            className={cn(
              "inline-flex h-[47px] shrink-0 items-center gap-3.5 rounded-[10px] border px-5 text-base font-medium whitespace-nowrap transition-colors",
              current
                ? "border-[var(--color-blue-line)] bg-[var(--color-blue-soft)] text-[color-mix(in_srgb,var(--color-primary)_80%,var(--color-headline))]"
                : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-headline)] hover:border-[var(--color-blue-line)]",
            )}
          >
            {listDisplayName(list, t)}
            <span
              className={cn(
                "grid h-[26px] min-w-[26px] place-items-center rounded-full px-[7px] text-sm font-semibold tabular-nums",
                current
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
              )}
            >
              {list.itemCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Nothing here, in the two senses that mean different things.
 *
 * Somebody who has saved nothing at all is invited to go and browse. Somebody
 * looking at a named list they emptied is told that *this list* is empty —
 * sending them to the directory would be answering a question they did not
 * ask, since their other lists still have things in them.
 */
function EmptyState({
  hasOtherLists,
  isDefault,
  t,
}: {
  hasOtherLists: boolean;
  isDefault: boolean;
  t: (key: string) => string;
}) {
  const nothingAnywhere = isDefault && !hasOtherLists;

  return (
    <EmptyCard
      framed
      badge={Heart}
      title={t(
        nothingAnywhere ? "favouritesEmptyTitle" : "favouritesListEmptyTitle",
      )}
      body={t(
        nothingAnywhere ? "favouritesEmptyBody" : "favouritesListEmptyBody",
      )}
      action={
        nothingAnywhere ? (
          <Link to="/services" className={buttonVariants({ size: "sm" })}>
            {t("favouritesEmptyAction")}
          </Link>
        ) : undefined
      }
    />
  );
}

/**
 * The grid a cold load draws, in the shape of the cards it stands in for.
 *
 * A photograph on top and a padded body under it, so nothing reflows the
 * moment the real cards replace these — the same reasoning `PopularServices`'
 * skeleton states for the identical shape.
 */
function CardSkeletons() {
  return (
    <ul
      aria-hidden="true"
      className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: SKELETONS }, (_, i) => (
        <li key={i}>
          <div className="overflow-hidden rounded-[10px] border border-[var(--color-border)]">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="grid gap-2 p-4">
              <Skeleton className="h-[13px] w-1/3" />
              <Skeleton className="h-[17px] w-4/5" />
              <Skeleton className="mt-2 h-[15px] w-2/3" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
