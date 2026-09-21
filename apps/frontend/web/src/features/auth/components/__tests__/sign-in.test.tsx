import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

/**
 * Signing in, and where it puts somebody afterwards.
 *
 * Only `authClient` and the two session reads behind
 * `resolveDestinationForSession` are replaced — the destination rule itself
 * (`isSafeInternalPath`, then role, then ownership) runs for real, because
 * the thing under test is the whole chain from a `next` in the URL to a
 * location the router actually resolved.
 */
const fakes = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  clearSessionQueryCache: vi.fn(),
}));

vi.mock("@/shared/lib/api/auth-client", () => ({
  authClient: {
    signIn: { email: fakes.signInEmail, social: vi.fn() },
    sendVerificationEmail: fakes.sendVerificationEmail,
  },
  API_BASE_URL: "",
  AUTH_API_URL_FALLBACK: "http://localhost:8788",
}));

vi.mock("@/features/user/viewmodel/use-current-user", () => ({
  useClearSessionQueryCache: () => fakes.clearSessionQueryCache,
  fetchCurrentUser: async () => ({ role: "customer" }),
}));

vi.mock("@/features/provider/viewmodel/use-providers", () => ({
  countMyProviders: async () => 0,
}));

const { SignIn } = await import("../sign-in");

function renderSignIn(next: string) {
  const rootRoute = createRootRoute();
  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    validateSearch: (search: Record<string, unknown>) => search as { next?: string },
    component: SignIn,
  });
  const bookRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/book/$serviceId",
    validateSearch: (search: Record<string, unknown>) =>
      search as { memberId?: string; startsAt?: string },
    component: () => <p>choose when</p>,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>home</p>,
  });
  const forgotRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/forgot-password",
    component: () => <p>forgot</p>,
  });
  const signUpRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-up",
    component: () => <p>sign up</p>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      signInRoute,
      bookRoute,
      forgotRoute,
      signUpRoute,
    ]),
    history: createMemoryHistory({
      initialEntries: [`/sign-in?next=${encodeURIComponent(next)}`],
    }),
  });

  render(<RouterProvider router={router} />);
  return { router };
}

describe("SignIn", () => {
  it("returns a customer to the exact slot they were sending themselves back to", async () => {
    // Checkout's step 1 keeps the chosen slot in its own URL, which only
    // works if `next` survives sign-in with its search parameters attached:
    // a customer who picks a time, signs in, and comes back to an empty grid
    // has been asked to decide twice.
    //
    // Nothing else in this app has ever put a query string in `next` — every
    // other caller sends a bare pathname — so until now this was an untested
    // property that `SignIn` happened to have. It is checkout's whole reason
    // for putting the slot in the URL, so it is pinned here rather than left
    // to be rediscovered.
    fakes.signInEmail.mockResolvedValue({ error: null });
    const target = "/book/svc-1?memberId=mem-1&startsAt=2026-09-04T09:00:00.000Z";
    const { router } = renderSignIn(target);

    await userEvent.type(await screen.findByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/book/svc-1"));
    expect(router.state.location.search).toEqual({
      memberId: "mem-1",
      startsAt: "2026-09-04T09:00:00.000Z",
    });
  });

  it("tells an unverified account to confirm its email, and sends a new link when asked", async () => {
    // A QA tester registered, never opened the link, and read "Something went
    // wrong" on every sign-in with the right password. The account was fine;
    // nothing said the one thing left to do, or offered a way to do it once
    // the first link had expired.
    fakes.signInEmail.mockResolvedValue({
      error: { code: "EMAIL_NOT_VERIFIED", status: 403, message: "Email not verified" },
    });
    fakes.sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
    const { router } = renderSignIn("/");

    await userEvent.type(await screen.findByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText(/hasn't been confirmed yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resend confirmation email" }));

    expect(await screen.findByText("We sent a new link to ana@example.com.")).toBeInTheDocument();
    // Absolute and pointing at this app: better-auth resolves a relative one
    // against the API origin, and the link would land on its JSON root.
    expect(fakes.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@example.com",
        callbackURL: `${window.location.origin}/verify-phone?next=%2F`,
      }),
    );
    expect(router.state.location.pathname).toBe("/sign-in");
  });

  it("offers no new link for a wrong password", async () => {
    fakes.signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401, message: "Invalid email or password" },
    });
    renderSignIn("/");

    await userEvent.type(await screen.findByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("That email or password is not right.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend confirmation email" })).toBeNull();
  });
});
