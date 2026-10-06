import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlatformActivityEntryDTO } from "@ntizo/shared/read-models";
import { AdminActivityPage } from "../admin-activity-page";

function entry(over: Partial<PlatformActivityEntryDTO> = {}): PlatformActivityEntryDTO {
  return {
    id: "a-1", type: "provider.status.decided", payload: { providerName: "Salão Polana", to: "active" },
    occurredAt: "2026-09-03T10:00:00.000Z", actorUserId: "u-1", actorName: "Ana Silva", actorEmail: "ana@ntizo.co.mz",
    ...over,
  };
}

function renderPage(items: PlatformActivityEntryDTO[], nextCursor: string | null = null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["activity", "all", {}], { pages: [{ items, nextCursor }], pageParams: [undefined] });
  render(
    <QueryClientProvider client={qc}>
      <AdminActivityPage />
    </QueryClientProvider>,
  );
  return qc;
}

const timeline = () => within(screen.getByRole("region", { name: "Timeline" }));

describe("AdminActivityPage", () => {
  it("lists what happened, as a sentence, with who did it under it, the kind and the time", () => {
    renderPage([entry()]);
    const t = timeline();
    expect(t.getByText("Ana Silva · ana@ntizo.co.mz")).toBeInTheDocument();
    // The outcome, not the bare "reviewed": `to` picks the context key.
    expect(t.getByText("Approved Salão Polana")).toBeInTheDocument();
    expect(t.getByText("Provider decided")).toBeInTheDocument();
    // Under its day, with the time beside it.
    expect(t.getByRole("heading", { level: 3, name: /Sep 3 2026/ })).toBeInTheDocument();
    expect(t.getByText(/\d{1,2}:00/)).toBeInTheDocument();
  });

  it("groups events under the day they happened, newest first", () => {
    renderPage([
      entry({ id: "a-1", occurredAt: "2026-09-03T10:00:00.000Z" }),
      entry({ id: "a-2", occurredAt: "2026-09-03T08:00:00.000Z" }),
      entry({ id: "a-3", occurredAt: "2026-09-01T10:00:00.000Z" }),
    ]);
    const days = timeline().getAllByRole("heading", { level: 3 });
    expect(days).toHaveLength(2);
    expect(days[0]).toHaveTextContent("Sep 3 2026");
    expect(days[1]).toHaveTextContent("Sep 1 2026");
  });

  it("names a departed actor by a dash rather than an empty line", () => {
    renderPage([entry({ actorName: "", actorEmail: null })]);
    expect(timeline().getByText("—", { selector: "p" })).toBeInTheDocument();
  });

  it("does not claim a total it cannot know while another page remains", () => {
    renderPage([entry()], "2026-09-03T10:00:00.000Z|a-1");
    expect(screen.getByText("1 shown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("picks one kind in the row above the timeline, and asks for it as a different list", async () => {
    const user = userEvent.setup();
    const qc = renderPage([entry()]);
    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(screen.getByRole("option", { name: "Review posted" }));

    expect(qc.getQueryCache().find({ queryKey: ["activity", "all", { type: "review.created" }] })).toBeDefined();
  });

  it("searches on the server", async () => {
    const user = userEvent.setup();
    const qc = renderPage([entry()]);
    await user.type(screen.getByPlaceholderText("Search a name, a service or an email"), "Polana");
    expect(qc.getQueryCache().find({ queryKey: ["activity", "all", { search: "Polana" }] })).toBeDefined();
  });
});
