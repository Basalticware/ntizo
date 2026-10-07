import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import i18n from "i18next";
import type { ReactNode } from "react";
import type { CategoryDTO } from "@ntizo/shared/read-models";
import { HomeBanner } from "../home-banner";
import { TrustBand } from "../trust-band";
import { ProviderBand } from "../provider-band";
import { LANDING_CATEGORIES } from "../category-grid";

function category(over: Partial<CategoryDTO> = {}): CategoryDTO {
  return {
    id: over.code ?? "c",
    code: "plumbing",
    name: "Plumbing",
    description: null,
    imageUrl: null,
    icon: "Wrench",
    isFallback: false,
    ...over,
  };
}

async function renderWith(node: ReactNode, categories?: CategoryDTO[]) {
  const rootRoute = createRootRoute();
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{path}</p> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <>{node}</> }),
      ...["/services", "/become-provider"].map(stub),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (categories) {
    qc.setQueryData(
      ["categories", "preview", i18n.resolvedLanguage ?? i18n.language, LANDING_CATEGORIES],
      { items: categories, nextOffset: null },
    );
  }
  await router.load();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("HomeBanner", () => {
  it("opens the services that come to the customer, through the list's own filter", async () => {
    await renderWith(<HomeBanner />, []);
    expect(
      (await screen.findByRole("link", { name: /See home services/ })).getAttribute("href"),
    ).toBe("/services?locationType=at_customer");
  });

  it("names the household trades first, and tops up from the rest", async () => {
    await renderWith(<HomeBanner />, [
      category({ code: "mechanic", name: "Mechanic" }),
      category({ code: "cleaning", name: "Cleaning" }),
      category({ code: "electrical", name: "Electrical" }),
      category({ code: "music", name: "Music" }),
      category({ code: "cooking", name: "Cooking" }),
    ]);
    const list = await screen.findByRole("list");
    const names = within(list)
      .getAllByRole("link")
      .map((a) => a.querySelector("b")?.textContent);
    expect(names).toEqual(["Electrical", "Cleaning", "Mechanic", "Music"]);
  });

  it("prefers the category's own description to the home's hint", async () => {
    await renderWith(<HomeBanner />, [
      category({ code: "plumbing", description: "Leaks fixed today" }),
      category({ code: "electrical", name: "Electrical" }),
    ]);
    expect(await screen.findByText("Leaks fixed today")).toBeInTheDocument();
    expect(screen.getByText("Installations, faults and more")).toBeInTheDocument();
  });

  it("draws no rows when there are no categories", async () => {
    await renderWith(<HomeBanner />, []);
    await screen.findByRole("link", { name: /See home services/ });
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("TrustBand", () => {
  // The mockup said "Pagamento protegido", which reads as money held until
  // the job is done. Ntizo holds nothing; the copy says what does happen.
  it("promises nothing about holding the customer's money", async () => {
    await renderWith(<TrustBand />);
    expect(await screen.findByText("Pay with M-Pesa")).toBeInTheDocument();
    expect(
      screen.getByText("The payment request only arrives after the provider confirms the time."),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/protected|held|escrow/i);
  });
});

describe("ProviderBand", () => {
  it("offers both ways in to the provider's page", async () => {
    await renderWith(<ProviderBand />);
    expect(
      (await screen.findByRole("link", { name: "Become a provider" })).getAttribute("href"),
    ).toBe("/become-provider");
    expect(screen.getByRole("link", { name: /How it works/ })).toHaveAttribute(
      "href",
      "/become-provider",
    );
  });

  it("ticks only points the platform keeps, and invents no head count", async () => {
    await renderWith(<ProviderBand />);
    await screen.findByText("More customers");
    expect(screen.getByText("Payment by M-Pesa")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/secure payments|hundreds/i);
  });
});
