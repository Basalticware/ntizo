import { useTranslation } from "react-i18next";
import { ChevronLeft, X } from "lucide-react";
import { Sheet, SheetContent } from "@ntizo/frontend-ui";
import type { ReactNode } from "react";

const TITLE_ID = "help-center-title";

const ICON_BUTTON =
  "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[var(--color-ink-2)] hover:bg-[var(--color-blue-softer)] hover:text-[var(--color-primary)]";

/**
 * The panel itself: a right-hand sheet on a desktop, the same sheet full
 * width on a phone.
 *
 * `Sheet` since Task 1 is a real dialog — focus goes in, Escape closes,
 * focus comes back — so this component only decides the frame and the
 * header, not the modality.
 */
export function HelpPanel({
  open,
  onOpenChange,
  canGoBack,
  onBack,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  canGoBack: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("help");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        labelledBy={TITLE_ID}
        className="flex w-full flex-col sm:w-[26rem]"
      >
        {/* The system's sheet head: a white band under a hairline, the title
            in navy and the controls as the consoles draw an icon button. It
            was a filled blue band, the one place the help wore a colour of
            its own. */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button type="button" onClick={onBack} aria-label={t("back")} className={ICON_BUTTON}>
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h2 id={TITLE_ID} className="text-[18px] font-bold text-[var(--color-headline)]">
                {t("title")}
              </h2>
              <p className="text-sm text-[var(--color-muted-foreground)]">{t("greeting")}</p>
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className={ICON_BUTTON}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
