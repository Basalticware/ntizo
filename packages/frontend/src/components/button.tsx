import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/**
 * The three button styles the design system names — primary, secondary and
 * ghost — plus destructive, which the system's Danger colour implies for the
 * places that already needed it.
 *
 * `type-button` carries Inter Bold 15 rather than each size restating it, and
 * the radius comes from `--radius-card-sm` so buttons and cards round together
 * when the system's 12px changes.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 text-base leading-none font-semibold whitespace-nowrap rounded-[var(--radius-field)] transition-colors [&_svg]:size-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primário
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90",
        // Secundário — outlined in the brand blue. The second action in a
        // pair, when both belong to the same task.
        secondary:
          "border border-[var(--color-blue-outline)] bg-[var(--color-card)] text-[var(--color-primary)] hover:bg-[var(--color-blue-softer)]",
        // Neutral outline. Not in the design system's three, and needed
        // anyway: "Cancel" in a dialog and "Continue with Google" are not
        // second actions in the same task, they are other doors. Painting
        // them blue makes them compete with the primary button and, on the
        // sign-in page, makes Google look like the recommended way in.
        outline:
          "border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-headline)] hover:border-[var(--color-blue-line)] hover:bg-[var(--color-blue-softer)]",
        // Ghost
        ghost: "text-[var(--color-primary)] hover:bg-[var(--color-blue-softer)]",
        destructive:
          "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90",
      },
      size: {
        default: "h-[47px] px-6",
        sm: "h-10 px-[22px] text-[15px] [&_svg]:size-[18px]",
        lg: "h-12 px-7 text-[17px]",
        icon: "h-[47px] w-[47px]",
        "icon-xs": "h-6 w-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
