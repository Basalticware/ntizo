import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrandImage } from "@/shared/components/brand-image";
import { ArrowDown, ArrowUp, CirclePlus, Filter, MoreHorizontal, Pencil, Search, Shapes } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  Sheet,
  SheetContent,
  cn,
} from "@ntizo/frontend-ui";
import { CollectionCard } from "@/shared/components/collection-card";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageAction, usePageHeader } from "@/shared/lib/page-header";
import { CategoryForm, PICKER_CLASS, categoryIcon } from "./category-form";
import { adminCategoryQueries } from "../data/admin-category.repository";
import {
  useAdminCategories,
  useReorderCategories,
  useSaveCategory,
} from "../viewmodel/use-admin-categories";
import {
  adminName,
  moved,
  translatedCount,
  TOTAL_LOCALES,
  type AdminCategory,
} from "../domain/types";

type StateFilter = "" | "active" | "hidden";

/**
 * The kinds of work the platform organises, and the one screen that says how
 * far each of them has been translated.
 *
 * The list takes the whole width, and the form opens in a panel on the right
 * only when it is asked for — "Nova categoria" or a row's pencil. The October
 * mockup drew the form in a card beside the list, but half the console's
 * width is not enough for the list's five columns: at 1280–1880px the state,
 * the pencil and the menu were cut off, so the one way into editing was the
 * part nobody could see. What the list adds to a list of names is the translation
 * count, the whole reason this screen is not just a list of names: a
 * category reads as finished from whichever language you happen to be in,
 * and "3/8" is the only thing that says otherwise.
 *
 * The mockup's provider and service counts per category are not drawn: the
 * admin read does not carry them.
 */
