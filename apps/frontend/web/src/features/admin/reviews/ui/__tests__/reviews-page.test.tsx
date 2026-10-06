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
import type { ReviewAdminDTO } from "@ntizo/shared/read-models";
import { AdminReviewsPage } from "../reviews-page";

function row(over: Partial<ReviewAdminDTO> = {}): ReviewAdminDTO {
  return {
    id: "r-1", providerId: "p-1", providerName: "Salão Polana", providerSlug: "salao-polana",
    rating: 5, comment: "Excelente atendimento.", authorName: "Ana Silva", status: "published",
    featuredAt: null, createdAt: "2026-09-03T10:00:00.000Z", ...over,
  };
}

function renderPage(items: ReviewAdminDTO[], featuredCount = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The default search — first page, everything — seeded so no fetch happens.
  qc.setQueryData(["admin", "reviews", { offset: 0 }], { items, total: items.length, featuredCount });
  // A router, because the panel links to the provider's file — registered so
  // the link resolves rather than type-checking against nothing.
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/reviews", component: AdminReviewsPage }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/providers/$providerId", component: () => <p>provider</p> }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/admin/reviews"] }),
  });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return qc;
}

const table = async () => within(await screen.findByRole("table"));

describe("AdminReviewsPage", () => {
  it("lists a review with who wrote it, about whom, and what they said", async () => {
    renderPage([row()]);
    const t = await table();
    expect(t.getByText("Ana Silva")).toBeInTheDocument();
    expect(t.getByText("Salão Polana")).toBeInTheDocument();
    expect(t.getByText("Excelente atendimento.")).toBeInTheDocument();
    expect(t.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
  });

  it("asks for the home page's reviews as a different list from its tab", async () => {
    const user = userEvent.setup();
    const qc = renderPage([row()], 2);
    await table();
    const tabs = screen.getByRole("tablist", { name: "Reviews" });
    // The featured count is always on the payload, so its chip can say it.
    expect(within(tabs).getByRole("tab", { name: /On the home page\s*2/ })).toBeInTheDocument();

    await user.click(within(tabs).getByRole("tab", { name: /On the home page/ }));
    // A different key, unseeded — the page must ask for it rather than show
    // the unfiltered list under a new label.
    expect(qc.getQueryCache().find({ queryKey: ["admin", "reviews", { offset: 0, featuredOnly: true }] })).toBeDefined();
  });

  it("opens the review in full beside the list, with the home-page toggle", async () => {
    const user = userEvent.setup();
    renderPage([row({ comment: "Excelente atendimento.\nVoltarei." })], 1);
    const t = await table();
    expect(screen.queryByRole("complementary", { name: "Review details" })).not.toBeInTheDocument();

    await user.click(t.getByRole("button", { name: "View details" }));
    const panel = screen.getByRole("complementary", { name: "Review details" });
    expect(within(panel).getByText(/Voltarei\./)).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Salão Polana/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /Show on the home page/ })).toBeEnabled();

    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Review details" })).not.toBeInTheDocument();
  });

  it("refuses the toggle for a review with no words, and says why", async () => {
    const user = userEvent.setup();
    renderPage([row({ comment: null })]);
    await user.click((await table()).getByRole("button", { name: "View details" }));
    const panel = screen.getByRole("complementary", { name: "Review details" });
    expect(within(panel).getByRole("button", { name: /Show on the home page/ })).toBeDisabled();
  });
});
