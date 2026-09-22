import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { AdminUser } from "../../domain/types";
import { AdminUsersPage } from "../users-page";

const rows: AdminUser[] = [
  {
    id: "u-2", email: "ana.sitoe@exemplo.co.mz", name: "Ana Sitoe", role: "customer",
    status: "active", phoneNumber: null, providerCount: 1, createdAt: "2026-09-14T08:00:00.000Z",
  },
];

vi.mock("@/features/admin/users/data/admin-user.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/users/data/admin-user.repository")>();
  return {
    ...actual,
    adminUserQueries: {
      ...actual.adminUserQueries,
      all: (input: Parameters<typeof actual.adminUserQueries.all>[0]) => ({
        ...actual.adminUserQueries.all(input),
        queryFn: async () => rows,
      }),
    },
  };
});

describe("AdminUsersPage", () => {
  it("links each person's name to their page", async () => {
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

    const links = await screen.findAllByRole("link", { name: "Ana Sitoe" });
    expect(links[0]).toHaveAttribute("href", "/admin/users/u-2");
  });
});
