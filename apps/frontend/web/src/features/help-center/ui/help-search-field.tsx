import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useHelpCenter } from "@/features/help-center/viewmodel/use-help-center";

/**
 * The one search box, on every screen that shows FAQ results.
 *
 * By default it reads and writes `help.query` directly rather than taking props: the
 * query lives in the panel's context precisely so the home screen and the
 * FAQ screen are searching the same thing, and a copy passed down would be
 * a second answer to that question.
 *
 * The FAQ screen needs it as much as home does. Without it, a reader who
 * clicked a popular question (which sets the query and navigates here)
 * landed on one result and nineteen missing ones, with no field explaining
 * why and no way back to the full list but the Back button.
 *
 * `/help` passes its own `value` and `onChange`: the page filters its own
 * list, and typing there should not leave a query waiting in the panel.
 */
export function HelpSearchField({
  value,
  onChange,
}: { value?: string; onChange?: (query: string) => void } = {}) {
  const { t } = useTranslation("help");
  const help = useHelpCenter();
  const query = value ?? help.query;
  const setQuery = onChange ?? help.setQuery;
  return (
    <label className="relative block">
      <span className="sr-only">{t("searchLabel")}</span>
      <Search
        aria-hidden="true"
        className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--color-primary)]"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchLabel")}
        className="h-[47px] w-full rounded-[var(--radius-field)] border border-[var(--color-input)] bg-[var(--color-background)] pr-4 pl-12 text-[15px] text-[var(--color-foreground)] placeholder:text-[var(--color-faint)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] focus-visible:outline-none"
      />
    </label>
  );
}
