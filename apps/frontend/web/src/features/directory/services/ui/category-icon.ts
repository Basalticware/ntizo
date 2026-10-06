import { Sparkles, icons, type LucideIcon } from "lucide-react";
import {
  CATEGORY_FILTER_LIMIT,
  useCategoryPreview,
} from "@/features/landing/viewmodel/use-categories";

/**
 * A category's own lucide glyph, by the name an administrator stored on it, or
 * the sparkle every unknown one gets — the same fallback the home page's
 * category grid uses.
 */
export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Sparkles;
  return icons[name as keyof typeof icons] ?? Sparkles;
}

/**
 * The glyph for a category known only by its code — which is all a service
 * carries. Read from the same cached list the browse's filter uses, so a
 * detail page reached from the list costs no request.
 */
export function useCategoryIcon(code: string): LucideIcon {
  const categories = useCategoryPreview(CATEGORY_FILTER_LIMIT).data?.items ?? [];
  return categoryIcon(categories.find((c) => c.code === code)?.icon);
}
