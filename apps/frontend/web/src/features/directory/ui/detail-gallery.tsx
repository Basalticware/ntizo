import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, cn } from "@ntizo/frontend-ui";
import { BrandImage } from "@/shared/components/brand-image";

/**
 * The two collages of the October 2026 mockups.
 *
 * - `service` (`client/servico-detalhe.html`): the main photo, and a column of
 *   three beside it, 659 : 212, the main one stepped by a dark "‹ 1 / 6 ›"
 *   pill at its foot.
 * - `provider` (`client/prestador-detalhe.html`): the main photo with a round
 *   arrow on either side and a "1 / 6" tag, and four beside it in two rows of
 *   two, 530 : 352.
 *
 * Both keep their proportions at every width — the frame has the mockup's
 * aspect ratio, and the tracks are fractions of it — so a narrower window
 * shows the same collage smaller rather than a different one.
 */
const LAYOUT = {
  service: {
    side: 3,
    frame: "sm:aspect-[880/311] sm:grid-cols-[659fr_212fr] sm:gap-[9px]",
    sideGrid: "sm:grid-rows-[120fr_93fr_88fr] gap-[5px]",
    tileRadius: "rounded-[10px]",
    mainRadius: "rounded-xl",
  },
  provider: {
    side: 4,
    frame: "sm:aspect-[889/342] sm:grid-cols-[530fr_352fr] sm:gap-2",
    sideGrid: "sm:grid-rows-[156fr_179fr] gap-2",
    tileRadius: "rounded-lg",
    mainRadius: "rounded-lg",
  },
} as const;

/**
 * The collage both detail pages open with.
 *
 * The main tile steps through every photo, so the count is on the photo
 * itself ("1 / 6") and the reader can see them all without leaving the page.
 * When the side tiles cannot hold the rest, the last of them names how many
 * more there are and opens every photo in a dialog — a grid meant for looking
 * at them, which a strip on the collage is not.
 *
 * The side tiles carry `alt=""`: they sit beside the one photo this component
 * describes, and "photograph 2 of 8" describes nothing. Inside the dialog
 * every photo is equally presented, so each is labelled by its position.
 *
 * Renders nothing at all with no photos: an empty frame reads as a page that
 * failed to load, where the plain absence of the section reads as "no photo
 * yet".
 */
