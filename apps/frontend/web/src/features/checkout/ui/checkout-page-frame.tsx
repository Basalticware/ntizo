import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * The measures steps 2 and 3 take from step 1 (`choose-when-page.tsx`), so the
 * three pages of one checkout read as one design: the same inset, the same
 * title and lede, the same cards, the same big "Continuar".
 *
 * Step 1 keeps its own copies — it was drawn first, from the mockup — and
 * these are those values on the theme's tokens.
 */

/** The mockup's 40px inset at its 1378px width, on the wrapper of every step. */
export const CHECKOUT_PAD = "[--pw-pad:clamp(16px,2.9vw,40px)]";

/** The content column and the 433px rail beside it, from `lg`. */
export const CHECKOUT_GRID =
  "public-inset grid gap-x-10 gap-y-8 pt-8 pb-10 md:pt-10 lg:grid-cols-[minmax(0,1fr)_433px]";

export const CHECKOUT_TITLE =
  "text-[36px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[var(--color-headline)] md:text-[62px]";

export const CHECKOUT_LEDE =
  "mt-3 text-lg leading-[1.45] text-[var(--color-muted-foreground)] md:text-[22px]";

/** One card per question the step asks. */
export const CHECKOUT_CARD =
  "rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6";

export const CHECKOUT_SECTION_TITLE =
  "text-[20px] leading-[1.25] font-bold text-[var(--color-headline)]";

/** A form label inside the cards: sentence case, navy, 8px above its field. */
export const CHECKOUT_FIELD_LABEL =
  "text-[15px] font-semibold text-[var(--color-headline)]";

/** The platform explaining itself rather than the customer's own data. */
export const CHECKOUT_INFO_PANEL =
  "flex min-h-[74px] items-center gap-4 rounded-[14px] bg-[var(--color-blue-softer)] px-5 py-4 text-[15px] leading-[1.45] text-[var(--color-ink-2)] md:px-8";

/** Step 1's "Continuar": the full width of the rail, 74px tall. */
export const CHECKOUT_BIG_BUTTON =
  "h-[74px] w-full gap-[17px] rounded-[10px] bg-[var(--color-blue-public)] text-[23px] font-bold [&_svg]:size-8";

/** The quiet text action inside a card — "Alterar morada", "Alterar". */
export const CHECKOUT_TEXT_ACTION =
  "text-[14.5px] font-semibold text-[var(--color-blue-public)] hover:underline";

/** The back link in the steps row — step 1's "Voltar ao serviço". */
export const CHECKOUT_BACK_LINK =
  "inline-flex items-center gap-[13px] text-[16.5px] font-medium text-[var(--color-blue-public)] hover:underline";

export function BackArrow() {
  return (
    <ArrowLeft
      className="h-[21px] w-[21px]"
      strokeWidth={2.2}
      aria-hidden="true"
    />
  );
}

/** The title and the lede, as step 1 sets them. */
export function CheckoutHeading({
  title,
  lede,
}: {
  title: string;
  lede: ReactNode;
}) {
  return (
    <>
      <h1 className={CHECKOUT_TITLE}>{title}</h1>
      <p className={CHECKOUT_LEDE}>{lede}</p>
    </>
  );
}
