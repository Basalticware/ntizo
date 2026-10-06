import { useTranslation } from "react-i18next";
import { Select } from "@ntizo/frontend-ui";
import type { ProviderBookingPageDTO } from "@ntizo/shared/read-models";
import { FilterField, FilterSheet } from "@/shared/components/filter-sheet";
import type { ProviderTab } from "../domain/status";

/** The tab the page opens on, and the one "Clear filters" goes back to. */
export const DEFAULT_PROVIDER_TAB: ProviderTab = "requests";

export interface BookingFilters {
  tab: ProviderTab;
  memberId: string | null;
}

/**
 * How many filters are set — the number on the Filter button. The tab is not
 * one: it has its own row above the list now, and is always set to something.
 */
export function bookingFilterCount(filters: BookingFilters): number {
  return filters.memberId !== null ? 1 : 0;
}

/**
 * The workspace's booking filters, in the panel every list shares.
 *
 * The tabs are the row above the list (`StatusTabs`); what is left here is
 * the professional, which narrows the tab on screen and is offered only when
 * the workspace has more than one. "Clear filters" leaves the tab alone.
 */
export function BookingsFilterSheet({
  open,
  onOpenChange,
  filters,
  members,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: BookingFilters;
  /** The workspace's roster, from the last page answered. */
  members: ProviderBookingPageDTO["members"];
  onChange: (next: BookingFilters) => void;
}) {
  const { t } = useTranslation("provider");

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("bookings.filterTitle")}
      canClear={bookingFilterCount(filters) > 0}
      onClear={() => onChange({ ...filters, memberId: null })}
    >
      {members.length > 1 && (
        <FilterField id="filter-member" label={t("bookings.memberLabel")}>
          <Select
            id="filter-member"
            value={filters.memberId ?? ""}
            onChange={(value) => onChange({ ...filters, memberId: value || null })}
            ariaLabel={t("bookings.memberLabel")}
            options={[
              { value: "", label: t("bookings.memberFilterAll") },
              ...members.map((m) => ({ value: m.id, label: m.firstName })),
            ]}
          />
        </FilterField>
      )}
    </FilterSheet>
  );
}
