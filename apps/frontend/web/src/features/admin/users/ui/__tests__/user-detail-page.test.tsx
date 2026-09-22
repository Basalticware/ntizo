import { afterEach, describe, expect, it, vi } from "vitest";
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
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";
import type { AdminUserDetail } from "../../domain/types";
import { AdminUserDetailPage } from "../user-detail-page";

const fakes = vi.hoisted(() => ({
  detail: null as unknown as AdminUserDetail,
  // Set for the one test that needs the read itself to fail. Checked ahead of
  // `detail` in the queryFn below, so a test never has to remember to clear
  // the fixture it isn't using.
  detailError: null as unknown,
  setRole: vi.fn(),
}));

vi.mock("@/features/admin/users/data/admin-user.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/users/data/admin-user.repository")>();
  return {
    ...actual,
    setPlatformRole: fakes.setRole,
    adminUserQueries: {
      ...actual.adminUserQueries,
      // Real options, fake fetch: every read, including the refetch after a
      // change, answers with whatever `fakes.detail` holds at that moment —
      // or rejects with `fakes.detailError`, when a test set one.
      detail: (userId: string) => ({
        ...actual.adminUserQueries.detail(userId),
        queryFn: async () => {
          if (fakes.detailError) throw fakes.detailError;
          return fakes.detail;
        },
      }),
    },
  };
});

afterEach(() => {
  fakes.setRole.mockReset();
  fakes.detailError = null;
});

const base: AdminUserDetail = {
  id: "u-2", email: "ana.sitoe@exemplo.co.mz", name: "Ana Sitoe", avatarUrl: null,
  role: "customer", status: "active", phoneNumber: "+258845550142",
  emailVerified: true, phoneVerified: false, language: "pt-MZ",
  createdAt: "2026-09-14T08:00:00.000Z",
  workspaces: [
    {
      providerId: "p-1", name: "Estúdio Mavalane", slug: "estudio-mavalane", logoUrl: null,
      providerStatus: "active", memberRole: "staff", joinedAt: "2026-09-03T08:00:00.000Z",
    },
  ],
  roleChange: { to: "admin", blockedReason: null },
};

async function renderRouter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users/$userId", component: AdminUserDetailPage }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users", component: () => <p>users</p> }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/providers/$providerId", component: () => <p>provider</p> }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/admin/users/u-2"] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function renderPage(detail: Partial<AdminUserDetail> = {}) {
  fakes.detail = { ...base, ...detail };
  await renderRouter();
  await screen.findByRole("heading", { name: "Ana Sitoe" });
}

/** For the one path with nothing to render but the error: the read itself fails. */
async function renderFailedPage(error: unknown) {
  fakes.detailError = error;
  await renderRouter();
  await screen.findByText("This user no longer exists.");
}

describe("AdminUserDetailPage", () => {
  it("shows who this is, with both verification states", async () => {
    await renderPage();
    expect(screen.getAllByText("ana.sitoe@exemplo.co.mz").length).toBeGreaterThan(0);
    expect(screen.getByText("verified")).toBeInTheDocument();
    expect(screen.getByText("not verified")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Português (Moçambique)")).toBeInTheDocument();
    expect(screen.getByText("u-2")).toBeInTheDocument();
  });

  it("asks before granting, and grants only on confirm", async () => {
    const user = userEvent.setup();
    fakes.setRole.mockResolvedValue(undefined);
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Make admin" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Give Ana Sitoe admin access?")).toBeInTheDocument();
    expect(fakes.setRole).not.toHaveBeenCalled();

    fakes.detail = { ...base, role: "admin", roleChange: { to: "customer", blockedReason: null } };
    await user.click(within(dialog).getByRole("button", { name: "Give access" }));

    expect(fakes.setRole).toHaveBeenCalledWith("u-2", "admin");
    expect(await screen.findByRole("button", { name: "Remove admin" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes admin from another admin, through its own dialog", async () => {
    const user = userEvent.setup();
    fakes.setRole.mockResolvedValue(undefined);
    await renderPage({ role: "admin", roleChange: { to: "customer", blockedReason: null } });

    await user.click(screen.getByRole("button", { name: "Remove admin" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Remove Ana Sitoe's admin access?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove access" }));

    expect(fakes.setRole).toHaveBeenCalledWith("u-2", "customer");
  });

  it("offers nothing on your own account, and says why", async () => {
    await renderPage({ roleChange: { to: null, blockedReason: "self" } });
    expect(screen.queryByRole("button", { name: /admin/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("This is your account. Only another administrator can change your role."),
    ).toBeInTheDocument();
  });

  it("keeps a refusal inside the dialog, with Close as the only way on", async () => {
    const user = userEvent.setup();
    fakes.setRole.mockRejectedValue(
      new GraphqlError(200, [
        { message: "no", extensions: { code: "FORBIDDEN", originalCode: "ADMIN_ONLY" } },
      ]),
    );
    await renderPage({ role: "admin", roleChange: { to: "customer", blockedReason: null } });

    await user.click(screen.getByRole("button", { name: "Remove admin" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove access" }));

    expect(
      await within(dialog).findByText(/another administrator removed it in the meantime/i),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Remove access" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("lists the workspaces, each opening its admin page", async () => {
    await renderPage();
    const link = screen.getByRole("link", { name: /Estúdio Mavalane/ });
    expect(link).toHaveAttribute("href", "/admin/providers/p-1");
    expect(within(link).getByText(/Staff · member since/)).toBeInTheDocument();
  });

  it("says so when there are no workspaces", async () => {
    await renderPage({ workspaces: [] });
    expect(screen.getByText("Doesn't belong to any workspace.")).toBeInTheDocument();
  });

  it("shows only the back link and the error when the user no longer exists", async () => {
    await renderFailedPage(
      new GraphqlError(200, [
        { message: "no", extensions: { code: "NOT_FOUND", originalCode: "USER_NOT_FOUND" } },
      ]),
    );

    expect(screen.getByText("This user no longer exists.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /admin/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Doesn't belong to any workspace.")).not.toBeInTheDocument();
  });
});
