import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { ContactRequestAdminDTO } from "@ntizo/shared/read-models";
import { AdminContactPage } from "../contact-page";

const fakes = vi.hoisted(() => ({ setStatus: vi.fn() }));
vi.mock("@/features/admin/contact/data/admin-contact.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/contact/data/admin-contact.repository")>();
  return { ...actual, setContactRequestStatus: fakes.setStatus };
});

function row(over: Partial<ContactRequestAdminDTO> = {}): ContactRequestAdminDTO {
  return {
    id: "7f3a2c9e-1b2d-4e5f-8a9b-0c1d2e3f4a5b", reference: "7F3A2C", kind: "contact", topic: "partnership",
    name: "Joana Matola", email: "joana@exemplo.com", message: "Gostava de propor uma parceria com a minha escola.",
    requesterUserId: "u-1", locale: "pt-MZ", originPath: null, ipAddress: "197.218.0.1", userAgent: "Mozilla/5.0",
    status: "open", resolvedAt: null, createdAt: "2026-09-02T10:00:00.000Z", ...over,
  };
}

// `await router.load()` before `render()`: this router commits its first
// match through an async transition, matching the idiom in
// `src/features/landing/ui/__tests__/footer.test.tsx`.
async function renderPage(items: ContactRequestAdminDTO[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The default search: first page, open only. Seeded so no fetch happens.
  qc.setQueryData(["admin", "contact", { offset: 0, status: "open" }], { items, total: items.length, openCount: items.length });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/", component: AdminContactPage }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users", component: () => <p>users</p> }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return qc;
}

/** The inbox list on the left — every request once. */
function inbox() {
  return within(screen.getByRole("list", { name: "Contact" }));
}

/** The open request on the right, named by its topic. */
function detail(topic: string) {
  return within(screen.getByRole("region", { name: topic }));
}

beforeEach(() => fakes.setStatus.mockReset().mockResolvedValue(undefined));

describe("AdminContactPage", () => {
  it("lists a request with who wrote and about what, and opens the first one", async () => {
    await renderPage([row()]);
    expect(inbox().getByText("Joana Matola")).toBeInTheDocument();
    expect(inbox().getByText("Partnership")).toBeInTheDocument();

    const open = detail("Partnership");
    expect(open.getByText("joana@exemplo.com")).toBeInTheDocument();
    expect(open.getByText("#7F3A2C")).toBeInTheDocument();
    expect(open.getByText("Gostava de propor uma parceria com a minha escola.")).toBeInTheDocument();
  });

  it("opens the request that is chosen in the list", async () => {
    await renderPage([row(), row({ id: "r-2", reference: "9B8C7D", name: "Rui Tembe", topic: "press" })]);
    await userEvent.click(inbox().getByRole("button", { name: /Rui Tembe/ }));
    expect(detail("Press").getByText("#9B8C7D")).toBeInTheDocument();
    expect(inbox().getByRole("button", { name: /Rui Tembe/ })).toHaveAttribute("aria-current", "true");
  });

  it("picks the status from the tabs, and asks for resolved requests as a different list", async () => {
    const qc = await renderPage([row()]);
    const tabs = within(screen.getByRole("tablist"));
    expect(tabs.getByRole("tab", { name: /^Open/ })).toHaveAttribute("aria-selected", "true");

    await userEvent.click(tabs.getByRole("tab", { name: /^Resolved/ }));

    expect(qc.getQueryData(["admin", "contact", { offset: 0, status: "resolved" }])).toBeUndefined();
    expect(tabs.getByRole("tab", { name: /^Resolved/ })).toHaveAttribute("aria-selected", "true");
    // The tab is not a filter the button counts: it says so itself.
    expect(within(screen.getByRole("button", { name: /^filter/i })).queryByText("1")).toBeNull();
  });

  it("keeps only the kind in the panel, and clearing it leaves the tab alone", async () => {
    await renderPage([row()]);
    const tabs = within(screen.getByRole("tablist"));
    await userEvent.click(tabs.getByRole("tab", { name: /^Resolved/ }));

    await userEvent.click(screen.getByRole("button", { name: /^filter/i }));
    const panel = screen.getByRole("dialog", { name: "Filter requests" });
    expect(within(panel).queryByRole("button", { name: "Status" })).toBeNull();
    await userEvent.click(within(panel).getByRole("button", { name: "Kind" }));
    await userEvent.click(within(panel).getByRole("option", { name: "Feedback" }));
    expect(within(screen.getByRole("button", { name: /^filter/i })).getByText("1")).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Clear filters" }));
    expect(within(screen.getByRole("button", { name: /^filter/i })).queryByText("1")).toBeNull();
    expect(tabs.getByRole("tab", { name: /^Resolved/ })).toHaveAttribute("aria-selected", "true");
  });

  it("offers a reply by email with the reference in the subject", async () => {
    await renderPage([row()]);
    expect(detail("Partnership").getByRole("link", { name: /^reply$/i })).toHaveAttribute(
      "href",
      "mailto:joana@exemplo.com?subject=%5BNtizo%20%237F3A2C%5D%20Partnership",
    );
  });

  it("marks a request resolved and refetches the queue", async () => {
    const qc = await renderPage([row()]);
    const spy = vi.spyOn(qc, "invalidateQueries");
    await userEvent.click(detail("Partnership").getByRole("button", { name: /mark as resolved/i }));
    await waitFor(() => expect(fakes.setStatus).toHaveBeenCalledWith("7f3a2c9e-1b2d-4e5f-8a9b-0c1d2e3f4a5b", "resolved"));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["admin", "contact"] }));
  });

  it("offers to reopen a resolved request", async () => {
    await renderPage([row({ status: "resolved", resolvedAt: "2026-09-03T10:00:00.000Z" })]);
    await userEvent.click(detail("Partnership").getByRole("button", { name: /reopen/i }));
    await waitFor(() => expect(fakes.setStatus).toHaveBeenCalledWith("7f3a2c9e-1b2d-4e5f-8a9b-0c1d2e3f4a5b", "open"));
  });

  it("says the queue is empty in words", async () => {
    await renderPage([]);
    expect(screen.getByText("Nothing to answer.")).toBeInTheDocument();
  });

  it("shows where a message came from, and its technical details on request", async () => {
    await renderPage([row({ kind: "feedback", topic: "problem", originPath: "/services/abc" })]);
    const open = detail("Something did not work");
    await userEvent.click(open.getByRole("button", { name: /show details/i }));
    expect(open.getAllByText(/\/services\/abc/).length).toBeGreaterThan(0);
    expect(open.getByText("197.218.0.1")).toBeInTheDocument();
  });
});
