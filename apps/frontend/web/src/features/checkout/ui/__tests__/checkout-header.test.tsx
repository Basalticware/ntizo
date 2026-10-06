import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/shared/lib/i18n";
import { CheckoutHeader } from "../checkout-header";
import type { CheckoutStep } from "../checkout-steps";

/**
 * The top of every checkout page, on its own: the site's header, then the way
 * back and the steps.
 *
 * A `QueryClient` because the site header reads the session and the service
 * cities; left unseeded, both settle on nothing — nobody signed in, no cities
 * menu — which is all these tests need.
 */
async function renderHeader(current: CheckoutStep, back?: React.ReactNode) {
  const root = createRootRoute({
    component: () => <CheckoutHeader current={current} back={back} />,
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("pt-MZ");
});

afterEach(async () => {
  await i18n.changeLanguage("en-US");
});

describe("CheckoutHeader", () => {
  it("carries the steps, so the page body does not have to", async () => {
    await renderHeader("details");

    const steps = await screen.findByRole("navigation", { name: "Etapas da reserva" });
    expect(steps).toBeInTheDocument();
    expect(screen.getByText("Passo 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("Detalhes")).toHaveAttribute("aria-current", "step");
  });

  it("names the three real steps, and no payment step the flow does not have", async () => {
    await renderHeader("when");

    expect(await screen.findByText("Data e hora")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Detalhes")).toBeInTheDocument();
    expect(screen.queryByText("Pagamento")).not.toBeInTheDocument();
  });

  it("keeps the logo as a way home", async () => {
    await renderHeader("when");

    expect(await screen.findByRole("link", { name: "Ntizo" })).toHaveAttribute("href", "/");
  });

  /**
   * The October 2026 mockups put the public header over the checkout, so the
   * site's own destinations are here — superseding the stripped bar that kept
   * a customer with a slot on hold from wandering off. A hold that lapses is
   * already handled: step 1 says so and offers the time again.
   */
  it("wears the site's header, destinations and all", async () => {
    await renderHeader("when");

    for (const name of [/^explorar$/i, /^serviços$/i, /^prestadores$/i]) {
      expect(await screen.findByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("puts the page's way back beside the steps", async () => {
    await renderHeader("when", <a href="/services/s1">Voltar</a>);

    expect(await screen.findByRole("link", { name: "Voltar" })).toHaveAttribute("href", "/services/s1");
  });
});