export function AdminCategoriesPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const [search, setSearch] = useState("");
  const [state, setState] = useState<StateFilter>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  // Bumped on every "Nova categoria" and every "Editar", so the form starts
  // from what was asked for even when it is the same category twice.
  const [formKey, setFormKey] = useState(0);
  const formHeadingId = useId();
  const listInput = search.trim() ? { search: search.trim() } : {};
  const query = useAdminCategories(listInput);
  const save = useSaveCategory();
  const reorder = useReorderCategories(
    adminCategoryQueries.all(listInput).queryKey,
  );

  function openForm(category: AdminCategory | null) {
    setEditing(category);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  usePageHeader(t("categoriesTitle"), t("categoriesPage.subtitle"));
  usePageAction(
    <Button
      onClick={() => openForm(null)}
      className="h-12 gap-3.5 rounded-lg px-[26px] text-base font-semibold shadow-[0_4px_10px_rgba(0,94,253,0.18)]"
    >
      <CirclePlus className="h-[23px] w-[23px]" />
      <span className="hidden sm:inline">{t("categoryNew")}</span>
    </Button>,
  );

  const all = useMemo(() => query.data ?? [], [query.data]);
  const rows = useMemo(
    () => (state === "" ? all : all.filter((c) => c.isActive === (state === "active"))),
    [all, state],
  );
  // Dragging within a narrowed list would be rearranging a subset, which says
  // nothing about where those rows sit among the ones not shown. The handles
  // stay, disabled, with the reason as their tooltip — vanishing controls are
  // worse than refused ones.
  const searching = search.trim() !== "";
  const narrowed = searching || state !== "";

  function applyOrder(next: readonly AdminCategory[]) {
    reorder.mutate(next.map((c) => c.id));
  }

  return (
    <>
      <section className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 pt-5 pb-6 sm:px-6">
        <h2 className="m-0 text-[19px] font-bold text-[var(--color-headline)]">{t("categoriesPage.listTitle")}</h2>
        {query.error && (
          <p className="type-body mt-3 text-[var(--color-destructive)]">{t("categoriesError")}</p>
        )}

        {/* The card's own toolbar and frame are folded into this card: the
            mockup draws the table flush inside it, with its tools above. */}
        <div className="mt-[18px] [&>section]:gap-[18px] [&>section>div:first-child>div:last-child:empty]:hidden md:[&>section>div:nth-child(2)]:-mx-1.5 md:[&>section>div:nth-child(2)]:rounded-md md:[&>section>div:nth-child(2)]:border-0 [&_td]:pr-1.5 [&_td]:pl-2 [&_th]:pr-1.5 [&_th]:pl-2 [&_th]:text-[13px] [&_thead_tr]:h-[42px] [&_tbody_tr]:h-[72px]">
          <CollectionCard
            title={t("categoriesTitle")}
            tabs={
              <div className="grid w-full gap-3.5 sm:grid-cols-[minmax(0,1fr)_200px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-primary)]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("categoriesPage.searchPlaceholder")}
                    aria-label={t("categoriesPage.searchPlaceholder")}
                    className="h-[42px] rounded-[7px] pl-11 text-[14.5px] placeholder:text-[var(--color-faint)]"
                  />
                </div>
                <Select
                  value={state}
                  onChange={(value) => setState(value as StateFilter)}
                  ariaLabel={t("categoriesPage.stateLabel")}
                  triggerClassName={cn(PICKER_CLASS, "h-[42px] text-sm")}
                  options={[
                    { value: "", label: t("categoriesPage.allStates"), adornment: <Filter className="h-[18px] w-[18px] text-[var(--color-primary)]" /> },
                    { value: "active", label: t("categoriesPage.active") },
                    { value: "hidden", label: t("categoriesPage.inactive") },
                  ]}
                />
              </div>
            }
            shown={rows.length}
            total={all.length}
            loading={query.isLoading}
            columns={[
              { key: "category", label: t("categoriesCategory"), className: "pl-5" },
              {
                key: "languages",
                label: t("categoryLanguages"),
                skeletonWidth: "w-16",
                skeletonShape: "badge",
              },
              {
                key: "state",
                label: t("categoriesPage.stateLabel"),
                skeletonWidth: "w-20",
                skeletonShape: "badge",
              },
              { key: "edit", label: t("categoriesActions"), skeletonWidth: "w-10", hideOnCard: true },
              { key: "actions", label: "", align: "right", className: "pr-3" },
            ]}
            emptyText={t("categoriesEmpty")}
            emptyTitle={t("categoriesEmptyTitle")}
            emptyBadge={Shapes}
            noMatchesText={t("categoriesNoMatches")}
            noMatchesTitle={t("categoriesNoMatchesTitle")}
            filtered={narrowed}
            reorder={{
              handleLabel: t("categoryReorder"),
              onReorder: (keys) => {
                const byId = new Map(rows.map((c) => [c.id, c]));
                applyOrder(keys.flatMap((k) => (byId.has(k) ? [byId.get(k)!] : [])));
              },
              ...(narrowed ? { disabledReason: t("categoryReorderSearching") } : {}),
            }}
            rows={rows.map((category) => {
              const translated = translatedCount(category);
              return {
                key: category.id,
                primary: <CategoryCell category={category} locale={locale} />,
                cells: {
                  languages: (
                    // Amber until every language is filled in. A number alone
                    // reads as a fact about the category rather than as work
                    // outstanding.
                    <Badge tone={translated === TOTAL_LOCALES ? "success" : "warning"} className="h-7 px-3.5 text-[13px]">
                      {translated}/{TOTAL_LOCALES}
                    </Badge>
                  ),
                  state: (
                    <Badge tone={category.isActive ? "success" : "danger"} className="h-7 px-3.5 text-[13px]">
                      {t(category.isActive ? "categoriesPage.active" : "categoriesPage.inactive")}
                    </Badge>
                  ),
                  edit: (
                    <button
                      type="button"
                      onClick={() => openForm(category)}
                      aria-label={t("categoryEdit")}
                      aria-pressed={formOpen && editing?.id === category.id}
                      className="grid h-[42px] w-[42px] place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-primary)] hover:border-[var(--color-blue-line)] aria-pressed:border-[var(--color-blue-line)] aria-pressed:bg-[var(--color-blue-soft)]"
                    >
                      <Pencil aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.3} />
                    </button>
                  ),
                },
                actions: (
                  <RowActions
                    category={category}
                    isFirst={all[0]?.id === category.id}
                    isLast={all[all.length - 1]?.id === category.id}
                    canMove={!narrowed}
                    onMove={(delta) => applyOrder(moved(all, category.id, delta))}
                    onEdit={() => openForm(category)}
                    onToggle={() =>
                      save.mutate({
                        categoryId: category.id,
                        isActive: !category.isActive,
                        translations: category.translations.map((tr) => ({
                          locale: tr.locale,
                          name: tr.name,
                          description: tr.description,
                        })),
                      })
                    }
                  />
                ),
              };
            })}
          />
        </div>
      </section>

      <Sheet open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <SheetContent side="right" labelledBy={formHeadingId} className="w-full max-w-[640px] overflow-y-auto bg-[var(--color-card)]">
          <CategoryForm key={formKey} editing={editing} headingId={formHeadingId} onDone={closeForm} />
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * The category's icon in its tile (or its image, or its monogram), the name,
 * and under it the description — or, without one, the code.
 */
function CategoryCell({
  category,
  locale,
}: {
  category: AdminCategory;
  locale: string;
}) {
  const name = adminName(category, locale);
  const Icon = category.icon ? categoryIcon(category.icon) : null;
  const description =
    category.translations.find((tr) => tr.locale === locale)?.description ??
    category.translations.find((tr) => tr.description)?.description ??
    null;
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="grid h-[50px] w-[50px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
        {Icon ? (
          <Icon aria-hidden="true" className="h-[26px] w-[26px]" strokeWidth={2} />
        ) : category.imageUrl ? (
          <BrandImage src={category.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold">{initialsFrom(name)}</span>
        )}
      </div>
      <div className="min-w-0">
        <b className="block truncate text-[15px] font-bold text-[var(--color-headline)]">{name}</b>
        <span className="mt-1 block truncate text-[13.5px] leading-[1.35] text-[var(--color-faint)]">
          {description?.trim() || category.code}
        </span>
      </div>
    </div>
  );
}

function RowActions({
  category,
  isFirst,
  isLast,
  canMove,
  onMove,
  onEdit,
  onToggle,
}: {
  category: AdminCategory;
  isFirst: boolean;
  isLast: boolean;
  canMove: boolean;
  onMove: (delta: number) => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { t } = useTranslation("admin");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          aria-label={t("categoriesActions")}
          // `ml-auto`, because `grid` makes this block-level and a block-level
          // box ignores the cell's `text-align`.
          className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-2)] hover:bg-[var(--color-muted)]"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>{t("categoryEdit")}</DropdownMenuItem>
        {/* The same reordering, reachable without a mouse. HTML5 drag events
            do not fire for touch and cannot be driven from a keyboard, so a
            list whose only way to reorder is dragging cannot be reordered by
            most of the ways people use one. Disabled at the ends rather than
            hidden, so the menu does not change shape row by row. */}
        <DropdownMenuItem disabled={isFirst || !canMove} onSelect={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
          {t("categoryMoveUp")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isLast || !canMove} onSelect={() => onMove(1)}>
          <ArrowDown className="h-4 w-4" />
          {t("categoryMoveDown")}
        </DropdownMenuItem>
        {/* Hidden, never deleted: services and bookings point at a category and
            their history has to keep meaning what it meant. */}
        <DropdownMenuItem onSelect={onToggle}>
          {t(category.isActive ? "categoryHide" : "categoryShow")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