export function DetailGallery({
  images,
  alt,
  badge,
  layout = "service",
}: {
  images: readonly string[];
  /** What the one described photo shows — a provider's or a service's name. */
  alt: string;
  /** Rendered over the main tile, e.g. the service's category. */
  badge?: ReactNode;
  layout?: keyof typeof LAYOUT;
}) {
  const { t } = useTranslation("directory");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const titleId = useId();

  if (images.length === 0) return null;

  const spec = LAYOUT[layout];
  const shownIndex = Math.min(index, images.length - 1);
  const main = images[shownIndex]!;
  const sideImages = images.slice(1, spec.side + 1);
  const hasSide = sideImages.length > 0;
  const hidden = images.length - 1 - sideImages.length;
  const many = images.length > 1;
  const step = (by: number) => setIndex((shownIndex + by + images.length) % images.length);
  const position = t("galleryPosition", { current: shownIndex + 1, total: images.length });

  return (
    <div className={cn("grid grid-cols-1 gap-3", spec.frame, !hasSide && "sm:grid-cols-1")}>
      <div
        className={cn(
          "relative aspect-[4/3] min-h-0 overflow-hidden bg-[var(--color-muted)] sm:aspect-auto sm:h-full",
          spec.mainRadius,
        )}
      >
        {/* Eager, unlike every other picture here: this is the one above the
            fold on both detail pages, and deferring it is deferring the thing
            the reader came for. */}
        <BrandImage src={main} alt={alt} loading="eager" className="h-full w-full object-cover" />
        {badge && <div className="absolute top-4 left-[13px]">{badge}</div>}

        {many && layout === "service" && (
          <div className="absolute bottom-2 left-3.5 flex h-[35px] w-[116px] items-center justify-between rounded-[18px] bg-[rgb(44,46,52)] px-1.5 text-[13px] text-white">
            <button type="button" onClick={() => step(-1)} aria-label={t("galleryPrevious")} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15">
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
            <span aria-live="polite" className="tabular-nums">{position}</span>
            <button type="button" onClick={() => step(1)} aria-label={t("galleryNext")} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15">
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        )}

        {many && layout === "provider" && (
          <>
            <button type="button" onClick={() => step(-1)} aria-label={t("galleryPrevious")} className="absolute top-1/2 left-[11px] -mt-[18px] grid h-9 w-9 place-items-center rounded-full bg-white text-[#1557e8] shadow-[0_1px_4px_rgba(0,0,0,.12)]">
              <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t("galleryNext")} className="absolute top-1/2 right-[11px] -mt-[18px] grid h-9 w-9 place-items-center rounded-full bg-white text-[#1557e8] shadow-[0_1px_4px_rgba(0,0,0,.12)]">
              <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
            </button>
            <span aria-live="polite" className="absolute bottom-4 left-[11px] grid h-8 min-w-[55px] place-items-center rounded-[18px] border border-white/35 bg-[rgba(20,22,30,.62)] px-2 text-sm font-semibold text-white tabular-nums">
              {position}
            </span>
          </>
        )}
      </div>

      {hasSide && (
        <div className={cn("hidden min-h-0 sm:grid", spec.sideGrid)}>
          {layout === "service"
            ? sideImages.map((src, i) => (
                <SideTile
                  key={src}
                  src={src}
                  className={spec.tileRadius}
                  more={i === sideImages.length - 1 && hidden > 0 ? hidden : 0}
                  onMore={() => setOpen(true)}
                />
              ))
            : [sideImages.slice(0, 2), sideImages.slice(2, 4)]
                .filter((row) => row.length > 0)
                .map((row, r) => (
                  <div
                    key={r}
                    className={cn(
                      "grid min-h-0 gap-1.5",
                      row.length === 2 && (r === 0 ? "grid-cols-[231fr_115fr]" : "grid-cols-[165fr_181fr]"),
                    )}
                  >
                    {row.map((src, i) => (
                      <SideTile
                        key={src}
                        src={src}
                        className={spec.tileRadius}
                        more={r * 2 + i === sideImages.length - 1 && hidden > 0 ? hidden : 0}
                        onMore={() => setOpen(true)}
                        pill
                      />
                    ))}
                  </div>
                ))}
        </div>
      )}

      {/* On a phone the side column is gone and the main photo steps through
          the rest; this is the way to see them all at once. */}
      {many && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 rounded-[10px] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-blue-public)] sm:hidden"
        >
          {t("galleryViewAll", { count: images.length })}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-card)] p-0">
          {/*
           * `Dialog`/`DialogContent` draw a fixed backdrop and a panel and
           * nothing else — no role, no name, no focus trap. The `role` and
           * `aria-labelledby` below are supplied here because without them a
           * screen reader is handed a floating panel with no boundary and no
           * name.
           */}
          <div role="dialog" aria-labelledby={titleId} className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
              <h2 id={titleId} className="type-h3">
                {t("galleryDialogTitle")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto border-t border-[var(--color-border)] p-5 sm:grid-cols-3">
              {images.map((src, i) => (
                <BrandImage
                  key={src}
                  src={src}
                  alt={`${alt} ${i + 1}`}
                  className="aspect-[4/3] w-full rounded-[var(--radius-card-sm)] object-cover"
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * One side photo. The last one carries "+ N fotos" when there are photos the
 * collage has no tile for, and opens the dialog — the overlay covering the
 * whole tile on the service page, a dark pill in its corner on the provider's.
 */
function SideTile({
  src,
  className,
  more,
  onMore,
  pill = false,
}: {
  src: string;
  className: string;
  more: number;
  onMore: () => void;
  pill?: boolean;
}) {
  const { t } = useTranslation("directory");
  return (
    <div className={cn("relative min-h-0 overflow-hidden bg-[var(--color-muted)]", className)}>
      <BrandImage src={src} alt="" className="h-full w-full object-cover" />
      {more > 0 &&
        (pill ? (
          <button
            type="button"
            onClick={onMore}
            className="absolute right-4 bottom-4 grid h-[39px] min-w-[98px] place-items-center rounded-[20px] border border-white/35 bg-[rgba(20,22,30,.62)] px-3 text-[15px] font-semibold text-white"
          >
            {t("galleryMore", { count: more })}
          </button>
        ) : (
          <button
            type="button"
            onClick={onMore}
            className="absolute inset-0 grid place-items-center bg-black/45 text-[14.5px] font-medium text-white"
          >
            {t("galleryMore", { count: more })}
          </button>
        ))}
    </div>
  );
}
