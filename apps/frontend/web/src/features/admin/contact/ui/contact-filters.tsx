import { useTranslation } from "react-i18next";
import { Select } from "@ntizo/frontend-ui";
import type { ContactRequestKind, ContactRequestStatus } from "@ntizo/shared";
import { FilterField, FilterSheet } from "@/shared/components/filter-sheet";

const KINDS: readonly ContactRequestKind[] = ["contact", "feedback"];

/** What the queue shows when nobody has touched the filters: open requests, of either kind. */
export const DEFAULT_CONTACT_FILTERS: ContactFilters = { kind: undefined, status: "open" };

export interface ContactFilters {
  kind: ContactRequestKind | undefined;
  /** `undefined` is every status — the one value that is not the default. */
  status: ContactRequestStatus | undefined;
}

/**
 * How many filters the panel has set — the number on the Filter button. The
 * status is not one: it is the tab row's, which says so itself.
 */
export function contactFilterCount(filters: ContactFilters): number {
  return filters.kind !== undefined ? 1 : 0;
}

/**
 * The contact queue's filters, in the panel every list shares.
 *
 * The kind only. The status is the tab row above the list, and a second
 * status picker in here moved the same value from two places; "Clear filters"
 * leaves the tab alone, as the workspace's bookings panel does.
 */
export function ContactFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ContactFilters;
  onChange: (next: ContactFilters) => void;
}) {
  const { t } = useTranslation("admin");

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("contactFilterTitle")}
      canClear={contactFilterCount(filters) > 0}
      onClear={() => onChange({ ...filters, kind: undefined })}
    >
      <FilterField id="filter-kind" label={t("contactKindColumn")}>
        <Select
          id="filter-kind"
          value={filters.kind ?? ""}
          onChange={(value) => onChange({ ...filters, kind: (value || undefined) as ContactRequestKind | undefined })}
          ariaLabel={t("contactKindColumn")}
          options={[
            { value: "", label: t("contactKindAll") },
            ...KINDS.map((kind) => ({ value: kind, label: t(`contactKind.${kind}`) })),
          ]}
        />
      </FilterField>
    </FilterSheet>
  );
}
