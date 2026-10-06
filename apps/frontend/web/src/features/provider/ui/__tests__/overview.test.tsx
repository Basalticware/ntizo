import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import type { ProviderBookingDTO } from "@ntizo/shared/read-models";
import i18n from "@/shared/lib/i18n";
import { PageHeaderContext, type PageHeaderState } from "@/shared/lib/page-header";
import { PROVIDER_TABS, type ProviderTab } from "../../bookings/domain/status";
import { OverviewPage } from "../overview";

/**
 * Every query, one seam: the wire.
 *
 * The page reads the person, the stats, the next bookings, the services (for
 * their photos), the conversations, the wallet and the availability over
 * `sessionGraphql`, and the workspace's public rating over `publicGraphql`,
 * so both transports are stood in for and each answers by the operation name
 * in the query it is handed. Mocking the hooks instead would assert nothing
 * about the query keys, the `enabled` guards or the shapes the repositories
 * unwrap — and `vi.mock` names a module rather than importing one, so no
 * `ui -> data` edge is created and the boundaries policy is untouched.
 *
 * `importOriginal` on the session transport rather than a bare factory:
 * `messagingErrorCode` — which `useProviderThreads` calls on every render —
 * does `instanceof GraphqlError`, and a mock missing that export throws the
 * moment it is read.
 */
const fakes = vi.hoisted(() => ({ session: vi.fn(), publik: vi.fn() }));

vi.mock("@/shared/lib/graphql/session-graphql", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/graphql/session-graphql")>()),
  sessionGraphql: fakes.session,
}));

vi.mock("@/shared/lib/graphql/public-graphql", () => ({
  publicGraphql: fakes.publik,
}));

vi.mock("@/features/provider/viewmodel/use-active-provider", () => ({
  useActiveProvider: () => ({
    providers: [],
    activeProvider: {
      id: "prov-1",
      slug: "estudio",
      name: "Estúdio Mavalane",
      type: "organization",
      status: "active",
      role: "owner",
    },
    setActive: () => {},
    loading: false,
    error: null,
    refresh: () => {},
  }),
}));

/**
 * The same validator the real bookings route carries, duplicated rather than
 * imported: `src/routes/**` is the `routes` element and a `ui` file may not
 * import one, test files included.
 */
function validateSearch(search: Record<string, unknown>): { tab?: ProviderTab } {
  const tab = search["tab"];
  return {
    tab:
      typeof tab === "string" && (PROVIDER_TABS as readonly string[]).includes(tab)
        ? (tab as ProviderTab)
        : undefined,
  };
}

const STATS = {
  awaitingResponse: 3,
  awaitingPayment: 1,
  upcomingToday: 2,
  upcomingWeek: 5,
  completedLast30: 9,
  declinedLast30: 1,
  revenueLast30Minor: 1_240_000,
  pipelineMinor: 630_000,
  currency: "MZN",
  perDay: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    requests: 0,
    confirmed: 0,
  })),
};

/**
 * An upcoming booking. `CONFIRMED`, not `AWAITING_PROVIDER`: the awaiting
 * badge reads "Por responder", and a row carrying it would make every
 * assertion about the "por responder" card ambiguous.
 */
function bookingFixture(over: Partial<ProviderBookingDTO> = {}): ProviderBookingDTO {
  return {
    id: "bk-1",
    status: "CONFIRMED",
    createdAt: "2026-09-02T08:00:00.000Z",
    serviceId: "svc-1",
    serviceOptionId: "opt-1",
    serviceName: "Corte de cabelo",
    optionName: "Corte",
    durationMinutes: 60,
    locationType: "at_provider",
    providerMemberId: "mem-1",
    memberFirstName: "Célia",
    customerFirstName: "Ana",
    startsAt: "2026-10-11T08:00:00.000Z",
    endsAt: "2026-10-11T09:00:00.000Z",
    timezone: "Africa/Maputo",
    addressDistrict: "Polana",
    addressCity: "Maputo",
    priceMinor: 80000,
    commissionBps: 1000,
    commissionMinor: 8000,
    currency: "MZN",
    respondBy: null,
    ...over,
  };
}

