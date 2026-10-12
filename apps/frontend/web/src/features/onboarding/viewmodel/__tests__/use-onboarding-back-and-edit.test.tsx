import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ProviderType } from "@ntizo/shared";

const created: unknown[] = [];
const updated: Array<{ id: string; body: unknown }> = [];

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));
vi.mock("@/features/provider/viewmodel/use-provider-mutations", () => ({
  useCreateProvider: () => ({
    isPending: false,
    mutateAsync: async (body: unknown) => {
      created.push(body);
      return { providerId: "p-created" };
    },
  }),
  useUpdateProvider: (id: string) => ({
    isPending: false,
    mutateAsync: async (body: unknown) => {
      updated.push({ id, body });
      return {};
    },
  }),
}));
vi.mock("@/features/provider/viewmodel/use-active-provider", () => ({
  useActiveProvider: () => ({
    setActive: () => {},
    refresh: async () => {},
    activeProvider: null,
  }),
}));
vi.mock("@/features/provider/viewmodel/use-document-upload", () => ({
  useDocumentUpload: () => ({ send: async () => null, busy: false, errorKey: null }),
}));

const { useOnboarding } = await import("../use-onboarding");

const COMPLETE = {
  type: ProviderType.Individual,
  name: "Amélia Borges",
  country: "MZ",
  city: "Maputo",
};

beforeEach(() => {
  created.length = 0;
  updated.length = 0;
  sessionStorage.clear();
});

describe("useOnboarding — going back after the workspace exists", () => {
  it("saves the edit onto the workspace it made instead of making another", async () => {
    // The tester's report (2026-10-12): back from Fotografias to fix the
    // name, Continuar — and the wizard ran creation again. The second press
    // on Localização made a second workspace and the first kept the old name.
    const { result } = renderHook(() => useOnboarding());

    await act(async () => result.current.patch(COMPLETE));
    for (let i = 0; i < 3; i++) await act(async () => result.current.advance());
    expect(result.current.step).toBe("media");
    expect(created).toHaveLength(1);

    await act(async () => result.current.back());
    await act(async () => result.current.back());
    expect(result.current.step).toBe("identity");

    await act(async () => result.current.patch({ name: "Amélia Borges Limpezas" }));
    await act(async () => result.current.advance());
    await act(async () => result.current.advance());

    expect(result.current.step).toBe("media");
    expect(created).toHaveLength(1);
    expect(updated).toHaveLength(1);
    expect(updated[0]!.id).toBe("p-created");
    expect(updated[0]!.body).toMatchObject({
      name: "Amélia Borges Limpezas",
      address: { country: "MZ", city: "Maputo" },
    });
  });

  it("remembers the workspace across a reload of the wizard", async () => {
    // The draft outlives the page; the fact that it was already submitted has
    // to outlive it with it, or a refresh on Fotografias re-arms creation.
    const first = renderHook(() => useOnboarding());
    await act(async () => first.result.current.patch(COMPLETE));
    for (let i = 0; i < 3; i++) await act(async () => first.result.current.advance());
    first.unmount();

    const second = renderHook(() => useOnboarding());
    await act(async () => second.result.current.setStep("location"));
    await act(async () => second.result.current.advance());

    expect(created).toHaveLength(1);
    expect(updated).toHaveLength(1);
  });
});
