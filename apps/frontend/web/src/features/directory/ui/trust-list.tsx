import { Check } from "lucide-react";

/**
 * The green-check bullets at the bottom of the rail: what a reader can rely
 * on before they book.
 *
 * `TrustList` states nothing on its own — it has no idea whether this
 * provider is verified, keeps messages on-platform, or bundles the fee into
 * the price. It only lays out whatever claims the caller hands it. That is
 * deliberate: the verification sentence is true only when an administrator
 * has actually accepted this provider's documents, so it must be conditional
 * on `verified` at the call site, not baked in here as a constant string. The
 * rule this component exists to protect is "nothing goes in this list
 * without a fact behind it" — if the next feature wants a cheerful bullet,
 * it needs a real check to hang it on, not a slot in this component.
 */
export function TrustList({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-5 grid list-none gap-3 p-0 pl-1">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[19px_minmax(0,1fr)] gap-3.5 text-sm leading-normal text-[var(--color-muted-foreground)]">
          <Check aria-hidden="true" strokeWidth={2.4} className="mt-px h-[19px] w-[19px] text-[var(--color-ok-fg)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
