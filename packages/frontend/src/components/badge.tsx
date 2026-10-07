import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/**
 * Status pills — "Activa", "Confirmada", "Cancelada".
 *
 * The tones are semantic, not decorative: each is one ground/text pair from
 * the October 2026 mockups (`--color-*-bg` / `--color-*-fg` in globals.css),
 * measured off the PNGs rather than mixed, because the mockups' grounds are
 * not a fixed tint of their text colour.
 */
const badgeVariants = cva(
  // The October 2026 mockups' pill: 32px tall, 15px a side, 14px medium.
  "inline-flex h-8 items-center gap-[7px] rounded-full px-[15px] text-sm leading-none font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)]",
        success: "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)]",
        danger: "bg-[var(--color-bad-bg)] text-[var(--color-bad-fg)]",
        warning: "bg-[var(--color-warn-bg)] text-[var(--color-warn-fg)]",
        violet: "bg-[var(--color-violet-bg)] text-[var(--color-violet-fg)]",
        neutral: "bg-[color-mix(in_srgb,var(--color-ink-2)_8%,var(--color-background))] text-[var(--color-ink-2)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export { badgeVariants };
