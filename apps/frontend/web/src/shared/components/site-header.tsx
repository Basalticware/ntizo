import type { ComponentProps } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@ntizo/frontend-ui";
import { HeaderActions } from "@/shared/components/header-actions";
import { ServiceSearch } from "@/shared/components/service-search";
import { PUBLIC_NAV } from "@/shared/lib/public-nav";
import { useServiceCities } from "@/features/directory/services/viewmodel/use-browse-services";

/**
 * A destination in the header, as the October 2026 mockups draw it
 * (`client/public.css`, `.ph nav a`): ink text, and the lit one blue and bold
 * with a 3px bar on the header's bottom edge. The bar is drawn by `::after`
 * on a link that is the header's full height, so it sits on the border rather
 * than under the word.
 *
 * This supersedes the bare navy text of 7 September 2026: the mockups the
 * user approved light the current page in the public blue.
 */
function navLinkClassName(active: boolean, overlay: boolean): string {
  if (overlay) {
    return active
      ? "flex h-full items-center gap-1.5 text-sm font-bold whitespace-nowrap text-white"
      : "flex h-full items-center gap-1.5 text-sm font-medium whitespace-nowrap text-white/75 hover:text-white";
  }
  return cn(
    "relative flex h-full items-center gap-1.5 text-sm whitespace-nowrap",
    active
      ? "font-bold text-[#004bf4] after:absolute after:inset-x-[-8px] after:bottom-0 after:h-[3px] after:rounded-[2px] after:bg-[var(--color-blue-public)]"
      : "font-medium text-[#2b3a66] hover:text-[var(--color-headline)]",
  );
}

/**
 * "Cidades ▾": the cities that actually have services, each opening the
 * services list narrowed to it.
 *
 * Read from the same facet the list's own City pill offers, so the header
 * can never name a city whose list is empty. Nothing at all until there are
 * two — a menu with one city in it is a link pretending to be a choice.
 */
function CitiesMenu({ className }: { className: string }) {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const cities = useServiceCities();
  if (cities.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button type="button" className={className}>
          {t("nav.cities")}
          <ChevronDown className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {cities.map((c) => (
          <DropdownMenuItem
            key={c.city}
            onSelect={() => void navigate({ to: "/services", search: { city: c.city } })}
          >
            {c.city}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The header every public page wears — `client/public.css`'s `.ph.ph-search`.
 *
 * One 68px row, in the mockups' order: the logo; the site's search field and
 * its "Pesquisar" button; the destinations; then the language, and "Entrar"
 * with a blue "Criar conta" for a visitor — the bell and the avatar menu for
 * somebody signed in.
 *
 * **The search stays in the bar on every page.** The mockups draw the bar
 * with a search on the service page and without one elsewhere; the user chose
 * the search everywhere, so a reader who wants a different service never has
 * to find their way back to a page that happens to have a field.
 *
 * **Two of the mockups' items are not here.** "Como funciona" has no page or
 * section to land on — the home page's section of that name was removed — and
 * a link that goes nowhere is worse than none. The location field ("Maputo
 * ▾") is the services list's City filter again, so the list's own bar carries
 * it. "Cidades" is here because the list can be narrowed to a city, and only
 * once there are cities to choose between: see `CitiesMenu`.
 *
 * The side inset is the page's `--pw-pad`, through `.public-inset`, so the
 * logo lines up with the content under it on every page.
 *
 * `overlay` puts it on top of artwork — transparent, white logo, white
 * controls. Nothing passes it today; it is kept so a page with a hero image
 * does not need a second header.
 */
export function SiteHeader({
  overlay = false,
  current = "explore",
  search = {},
}: {
  overlay?: boolean;
  /**
   * Which destination is lit. `"none"` for pages outside the three — the
   * company pages — so the header does not claim they are "Explore".
   * `endsWith("none")` matches no nav key, which is the whole mechanism.
   */
  current?: "explore" | "categories" | "services" | "providers" | "none";
  /**
   * What the bar asks for and what a submit does with it.
   *
   * Passed straight through to `ServiceSearch` rather than re-declared as
   * four props here, which keeps that component's rule that `to`,
   * `placeholder`, `label` and `search` arrive together or not at all — each
   * one alone is a bug it has already shipped.
   *
   * Omitted is the landing hero's behaviour: ask for a service, and a submit
   * starts a fresh search. A list page passes its own so that a typed term
   * keeps the category, the filters, the city and the sort underneath it.
   */
  search?: ComponentProps<typeof ServiceSearch>;
}) {
  const { t } = useTranslation("landing");
  const { t: ta } = useTranslation("auth");

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-20"
          : "sticky top-0 z-20 border-b border-[#eef2f8] bg-[var(--color-background)]"
      }
    >
      {/* A wrapping flex below `md`: the logo and the account controls on the
          first row, the search on a row of its own — `order-last` plus
          `w-full` is what puts it there. One element moved by the layout,
          rather than a second copy per breakpoint, which would put two
          searchboxes and two identical labels in the document. From `md` it
          is the mockup's single row. */}
      <div
        className={cn(
          "public-inset flex flex-wrap items-center gap-x-2.5 gap-y-3 py-3 text-sm font-medium whitespace-nowrap md:h-[67px] md:flex-nowrap md:py-0",
          overlay ? "text-white" : "text-[#2b3a66]",
        )}
      >
        {/* `max-w-none` undoes Tailwind's preflight, which caps every `img`
            at `max-width: 100%` — in a row that is short of room that cap
            lets the wordmark shrink instead of the search field. A logo that
            changes size with the window is not a logo. */}
        <Link to="/" className="shrink-0">
          <img
            src={overlay ? "/brand/logo-white.svg" : "/brand/logo-primary.svg"}
            alt="Ntizo"
            className="h-8 w-auto max-w-none"
          />
        </Link>

        {/* `min-w-0` so the field gives way before anything else does: the
            destinations and the account controls are `nowrap` and keep their
            width, and the field is the one thing in the row that still works
            narrower. 190px plus the button is the mockup's width. */}
        <div className="order-last w-full min-w-0 md:order-none md:ml-[26px] md:w-auto md:max-w-[315px] md:flex-1">
          <ServiceSearch {...search} className="w-full" />
        </div>

        <nav className="ml-3 hidden h-full items-center gap-4 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={navLinkClassName(item.key.endsWith(current), overlay)}
            >
              {t(item.key)}
            </Link>
          ))}
          <CitiesMenu className={navLinkClassName(false, overlay)} />
        </nav>

        <div className="ml-auto flex h-full shrink-0 items-center">
          <HeaderActions
            onDark={overlay}
            signedOutAction={
              <>
                <Link
                  to="/sign-in"
                  className={cn(
                    "font-semibold whitespace-nowrap",
                    overlay ? "text-white" : "text-[var(--color-blue-public)]",
                  )}
                >
                  {t("signIn")}
                </Link>
                {/* The bar's one filled shape besides the search's own
                    button. Hidden on a phone, where the row is the logo and
                    two controls and the sign-in page offers the account. */}
                <Link
                  to="/sign-up"
                  className="hidden h-[42px] items-center justify-center rounded-[10px] bg-[var(--color-blue-public)] px-[22px] font-semibold whitespace-nowrap text-white hover:opacity-90 sm:inline-flex"
                >
                  {ta("signUp")}
                </Link>
              </>
            }
          />
        </div>
      </div>
    </header>
  );
}
