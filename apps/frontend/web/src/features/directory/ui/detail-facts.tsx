import type { LucideIcon } from "lucide-react";

/**
 * The row of labelled facts under a provider's name — Categoria / Onde
 * atende / Serviços / Na Ntizo desde — as `client/prestador-detalhe.html`
 * draws it: a glyph in a 46px soft blue disc, the label over the value, the
 * four parted by hairlines and the row ruled above and below.
 *
 * A fact whose value is empty is dropped rather than rendered as a labelled
 * blank. A column that reads "On Ntizo since" with nothing under it looks
 * like the page failed to load the field, not like a provider who simply has
 * not filled that in. When every fact is empty the whole component renders
 * nothing, for the same reason.
 *
 * Markup is a real `<dl>` with a `<dt>`/`<dd>` pair per fact, so each value is
 * paired with its own label for assistive tech — and so callers can find the
 * row by `getAllByRole("term")` even when a label (e.g. "Services") repeats as
 * a section heading elsewhere on the page.
 */
export function DetailFacts({
  facts,
}: {
  facts: readonly { label: string; value: string; icon?: LucideIcon }[];
}) {
  const shown = facts.filter((fact) => fact.value.trim() !== "");
  if (shown.length === 0) return null;

  return (
    <dl className="mt-6 grid grid-cols-2 gap-y-4 border-y border-[#edf1f7] py-[18px] md:flex md:justify-between">
      {shown.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className={
            i === 0
              ? "flex items-center gap-[15px] pr-6"
              : "flex items-center gap-[15px] pr-6 md:border-l md:border-[#eef2f8] md:pl-6"
          }
        >
          {Icon && (
            <span aria-hidden="true" className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-[#e9f3fd] text-[#0552fe]">
              <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <dt className="text-[13.5px] text-[#56628e]">{label}</dt>
            <dd className="mt-[5px] text-[15px] font-medium whitespace-nowrap text-[#142777]">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
