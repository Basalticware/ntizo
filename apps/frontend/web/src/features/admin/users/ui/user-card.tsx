import type { ReactNode } from "react";

/**
 * The user page's cards, as the admin provider page draws its own: a hairline
 * edge, the card ground, 14px corners, no shadow.
 */
export const USER_CARD =
  "min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 md:p-6";

export function UserCardHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <header>
      <h2 className="m-0 text-lg font-bold text-[var(--color-headline)]">{title}</h2>
      {hint && <p className="mt-1.5 mb-0 text-sm leading-[1.5] text-[var(--color-muted-foreground)]">{hint}</p>}
    </header>
  );
}

/** A sentence in place of a list — loading, or nothing to list. */
export function UserCardNote({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 py-6 text-center text-[15px] text-[var(--color-muted-foreground)]">{children}</p>
  );
}
