import { useTranslation } from "react-i18next";
import { Select } from "@ntizo/frontend-ui";
import { FilterField, FilterSheet } from "@/shared/components/filter-sheet";
import {
  EMPTY_FILTERS,
  type PeopleFilters,
} from "../domain/people";
import type { ProviderRole } from "../domain/types";

/**
 * The people list's filters, in the panel every list shares.
 *
 * A sheet rather than a popover under the button, following the reference. Two
 * pickers fit in a popover, but the panel is where a third and fourth will go —
 * date joined, invited-by — and a popover that grows into a form is a popover
 * that starts covering the table it filters.
 *
 * The status picker moved out to the tab row above the card, where the
 * mockup puts it; the role is what is left in here.
 */
export function PeopleFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PeopleFilters;
  onChange: (next: PeopleFilters) => void;
}) {
  const { t } = useTranslation("provider");

  const roleOptions = [
    { value: "", label: t("peopleAllRoles") },
    { value: "owner", label: t("peopleRoles.owner") },
    { value: "admin", label: t("peopleRoles.admin") },
    { value: "staff", label: t("peopleRoles.staff") },
  ];

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("peopleFilterTitle")}
      canClear={filters.role !== null}
      // The search box and the tab are left where they are: both live outside
      // this panel, in sight.
      onClear={() => onChange({ ...filters, role: EMPTY_FILTERS.role })}
    >
      <FilterField id="filter-role" label={t("peopleRole")}>
        <Select
          id="filter-role"
          value={filters.role ?? ""}
          onChange={(value) =>
            onChange({
              ...filters,
              role: (value || null) as ProviderRole | null,
            })
          }
          options={roleOptions}
          ariaLabel={t("peopleRole")}
        />
      </FilterField>
    </FilterSheet>
  );
}

/**
 * Whether the Filter button should show it is doing something. The status is
 * the tab row's now, which says so itself.
 */
export function filterCount(filters: PeopleFilters): number {
  return filters.role ? 1 : 0;
}
