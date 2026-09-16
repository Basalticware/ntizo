import { describe, expect, it, spyOn } from "bun:test";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { refreshSweepSchedule } from "../refresh";
import { SWEEP_SCHEDULER_NAME, WAKE_URL } from "../schedule";

function fakeNamespace(status = 204) {
  const calls: { name: string; url: string; body: unknown }[] = [];
  const namespace = {
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => ({
      fetch: async (url: string, init: { body: string }) => {
        calls.push({ name: id.name, url, body: JSON.parse(init.body) });
        return new Response(null, { status });
      },
    }),
  } as unknown as DurableObjectNamespace;
  return { namespace, calls };
}

describe("refreshSweepSchedule", () => {
  it("tells the one scheduler when the sweeps next have work", async () => {
    const { namespace, calls } = fakeNamespace();
    const at = new Date("2026-09-16T12:02:00.000Z");
    await refreshSweepSchedule(namespace, async () => at);
    expect(calls).toEqual([{ name: SWEEP_SCHEDULER_NAME, url: WAKE_URL, body: { at: at.getTime() } }]);
  });

  it("says nothing when nothing is due", async () => {
    const { namespace, calls } = fakeNamespace();
    await refreshSweepSchedule(namespace, async () => null);
    expect(calls).toEqual([]);
  });

  it("does not even ask the database when there is no scheduler binding", async () => {
    let asked = false;
    await refreshSweepSchedule(undefined, async () => {
      asked = true;
      return new Date();
    });
    expect(asked).toBe(false);
  });

  it("logs and resolves, never rejects, when working out the time fails", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const { namespace } = fakeNamespace();
      await expect(
        refreshSweepSchedule(namespace, async () => {
          throw new Error("db down");
        }),
      ).resolves.toBeUndefined();
      expect(logged.mock.calls[0]![0]).toBe("[sweep-scheduler] refresh failed");
    } finally {
      logged.mockRestore();
    }
  });

  it("logs a refused wake", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const { namespace } = fakeNamespace(400);
      await refreshSweepSchedule(namespace, async () => new Date());
      expect(logged.mock.calls[0]![0]).toBe("[sweep-scheduler] wake refused");
    } finally {
      logged.mockRestore();
    }
  });
});
