import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { serviceQueries } from "../data/service.repository";
import { categoryPickerQueries, type CategoryPickerOption } from "../data/category-picker.repository";

/** A workspace's own services, whatever their status. */
export function useServices(providerId: string | undefined) {
  return useQuery(serviceQueries.mine(providerId ?? ""));
}

/**
 * The platform's categories by id, in the reader's language — the name and
 * the icon a services row draws beside the service. The same cache entry the
 * editor's category picker reads, so the list costs no second request once
 * either screen has been open.
 */
export function useCategoryLookup(): ReadonlyMap<string, CategoryPickerOption> {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const query = useQuery(categoryPickerQueries.all(locale));
  return useMemo(() => new Map((query.data ?? []).map((c) => [c.id, c])), [query.data]);
}
