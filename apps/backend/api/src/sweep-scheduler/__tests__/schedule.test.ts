import { describe, expect, it, spyOn } from "bun:test";
import {
  handleAlarm,
  MIN_ALARM_GAP_MS,
  RECOMPUTE_FAILURE_RETRY_MS,
  shouldRefreshAfterRequest,
  wakeAt,
  type AlarmStorage,
} from "../schedule";

class FakeStorage implements AlarmStorage {
  constructor(public alarm: number | null = null) {}
  sets: number[] = [];
  async getAlarm() {
    return this.alarm;
  }
  async setAlarm(at: number) {
    this.alarm = at;
    this.sets.push(at);
  }
}

const NOW = Date.parse("2026-09-16T12:00:00.000Z");

describe("wakeAt", () => {
  it("sets an alarm when there is none", async () => {
    const storage = new FakeStorage();
    await wakeAt(storage, NOW + 120_000, NOW);
    expect(storage.alarm).toBe(NOW + 120_000);
  });

  it("brings an alarm forward when the new time is earlier", async () => {
    const storage = new FakeStorage(NOW + 3_600_000);
    await wakeAt(storage, NOW + 120_000, NOW);
    expect(storage.alarm).toBe(NOW + 120_000);
  });

  it("never pushes an alarm later — a missed early alarm is the only real failure", async () => {
    const storage = new FakeStorage(NOW + 120_000);
    await wakeAt(storage, NOW + 3_600_000, NOW);
    expect(storage.alarm).toBe(NOW + 120_000);
    expect(storage.sets).toEqual([]);
  });

  it("wakes now for a time already past", async () => {
    const storage = new FakeStorage();
    await wakeAt(storage, NOW - 60_000, NOW);
    expect(storage.alarm).toBe(NOW);
  });
});

describe("handleAlarm", () => {
  it("runs the sweeps, then sets the alarm to the next due time", async () => {
    const storage = new FakeStorage();
    const order: string[] = [];
    await handleAlarm({
      storage,
      runSweeps: async () => void order.push("sweeps"),
      nextDueAt: async () => {
        order.push("next");
        return new Date(NOW + 600_000);
      },
      now: () => NOW,
    });
    expect(order).toEqual(["sweeps", "next"]);
    expect(storage.alarm).toBe(NOW + 600_000);
  });

  it("sets no alarm when nothing is due", async () => {
    const storage = new FakeStorage();
    await handleAlarm({ storage, runSweeps: async () => {}, nextDueAt: async () => null, now: () => NOW });
    expect(storage.sets).toEqual([]);
  });

  it("floors a next time already past, so a failing row cannot spin the alarm", async () => {
    const storage = new FakeStorage();
    await handleAlarm({
      storage,
      runSweeps: async () => {},
      nextDueAt: async () => new Date(NOW - 1),
      now: () => NOW,
    });
    expect(storage.alarm).toBe(NOW + MIN_ALARM_GAP_MS);
  });

  it("keeps an earlier alarm a request set while the sweeps were running", async () => {
    const storage = new FakeStorage();
    await handleAlarm({
      storage,
      runSweeps: async () => {
        await wakeAt(storage, NOW + 60_000, NOW);
      },
      nextDueAt: async () => new Date(NOW + 600_000),
      now: () => NOW,
    });
    expect(storage.alarm).toBe(NOW + 60_000);
  });

  it("replaces the alarm that just fired, even if the platform still reports it", async () => {
    const storage = new FakeStorage(NOW - 5);
    await handleAlarm({
      storage,
      runSweeps: async () => {},
      nextDueAt: async () => new Date(NOW + 600_000),
      now: () => NOW,
    });
    expect(storage.alarm).toBe(NOW + 600_000);
  });

  it("still reschedules when the sweeps throw", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const storage = new FakeStorage();
      await handleAlarm({
        storage,
        runSweeps: async () => {
          throw new Error("boom");
        },
        nextDueAt: async () => new Date(NOW + 600_000),
        now: () => NOW,
      });
      expect(storage.alarm).toBe(NOW + 600_000);
    } finally {
      logged.mockRestore();
    }
  });

  it("backs off, rather than giving up, when the next due time cannot be worked out", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const storage = new FakeStorage();
      await handleAlarm({
        storage,
        runSweeps: async () => {},
        nextDueAt: async () => {
          throw new Error("compute limit reached");
        },
        now: () => NOW,
      });
      expect(storage.alarm).toBe(NOW + RECOMPUTE_FAILURE_RETRY_MS);
      expect(logged).toHaveBeenCalled();
    } finally {
      logged.mockRestore();
    }
  });
});

describe("shouldRefreshAfterRequest", () => {
  it("refreshes after a POST that touched the database", () => {
    expect(shouldRefreshAfterRequest("POST", true)).toBe(true);
  });

  it("does not refresh after a read or a request that never opened a connection", () => {
    expect(shouldRefreshAfterRequest("GET", true)).toBe(false);
    expect(shouldRefreshAfterRequest("POST", false)).toBe(false);
    expect(shouldRefreshAfterRequest("OPTIONS", false)).toBe(false);
  });
});
