import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarTrigger,
} from "@ntizo/frontend-ui";
import { useServiceCities } from "@/features/directory/services/viewmodel/use-browse-services";
import { ConsoleUserMenu } from "./console-user-menu";

/**
 * The bar across the top of both consoles, measured off
 * docs/design/2026-10-mockups/provider/reservas.html: 91px tall, the
 * wordmark over the sidebar's 297px column, a 731×48 search, then the city,
 * the bell and the person, split by 44px hairlines.
 *
 * The search is the site's service search: it takes the term — and the city
 * picked beside it — to `/services`. A console-wide search over bookings,
 * people and messages does not exist on the server, and a field that
 * pretended to search them would be a control that lies.
 */
export function ConsoleTopBar({
  homeUrl,
  slug,
  zoneTag,
  roleLabel,
  ns,
  bell,
  defaultCity,
  accountMenu,
}: {
  homeUrl: string;
  slug: string | undefined;
  /** Written under the wordmark — "Admin" on the platform, nothing in a workspace. */
  zoneTag?: string;
  /** Written under the person's name: what they are in this zone. */
  roleLabel: string;
  ns: "provider" | "admin";
  bell: ReactNode;
  /** The city the picker starts on — the workspace's own, when it has one. */
  defaultCity?: string | null;
  /** The zone's own entries for the account menu. */
  accountMenu?: ReactNode;
}) {
  const [city, setCity] = useState<string | null>(defaultCity ?? null);
  const shownCity = city ?? defaultCity ?? null;

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 md:h-[91px] md:px-0">
      {/* The sidebar's width from `md` up, so the search starts where the page does. */}
      <div className="flex shrink-0 items-center md:w-[var(--sidebar-width)] md:pl-[43px]">
        <Link to={homeUrl} params={{ slug: slug ?? "" }} className="flex flex-col items-start leading-none" aria-label="Ntizo">
          <img src="/brand/logo-primary.svg" alt="" className="h-7 w-auto max-w-none md:h-[34px]" />
          {zoneTag && (
            <span className="mt-0.5 text-[14.5px] font-medium text-[var(--color-muted-foreground)]">{zoneTag}</span>
          )}
        </Link>
      </div>

      <SidebarTrigger className="ml-2 hidden md:inline-flex xl:hidden" />
      <ConsoleSearch city={shownCity} className="hidden min-w-0 flex-1 md:ml-2.5 md:block md:max-w-[731px]" />
      {/* On a phone the search is gone and this pushes the cluster right; from
          `md` the search itself grows to its 731px and the cluster follows it. */}
      <div className="flex-1 md:hidden" />

      <div className="ml-auto flex shrink-0 items-center md:pl-6 md:pr-12">
        <CityPicker city={shownCity} onPick={setCity} />
        <Hairline />
        <div className="md:px-7">{bell}</div>
        <Hairline />
        <div className="md:pl-[22px]">
          <ConsoleUserMenu ns={ns} roleLabel={roleLabel}>
            {accountMenu}
          </ConsoleUserMenu>
        </div>
      </div>
    </header>
  );
}

function Hairline() {
  return <span aria-hidden="true" className="hidden h-11 w-px bg-[var(--color-border)] md:block" />;
}

function ConsoleSearch({ city, className }: { city: string | null; className?: string }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        void navigate({ to: "/services", search: { ...(q ? { q } : {}), ...(city ? { city } : {}) } });
      }}
    >
      <label className="relative block">
        <span className="sr-only">{t("consoleSearch")}</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-[18px] h-[22px] w-[22px] -translate-y-1/2 text-[var(--color-primary)]"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("consoleSearch")}
          className="h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] pr-4 pl-[54px] text-base text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-faint)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
        />
      </label>
    </form>
  );
}

/**
 * "Maputo ▾": the city the top bar's search looks in. The list is the
 * public browse's own (cities that have published services), so every
 * choice leads somewhere; with no cities known the control is not drawn.
 */
function CityPicker({ city, onPick }: { city: string | null; onPick: (city: string | null) => void }) {
  const { t } = useTranslation("common");
  const cities = useServiceCities();
  if (cities.length === 0 && !city) return null;
  return (
    <div className="hidden xl:block xl:pr-[34px]">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            type="button"
            aria-label={t("consoleCity")}
            className="flex items-center gap-2 text-base font-medium text-[var(--color-headline)]"
          >
            <MapPin aria-hidden="true" className="h-[21px] w-[21px]" />
            <span className="max-w-[160px] truncate">{city ?? t("consoleAllCities")}</span>
            <ChevronDown aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
          <DropdownMenuItem onSelect={() => onPick(null)}>
            <span className="flex-1">{t("consoleAllCities")}</span>
            {city === null && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          {cities.map((c) => (
            <DropdownMenuItem key={c.city} onSelect={() => onPick(c.city)}>
              <span className="flex-1">{c.city}</span>
              {city === c.city && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