const THREADS = [
  {
    id: "t1",
    type: "inquiry",
    providerId: "prov-1",
    providerName: "Estúdio Mavalane",
    customerName: "Sílvia Nhampossa",
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: "Olá! O serviço ainda está disponível?",
    lastMessageHasAttachment: false,
    unreadCount: 2,
    support: null,
  },
  {
    id: "t2",
    type: "inquiry",
    providerId: "prov-1",
    providerName: "Estúdio Mavalane",
    customerName: "Tomás Guambe",
    lastMessageAt: "2026-09-01T09:00:00.000Z",
    lastMessagePreview: "Obrigado pelo serviço!",
    lastMessageHasAttachment: false,
    unreadCount: 0,
    support: null,
  },
];

const REVIEWS = {
  summary: {
    average: 4.8,
    count: 12,
    histogram: { one: 0, two: 0, three: 1, four: 2, five: 9 },
  },
  reviews: [],
};

/** Every day of the week 08:00–18:00, so "today" has hours whatever day the suite runs on. */
const AVAILABILITY = {
  providerId: "prov-1",
  timezone: "Africa/Maputo",
  members: [
    {
      memberId: "mem-1",
      userId: "u-1",
      name: "Célia",
      role: "owner",
      weekly: Array.from({ length: 7 }, (_, weekday) => ({
        id: `r${weekday}`,
        weekday,
        startMinute: 480,
        endMinute: 1080,
        bufferMinutes: null,
        slotIntervalMinutes: null,
        capacity: null,
      })),
      exceptions: [],
    },
  ],
  closures: [],
};

const WALLET = {
  wallet: { currency: "MZN", availableMinor: 1_860_000, pendingMinor: 520_000 },
  entries: [],
  nextOffset: null,
};

/**
 * Mirrors how `ProviderShell` supplies the header context — two `useState`
 * and a value assembled inline — so the page's own heading is asserted where
 * a reader actually meets it.
 */
function Shell({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderState>({ title: "" });
  const [action, setAction] = useState<ReactNode>(null);
  return (
    <PageHeaderContext.Provider value={{ header, setHeader, action, setAction }}>
      <div data-testid="shell-title">{header.ownHeading ? "" : header.title}</div>
      {children}
    </PageHeaderContext.Provider>
  );
}

function renderOverview({
  statsFails = false,
  availabilityFails = false,
  stats = STATS,
  reviews = REVIEWS,
  me = { id: "u-1", firstName: "Joaquim" } as Record<string, unknown> | null,
}: {
  statsFails?: boolean;
  availabilityFails?: boolean;
  stats?: typeof STATS;
  reviews?: typeof REVIEWS;
  me?: Record<string, unknown> | null;
} = {}) {
  fakes.session.mockReset();
  fakes.publik.mockReset();
  fakes.session.mockImplementation(async (query: string) => {
    if (query.includes("UserMe")) return { userMe: me };
    if (query.includes("BookingStatsForProvider")) {
      if (statsFails) throw new Error("the numbers are unreachable");
      return { bookingStatsForProvider: stats };
    }
    if (query.includes("BookingForProvider")) {
      return {
        bookingForProvider: {
          items: [
            bookingFixture(),
            bookingFixture({ id: "bk-2", customerFirstName: "Bruno", serviceName: "Manicure" }),
          ],
          total: 2,
          nextOffset: null,
          members: [{ id: "mem-1", firstName: "Célia" }],
        },
      };
    }
    if (query.includes("ServiceMine")) return { serviceMine: [] };
    if (query.includes("ProviderThreads")) {
      return { communicationProviderThreads: { items: THREADS, nextCursor: null } };
    }
    if (query.includes("WalletForProvider")) return { walletForProvider: WALLET };
    if (query.includes("AvailabilityConfig")) {
      if (availabilityFails) throw new Error("not yours to read");
      return { availabilityConfig: AVAILABILITY };
    }
    return {};
  });
  fakes.publik.mockImplementation(async (query: string) => {
    if (query.includes("ProviderReviews")) return { reviewByProvider: reviews };
    return {};
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const page = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{path}</p> });
  /**
   * Every destination the page links to is registered, so an `href` is the
   * router's own answer rather than a string this file wrote down.
   */
  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/provider/$slug/overview",
      component: () => (
        <Shell>
          <OverviewPage />
        </Shell>
      ),
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/provider/$slug/bookings",
      validateSearch,
      component: () => <p>bookings</p>,
    }),
    page("/provider/$slug/bookings/$bookingId"),
    page("/provider/$slug/activity"),
    page("/provider/$slug/availability"),
    page("/provider/$slug/wallet"),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/provider/$slug/messages",
      validateSearch: (s: Record<string, unknown>) => (typeof s["thread"] === "string" ? { thread: s["thread"] } : {}),
      component: () => <p>messages</p>,
    }),
    page("/providers/$slug"),
  ];
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/provider/estudio/overview"] }),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** The number in the "por responder" card appears only once the stats are in. */
async function waitForStats() {
  await screen.findByText(String(STATS.awaitingResponse));
}

