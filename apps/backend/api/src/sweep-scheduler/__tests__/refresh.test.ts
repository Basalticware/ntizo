import { describe, expect, it, spyOn } from "bun:test";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { refreshSweepSchedule, sweepSchedulerOf } from "../refresh";
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
    await expect(refreshSweepSchedule(namespace, async () => at)).resolves.toBe(true);
    expect(calls).toEqual([{ name: SWEEP_SCHEDULER_NAME, url: WAKE_URL, body: { at: at.getTime() } }]);
  });

  it("says nothing when nothing is due", async () => {
    const { namespace, calls } = fakeNamespace();
    await expect(refreshSweepSchedule(namespace, async () => null)).resolves.toBe(true);
    expect(calls).toEqual([]);
  });

  it("does not even ask the database when there is no scheduler binding", async () => {
    let asked = false;
    await expect(
      refreshSweepSchedule(undefined, async () => {
        asked = true;
        return new Date();
      }),
    ).resolves.toBe(false);
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
      ).resolves.toBe(false);
      expect(logged.mock.calls[0]![0]).toBe("[sweep-scheduler] refresh failed");
    } finally {
      logged.mockRestore();
    }
  });

  it("logs a refused wake", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const { namespace } = fakeNamespace(400);
      await expect(refreshSweepSchedule(namespace, async () => new Date())).resolves.toBe(false);
      expect(logged.mock.calls[0]![0]).toBe("[sweep-scheduler] wake refused");
    } finally {
      logged.mockRestore();
    }
  });
});

describe("sweepSchedulerOf", () => {
  const { namespace } = fakeNamespace();

  it("hands over the scheduler when the stage enables it", () => {
    expect(sweepSchedulerOf({ SWEEP_SCHEDULER: namespace, SWEEP_SCHEDULER_ENABLED: "true" })).toBe(namespace);
  });

  it("hands over nothing unless the flag is exactly \"true\" — a local `wrangler dev` leaves it absent", () => {
    expect(sweepSchedulerOf({ SWEEP_SCHEDULER: namespace })).toBeUndefined();
    expect(sweepSchedulerOf({ SWEEP_SCHEDULER: namespace, SWEEP_SCHEDULER_ENABLED: "false" })).toBeUndefined();
    expect(sweepSchedulerOf({ SWEEP_SCHEDULER: namespace, SWEEP_SCHEDULER_ENABLED: "TRUE" })).toBeUndefined();
  });
});
