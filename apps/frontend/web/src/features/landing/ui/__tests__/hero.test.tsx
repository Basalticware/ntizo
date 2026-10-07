import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Hero } from "../hero";

async function renderHero() {
  const rootRoute = createRootRoute();
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{path}</p> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <Hero /> }),
      ...["/sign-in", "/sign-up", "/services", "/providers", "/become-provider"].map(stub),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await router.load();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("Hero", () => {
  it("leads with the offer rather than a slogan", async () => {
    await renderHero();
    expect(
      await screen.findByRole("heading", { level: 1, name: /at the price you see/i }),
    ).toBeInTheDocument();
  });

  // The mockup's third claim was "Pagamento seguro", which suggests money
  // held for the customer. Nothing on the platform does that.
  it("makes three promises the platform can keep today", async () => {
    await renderHero();
    expect(screen.getByText(/Price set\s+before you book/)).toBeInTheDocument();
    expect(screen.getByText(/Verified\s+providers/)).toBeInTheDocument();
    expect(screen.getByText(/Pay\s+with M-Pesa/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/secure payment|protected/i);
  });

  /**
   * On the home page the search is the hero's big bar, not the header's: the
   * October 2026 mockup draws the header without a field here, so there is
   * still exactly one search box in the first screenful.
   */
  it("asks for a service in the hero, and only there", async () => {
    await renderHero();

    const boxes = screen.getAllByRole("searchbox");
    expect(boxes).toHaveLength(1);
    expect(screen.getByRole("banner")).not.toContainElement(boxes[0]!);
    expect(screen.getByRole("search")).toContainElement(boxes[0]!);
  });

  it("sends a search to the services list with the term", async () => {
    const user = userEvent.setup();
    const router = await renderHero();
    await user.type(screen.getByRole("searchbox"), "canalizador");
    await user.click(within(screen.getByRole("search")).getByRole("button"));
    expect(router.state.location.pathname).toBe("/services");
    expect(router.state.location.search).toMatchObject({ q: "canalizador" });
  });

  /**
   * The home page's header opens no door for a provider, and that is the
   * decision, not an omission: the footer's Company column and the navy band
   * are the provider's doors on this page.
   */
  it("leaves the provider's door to the footer and the band", async () => {
    await renderHero();

    const inHeader = within(screen.getByRole("banner"))
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/become-provider");
    expect(inHeader).toHaveLength(0);
  });

  it("sets the offer on the home's own photograph", async () => {
    await renderHero();
    expect(screen.getByTestId("hero-photo")).toHaveAttribute("src", "/images/home-hero.jpg");
  });

  /**
   * The quote panel sits beside the search only from `xl`; below that it
   * would land on top of the bar. jsdom does no layout, so the class is the
   * assertion — it stays in the document, as a `display` decision.
   */
  it("keeps the quote panel to wide screens, as text in the reader's language", async () => {
    await renderHero();
    const quote = screen.getByTestId("hero-quote");
    expect(quote).toHaveTextContent(/real people/i);
    expect(quote.className.split(/\s+/)).toContain("hidden");
    expect(quote.className).toContain("xl:block");
  });
});
