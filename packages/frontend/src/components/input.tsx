import * as React from "react";
import { cn } from "../lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-[47px] w-full rounded-[var(--radius-field)] border border-[var(--color-input)] bg-[var(--color-background)] px-4 py-2 text-[15px] text-[var(--color-foreground)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
