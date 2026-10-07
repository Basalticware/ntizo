import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import type { BrowseSearch } from "@/features/directory/services/domain/browse-search";

/**
 * The same lightweight router stub `notification-bell-link.test.tsx` and
 * `service-row.test.tsx` use: every `<Link>` this component builds throws
 * outside a router, and there is nothing else here that needs one — `current`
 * is a plain prop, not a route search this harness has to parse.
 */
vi.mock("@/features/directory/services/viewmodel/use-browse-services", () => ({
  useServiceCities: () => [
    { city: "Maputo", count: 7 },
    { city: "Beira", count: 2 },
  ],
}));

/**
 * The category filter reads the same list the pages do. Stubbed here for the
 * same reason the cities are: this suite renders the bar on its own, outside
 * the query client the real page provides.
 *
 * Nine of them, which is under `OPTION_SEARCH_THRESHOLD` — the searchable case
 * has its own test that pushes the list past it.
 */
vi.mock("@/features/landing/viewmodel/use-categories", () => ({
  CATEGORY_FILTER_LIMIT: 48,
  useCategoryPreview: () => ({
    data: {
      items: [
        { id: "1", code: "plumbing", name: "Canalização", icon: null, imageUrl: null },
        { id: "2", code: "electrical", name: "Electricidade", icon: null, imageUrl: null },
        { id: "3", code: "cleaning", name: "Limpeza de casa", icon: null, imageUrl: null },
      ],
    },
  }),
}));

const { MobileServiceFilters, ServiceSidebar } = await import("../service-filters");

async function renderIn(node: ReactNode) {
  const root = createRootRoute({ component: () => <>{node}</> });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

const renderSidebar = (current: BrowseSearch) => renderIn(<ServiceSidebar current={current} />);

const renderMobile = (current: BrowseSearch, total = 0) =>
  renderIn(<MobileServiceFilters current={current} total={total} />);

const groupsIn = (root: HTMLElement) => [...root.querySelectorAll("h3")].map((h) => h.textContent);

const SERVICE_GROUPS = [
  "City",
  "Categories",
  "Price range",
  "Where it happens",
  "Type of provider",
  "How you pay",
  "Listing language",
];

describe("ServiceSidebar", () => {
  it("draws only the groups the services API applies", async () => {
    const { container } = await renderSidebar({});
    // No rating floor, no verified switch, no "Responde rápido": the services
    // API filters by none of them.
    expect(groupsIn(container)).toEqual(SERVICE_GROUPS);
    expect(screen.queryByRole("link", { name: /Verified providers only/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Apply/ })).toBeNull();
  });

  it("lists what is on as chips, each removing just itself", async () => {
    await renderSidebar({ locationType: "at_customer", paymentMode: "hourly", q: "corte" });
    expect(screen.getByText("Active filters (2)")).toBeInTheDocument();

    const href = screen.getByRole("link", { name: "Remove At your place" }).getAttribute("href")!;
    expect(href).not.toContain("locationType");
    expect(href).toContain("paymentMode=hourly");

    // The clear-all keeps `q` — the typed term is the search bar's to clear.
    expect(screen.getByRole("link", { name: "Clear all" }).getAttribute("href")).toContain(
      "q=corte",
    );
  });

  it("offers no clear-all for a typed term alone, because the card does not narrow on it", async () => {
    await renderSidebar({ q: "corte" });
    expect(screen.queryByRole("link", { name: "Clear all" })).toBeNull();
    expect(screen.queryByText(/Active filters/)).toBeNull();
  });

  it("toggles an option off from itself", async () => {
    await renderSidebar({ locationType: "at_customer" });
    const option = screen.getByRole("link", { name: "At your place" });
    expect(option).toHaveAttribute("aria-pressed", "true");
    expect(option.getAttribute("href")).not.toContain("locationType");
  });

  it("says which language the language group means", async () => {
    await renderSidebar({});
    expect(
      screen.getByText("Which languages this listing is written in — not what the provider speaks."),
    ).toBeInTheDocument();
  });

  it("wears navy on the price form's OK, not the kit's default blue", async () => {
    await renderSidebar({});
    const ok = screen.getByRole("button", { name: "OK" });
    expect(ok.className).toContain("--color-navy-surface");
    expect(ok.className).not.toContain("--color-primary");
  });
});

describe("MobileServiceFilters", () => {
  it("counts the filters it can take off, and not the term the search bar owns", async () => {
    // The count sits on a control whose sheet has no box for the term: a
    // number that included `q` would put a "2" over a sheet offering one
    // thing the reader can act on, which is the bug the old badge had with
    // `city`. See R18 — the term is the search bar's to clear.
    await renderMobile({ q: "corte", city: "Maputo" });
    expect(screen.getByRole("button", { name: /^Filters/ })).toHaveTextContent("Filters · 1");
  });

  it("says nothing at all when nothing is narrowing the list", async () => {
    await renderMobile({});
    const control = screen.getByRole("button", { name: /^Filters/ });
    expect(control).toHaveTextContent("Filters");
    expect(control.textContent).not.toContain("·");
  });

  it("states the outcome on the sheet's button rather than saying 'Apply'", async () => {
    // A button that says "Apply" makes a reader tap it to find out what they
    // did; one that counts tells them before they commit, so they can loosen
    // a filter instead of narrowing to nothing.
    await renderMobile({ locationType: "at_customer" }, 38);
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));

    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByRole("button", { name: "Show 38 results" })).toBeInTheDocument();
    // And the sheet offers the same rows the pills do, with the chosen one
    // already marked — one definition, two placements.
    expect(within(sheet).getByRole("link", { name: "At your place" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
