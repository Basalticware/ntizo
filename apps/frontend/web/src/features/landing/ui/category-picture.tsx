import { Sparkles, icons } from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import type { CategoryDTO } from "@ntizo/shared/read-models";
import { BrandImage } from "@/shared/components/brand-image";

/**
 * Resolve a Lucide icon name from the database to the component.
 *
 * Looked up rather than imported one by one: the set lives in a table an
 * administrator edits, so the code cannot know it at build time. An unknown or
 * missing name falls back to `Sparkles` rather than rendering nothing — an
 * empty square says less than a wrong-but-present mark.
 */
function categoryIcon(name: string | null) {
  if (!name) return Sparkles;
  return icons[name as keyof typeof icons] ?? Sparkles;
}

/**
 * A category's picture: its own photograph, else its icon on the soft blue
 * tile.
 *
 * Only the database's photograph — the home keeps no stock pictures of its
 * own, so what a reader sees is what an administrator uploaded. An upload
 * that fails to load ("Mecânico"'s 403s on dev) lands on the icon too, not
 * on the browser's broken-image glyph.
 */
export function CategoryPicture({
  category,
  className,
  iconClassName = "h-7 w-7",
}: {
  category: Pick<CategoryDTO, "imageUrl" | "icon">;
  className?: string;
  iconClassName?: string;
}) {
  const Icon = categoryIcon(category.icon);
  const isFallback = !category.icon || !icons[category.icon as keyof typeof icons];
  return (
    <BrandImage
      src={category.imageUrl}
      alt=""
      className={cn("object-cover", className)}
      fallback={
        <span className={cn("grid place-items-center bg-[var(--color-blue-soft)]", className)}>
          <Icon
            data-testid={isFallback ? "category-icon-fallback" : `category-icon-${category.icon}`}
            className={cn("text-[var(--color-primary)]", iconClassName)}
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </span>
      }
    />
  );
}
