import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

/**
 * The real route: who is sent where before the page draws anything.
 * The page itself is stubbed; its states are `verify-phone.test.tsx`'s.
 */
const fakes = vi.hoisted(() => ({
  session: null as { user: { phoneNumber?: string | null; phoneNumberVerified?: boolean | null } } | null,
}));

vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: { getSession: async () => ({ data: fakes.session }) },
}));
vi.mock("@/features/auth/components/verify-phone", () => ({
  VerifyPhone: ({ next }: { next?: string }) => <p>verify page next={next ?? "none"}</p>,
}));

const { Route: VerifyPhoneRoute } = await import("../verify-phone");

async function visit(url: string) {
  const root = createRootRoute();
  (VerifyPhoneRoute as unknown as { update: (options: unknown) => void }).update({
    id: "/verify-phone",
    path: "/verify-phone",
    getParentRoute: () => root,
  });
  const stubs = ["/sign-in", "/account", "/bookings"].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => <p>at {path}</p> }),
  );
  const router = createRouter({
    routeTree: root.addChildren([VerifyPhoneRoute as never, ...stubs]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

beforeEach(() => {
  fakes.session = null;
});

describe("/verify-phone", () => {
  it("sends a signed-out visitor to sign in", async () => {
    const router = await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("at /sign-in")).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ next: "/bookings" });
  });

  it("as an invite, skips straight on for an account with no number", async () => {
    fakes.session = { user: { phoneNumber: null } };
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("at /bookings")).toBeInTheDocument();
  });

  it("as an invite, skips straight on for a number already confirmed", async () => {
    fakes.session = { user: { phoneNumber: "+258879801517", phoneNumberVerified: true } };
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("at /bookings")).toBeInTheDocument();
  });

  it("as an invite, shows the page for a number still to confirm", async () => {
    fakes.session = { user: { phoneNumber: "+258879801517", phoneNumberVerified: false } };
    await visit("/verify-phone?next=%2Fbookings");
    expect(await screen.findByText("verify page next=/bookings")).toBeInTheDocument();
  });

  it("drops a `next` that leaves the site", async () => {
    fakes.session = { user: { phoneNumber: "+258879801517", phoneNumberVerified: false } };
    await visit("/verify-phone?next=%2F%2Fevil.example");
    expect(await screen.findByText("verify page next=none")).toBeInTheDocument();
  });

  it("from the account, sends someone with no number to add one", async () => {
    fakes.session = { user: { phoneNumber: null } };
    await visit("/verify-phone");
    await waitFor(() => expect(screen.getByText("at /account")).toBeInTheDocument());
  });
});
