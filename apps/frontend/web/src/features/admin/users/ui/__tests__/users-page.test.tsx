import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { AdminUser } from "../../domain/types";
import { AdminUsersPage } from "../users-page";

const rows: AdminUser[] = [
  {
    id: "u-2", email: "ana.sitoe@exemplo.co.mz", name: "Ana Sitoe", role: "customer",
    status: "active", phoneNumber: "84 123 4567", providerCount: 1, createdAt: "2026-09-14T08:00:00.000Z",
  },
];

/** Every input the page asked the list for, in order. */
const asked = vi.hoisted(() => [] as unknown[]);

vi.mock("@/features/admin/users/data/admin-user.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/users/data/admin-user.repository")>();
  return {
    ...actual,
    adminUserQueries: {
      ...actual.adminUserQueries,
      page: (input: Parameters<typeof actual.adminUserQueries.page>[0]) => ({
        ...actual.adminUserQueries.page(input),
        queryFn: async () => {
          asked.push(input);
          return { items: rows, hasMore: false };
        },
      }),
    },
  };
});

async function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users", component: AdminUsersPage }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users/$userId", component: () => <p>detail</p> }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/admin/users"] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("AdminUsersPage", () => {
  it("links each person's name, and its View profile, to their page", async () => {
    await renderPage();

    const links = await screen.findAllByRole("link", { name: "Ana Sitoe" });
    expect(links[0]).toHaveAttribute("href", "/admin/users/u-2");
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/admin/users/u-2");
    expect(table.getByText("84 123 4567")).toBeInTheDocument();
    expect(table.getByText("Customer")).toBeInTheDocument();
  });

  it("asks the server for one role when its tab is chosen", async () => {
    await renderPage();
    await screen.findAllByRole("link", { name: "Ana Sitoe" });

    await userEvent.click(screen.getByRole("tab", { name: "Administrators" }));

    await waitFor(() => expect(asked).toContainEqual({ role: "admin", offset: 0 }));
    expect(screen.getByRole("tab", { name: "Administrators" })).toHaveAttribute("aria-selected", "true");
  });
});
