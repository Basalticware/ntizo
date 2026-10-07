import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@ntizo/frontend-ui";
import { HeaderActions } from "@/shared/components/header-actions";
import { PUBLIC_NAV } from "@/shared/lib/public-nav";

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
      ? "font-bold text-[var(--color-primary)] after:absolute after:inset-x-[-8px] after:bottom-0 after:h-[3px] after:rounded-[2px] after:bg-[var(--color-blue-public)]"
      : "font-medium text-[var(--color-ink-2)] hover:text-[var(--color-headline)]",
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
}: {
  overlay?: boolean;
  /**
   * Which destination is lit. `"none"` for pages outside the three — the
   * company pages — so the header does not claim they are "Explore".
   * `endsWith("none")` matches no nav key, which is the whole mechanism.
   */
  current?: "explore" | "categories" | "services" | "providers" | "none";
}) {
  const { t } = useTranslation("landing");
  const { t: ta } = useTranslation("auth");

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-20"
          : "sticky top-0 z-20 border-b border-[var(--color-line-2)] bg-[var(--color-background)]"
      }
    >
      {/* One header for every page: the logo, the destinations centred in
          the window, the account on the right. A three-track grid with equal
          outer tracks is what keeps the destinations at the true centre
          whatever the two sides measure. Searching happens on the pages
          (the home, services and providers heroes), not in the bar. */}
      <div
        className={cn(
          "public-inset grid h-16 grid-cols-[1fr_auto] items-center gap-x-4 text-sm font-medium whitespace-nowrap md:h-[67px] lg:grid-cols-[1fr_auto_1fr]",
          overlay ? "text-white" : "text-[var(--color-ink-2)]",
        )}
      >
        {/* `max-w-none` undoes Tailwind's preflight, which caps every `img`
            at `max-width: 100%`. A logo that changes size with the window is
            not a logo. */}
        <Link to="/" className="justify-self-start">
          <img
            src={overlay ? "/brand/logo-white.svg" : "/brand/logo-primary.svg"}
            alt="Ntizo"
            className="h-8 w-auto max-w-none"
          />
        </Link>

        <nav className="hidden h-full items-center gap-8 lg:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={navLinkClassName(item.key.endsWith(current), overlay)}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex h-full items-center justify-self-end">
          <HeaderActions
            onDark={overlay}
            signedOutAction={
              <>
                <Link
                  to="/sign-in"
                  className={cn(
                    // 40px tall for the thumb; the text looks the same.
                    "inline-flex h-10 items-center px-1 font-semibold whitespace-nowrap",
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
