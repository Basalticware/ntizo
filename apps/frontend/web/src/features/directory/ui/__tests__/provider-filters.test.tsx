import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import type { DirectorySearch } from "@/features/directory/domain/directory-search";

/**
 * The same lightweight router stub `notification-bell-link.test.tsx` and
 * `service-row.test.tsx` use: every `<Link>` this component builds throws
 * outside a router, and there is nothing else here that needs one — `current`
 * is a plain prop, not a route search this harness has to parse.
 */
vi.mock("@/features/directory/viewmodel/use-directory", () => ({
  useProviderCities: () => [
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
const { MobileProviderFilters, ProviderSidebar } = await import("../provider-filters");

async function renderIn(node: ReactNode) {
  const root = createRootRoute({ component: () => <>{node}</> });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}

const renderSidebar = (current: DirectorySearch) => renderIn(<ProviderSidebar current={current} />);

const renderMobile = (current: DirectorySearch, total = 0) =>
  renderIn(<MobileProviderFilters current={current} total={total} />);

const groupsIn = (root: HTMLElement) => [...root.querySelectorAll("h3")].map((h) => h.textContent);

describe("ProviderSidebar", () => {
  it("draws only the groups the directory API applies, in the mockup's order", async () => {
    const { container } = await renderSidebar({});
    expect(screen.getByRole("heading", { level: 2, name: "Filters" })).toBeInTheDocument();
    // No "Responde rápido": nothing records how fast anybody answers.
    expect(groupsIn(container)).toEqual([
      "City",
      "Categories",
      "Minimum rating",
      "Price range",
      "Type of provider",
    ]);
    expect(screen.getByRole("link", { name: /Verified providers only/ })).toBeInTheDocument();
    // Every option applies as it is chosen, so there is nothing to apply.
    expect(screen.queryByRole("button", { name: /Apply/ })).toBeNull();
  });

  it("lists what is on as chips, each removing just itself, and the category by name", async () => {
    await renderSidebar({ category: "plumbing", city: "Maputo", minRating: 4, q: "mavalane" });
    expect(screen.getByText("Active filters (3)")).toBeInTheDocument();

    const category = screen.getByRole("link", { name: "Remove Canalização" });
    expect(category.getAttribute("href")).not.toContain("category");
    expect(category.getAttribute("href")).toContain("minRating=4");

    // The city chip says just the place, not "in Maputo".
    const city = screen.getByRole("link", { name: "Remove Maputo" });
    expect(city.getAttribute("href")).not.toContain("city");
    expect(city.getAttribute("href")).toContain("category=plumbing");

    // The clear-all keeps the term: it is the search bar's to clear.
    expect(screen.getByRole("link", { name: "Clear all" }).getAttribute("href")).toContain(
      "q=mavalane",
    );
  });

  it("shows no active box and no clear-all when nothing is narrowing", async () => {
    await renderSidebar({ q: "mavalane" });
    expect(screen.queryByText(/Active filters/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Clear all" })).toBeNull();
  });

  it("offers the API's rating floors as tiles, all first and lit when none is set", async () => {
    await renderSidebar({});
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    for (const score of ["3.0", "4.0", "4.5"]) {
      expect(screen.getByRole("link", { name: `${score} or more` })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("clears a rating floor from its own tile", async () => {
    await renderSidebar({ minRating: 4 });
    const tile = screen.getByRole("link", { name: "4.0 or more" });
    expect(tile).toHaveAttribute("aria-pressed", "true");
    expect(tile.getAttribute("href")).not.toContain("minRating");
  });

  it("turns verified on and off as a switch that is a link", async () => {
    const { unmount } = await renderSidebar({});
    const off = screen.getByRole("link", { name: /Verified providers only/ });
    expect(off).toHaveAttribute("aria-pressed", "false");
    expect(off.getAttribute("href")).toContain("verified=true");
    unmount();

    await renderSidebar({ verified: true, city: "Maputo" });
    const on = screen.getByRole("link", { name: /Verified providers only/ });
    expect(on).toHaveAttribute("aria-pressed", "true");
    // `verified: false` is never written — off is the parameter gone.
    expect(on.getAttribute("href")).not.toContain("verified");
    expect(on.getAttribute("href")).toContain("city=Maputo");
  });

  it("offers the two kinds of provider as tiles", async () => {
    await renderSidebar({ providerType: "individual" });
    expect(screen.getByRole("link", { name: /Person/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: /Business/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("leads the categories with All categories, then each by name", async () => {
    await renderSidebar({});
    expect(screen.getByRole("link", { name: "All categories" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("link", { name: "Canalização" })).toHaveAttribute("href", "/providers?category=plumbing");
  });

  it("wears navy on the price form's OK, not the kit's default blue", async () => {
    // The kit's default `Button` variant is the site's blue; this submit is
    // drawn twice, in the sidebar and in the sheet.
    await renderSidebar({});
    const ok = screen.getByRole("button", { name: "OK" });
    expect(ok.className).toContain("--color-navy-surface");
    expect(ok.className).not.toContain("--color-primary");
  });
});

describe("MobileProviderFilters", () => {
  it("counts the filters it can take off, and not the term the search bar owns", async () => {
    // See R18 — the term is the search bar's to clear.
    await renderMobile({ q: "mavalane", city: "Maputo" });
    expect(screen.getByRole("button", { name: /^Filters/ })).toHaveTextContent("Filters · 1");
  });

  it("says nothing at all when nothing is narrowing the list", async () => {
    await renderMobile({});
    const control = screen.getByRole("button", { name: /^Filters/ });
    expect(control).toHaveTextContent("Filters");
    expect(control.textContent).not.toContain("·");
  });

  it("states the outcome on the sheet's button and holds the sidebar's own groups", async () => {
    await renderMobile({ providerType: "individual" }, 38);
    fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));

    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByRole("button", { name: "Show 38 results" })).toBeInTheDocument();
    // One definition, two placements: the same groups as the sidebar.
    expect(groupsIn(sheet)).toEqual([
      "City",
      "Categories",
      "Minimum rating",
      "Price range",
      "Type of provider",
    ]);
    expect(within(sheet).getByRole("link", { name: /Person/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("counts a chosen category on the phone's own control", async () => {
    await renderMobile({ category: "plumbing" });
    expect(screen.getByRole("button", { name: /^Filters/ })).toHaveTextContent("Filters · 1");
  });
});