/** A stat card: the label's parent holds the value and the foot. */
const card = (label: string) => within(screen.getByText(label).parentElement!);

beforeEach(async () => {
  await i18n.changeLanguage("pt-MZ");
});

afterEach(async () => {
  await i18n.changeLanguage("en-US");
});

describe("OverviewPage", () => {
  it("greets the person by their first name, under the page's own eyebrow", async () => {
    renderOverview();

    expect(await screen.findByRole("heading", { level: 1, name: "Olá, Joaquim!" })).toBeInTheDocument();
    expect(screen.getByText("Visão geral")).toBeInTheDocument();
    // The page draws its own heading, so the shell prints none above it.
    expect(screen.getByTestId("shell-title")).toHaveTextContent("");
  });

  it("falls back to the workspace's name before the person has loaded", async () => {
    renderOverview({ me: null });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Olá, Estúdio Mavalane!" }),
    ).toBeInTheDocument();
  });

  it("links to the activity log, which left the menu", async () => {
    renderOverview();

    expect(await screen.findByRole("link", { name: "Ver actividade recente" })).toHaveAttribute(
      "href",
      "/provider/estudio/activity",
    );
  });

  it("gives the requests waiting a number and a verb", async () => {
    renderOverview();
    await waitForStats();

    expect(card("Pedidos por responder").getByRole("link", { name: "Responder" })).toHaveAttribute(
      "href",
      "/provider/estudio/bookings?tab=requests",
    );
  });

  it("gives no verb to the readings that are not tasks", async () => {
    renderOverview();
    await waitForStats();

    expect(card("Reservas (7 dias)").queryByRole("link")).toBeNull();
    expect(card("Receita (30 dias)").queryByRole("link")).toBeNull();
  });

  it("shows the week with today inside it", async () => {
    renderOverview();
    await waitForStats();

    expect(card("Reservas (7 dias)").getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2 hoje")).toBeInTheDocument();
  });

  it("shows the provider's share and what is still to come, never a month-over-month delta", async () => {
    renderOverview();
    await waitForStats();

    const revenue = card("Receita (30 dias)");
    // 1 240 000 minor units, already net of commission.
    expect(revenue.getByText(/12[\s.]?400/)).toBeInTheDocument();
    expect(revenue.getByText(/\+ 6[\s.]?300/)).toBeInTheDocument();
    expect(revenue.getByText("Já descontada a comissão.")).toBeInTheDocument();
    expect(screen.queryByText(/mês anterior/)).toBeNull();
  });

  /**
   * Controller ruling R10. Nothing writes `COMPLETED` yet, so every workspace
   * reads a zero here today, and "already net of commission" over a zero
   * explains a deduction that never happened.
   */
  it("says why the revenue is zero when nothing has been completed", async () => {
    renderOverview({ stats: { ...STATS, completedLast30: 0, revenueLast30Minor: 0 } });

    expect(await screen.findByText("Ainda nada concluído nos últimos 30 dias.")).toBeInTheDocument();
    expect(screen.queryByText("Já descontada a comissão.")).toBeNull();
    expect(screen.getByText(/\+ 6[\s.]?300/)).toBeInTheDocument(); // still the pipeline
  });

  it("shows the public rating and links to where it is written", async () => {
    renderOverview();

    expect(await screen.findByText("4,8")).toBeInTheDocument();
    expect(screen.getByText("12 avaliações")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver avaliações" })).toHaveAttribute("href", "/providers/estudio");
  });

  it("reads one review in the singular", async () => {
    renderOverview({
      reviews: { summary: { average: 5, count: 1, histogram: { one: 0, two: 0, three: 0, four: 0, five: 1 } }, reviews: [] },
    });

    expect(await screen.findByText("1 avaliação")).toBeInTheDocument();
  });

  it("lists the next bookings, each with its way in", async () => {
    renderOverview();

    const section = (await screen.findByRole("heading", { name: "Próximas reservas" })).closest("section")!;
    expect(await within(section).findByText("Corte de cabelo")).toBeInTheDocument();
    expect(within(section).getByText("Bruno")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Corte de cabelo" })).toHaveAttribute(
      "href",
      "/provider/estudio/bookings/bk-1",
    );
    expect(within(section).getByRole("link", { name: "Ver todas" })).toHaveAttribute(
      "href",
      "/provider/estudio/bookings?tab=upcoming",
    );
  });

  /**
   * What the list *is*, not merely that it rendered: the transport answers
   * any `BookingForProvider`, so asking for every tab, or a page of twenty,
   * would leave every assertion above green.
   */
  it("asks for the next four on the calendar", async () => {
    renderOverview();
    await screen.findAllByText("Corte de cabelo");

    const call = fakes.session.mock.calls.find((c) => String(c[0]).includes("BookingForProvider"));
    expect(call?.[1]).toMatchObject({ input: { providerId: "prov-1", tab: "upcoming", limit: 4, offset: 0 } });
  });

  it("says when the business can be booked today, with the way to block a period", async () => {
    renderOverview();

    const section = (await screen.findByRole("heading", { name: "Disponibilidade de hoje" })).closest("section")!;
    expect(within(section).getByText("Disponível")).toBeInTheDocument();
    expect(within(section).getByText("08:00 – 18:00")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Bloquear período" })).toHaveAttribute(
      "href",
      "/provider/estudio/availability",
    );
  });

  it("draws no availability card for someone who cannot read the configuration", async () => {
    renderOverview({ availabilityFails: true });
    await screen.findByRole("heading", { name: "Mensagens" });

    expect(screen.queryByRole("heading", { name: "Disponibilidade de hoje" })).toBeNull();
  });

  it("shows the newest conversations, with a dot on the unread", async () => {
    renderOverview();

    const section = (await screen.findByRole("heading", { name: "Mensagens" })).closest("section")!;
    expect(await within(section).findByText("Sílvia Nhampossa")).toBeInTheDocument();
    expect(within(section).getByText("Tomás Guambe")).toBeInTheDocument();
    expect(within(section).getByLabelText("2 por ler")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /Sílvia Nhampossa/ })).toHaveAttribute(
      "href",
      "/provider/estudio/messages?thread=t1",
    );
  });

  it("shows the balance that can be taken out, and no withdrawal button that leads nowhere", async () => {
    renderOverview();

    const section = (await screen.findByRole("heading", { name: "Saldo na carteira" })).closest("section")!;
    expect(await within(section).findByText(/18[\s.]?600/)).toBeInTheDocument();
    expect(within(section).queryByText(/Levantar/)).toBeNull();
    expect(within(section).getByRole("link", { name: "Ver carteira" })).toHaveAttribute(
      "href",
      "/provider/estudio/wallet",
    );
  });

  it("says so when the numbers cannot be read, and offers to ask again", async () => {
    renderOverview({ statsFails: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);

    const asked = () =>
      fakes.session.mock.calls.filter((call) => String(call[0]).includes("BookingStatsForProvider")).length;
    const before = asked();
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(asked()).toBeGreaterThan(before);
  });
});
