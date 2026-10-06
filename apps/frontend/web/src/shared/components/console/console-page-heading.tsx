import { usePageHeaderAction, usePageHeaderValue } from "@/shared/lib/page-header";

/**
 * The page's own title, at the top of the content, as the mockups draw it:
 * a large navy heading, the sentence under it, and the page's one action on
 * the right ("Adicionar serviço", "Convidar membro").
 *
 * It used to be a small line in the top bar. The pages still set it the same
 * way — `usePageHeader` and `usePageAction` — so moving it here moved it on
 * every console page at once.
 */
export function ConsolePageHeading() {
  const header = usePageHeaderValue();
  const action = usePageHeaderAction();
  if (!header.title && !action) return null;
  // A detail page draws its own heading; only its action is left for this row.
  if (header.ownHeading) {
    return action ? (
      <div className="mb-4 flex w-full max-w-[1400px] justify-end gap-2">{action}</div>
    ) : null;
  }

  return (
    <div className="mb-6 flex w-full max-w-[1400px] flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] leading-[1.1] font-bold tracking-[-0.02em] text-[var(--color-headline)] md:text-[38px]">
          {header.title}
        </h1>
        {header.subtitle && (
          <p className="mt-1.5 text-base text-[var(--color-muted-foreground)] md:text-[17px]">{header.subtitle}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
