import { describe, expect, it } from "bun:test";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { SweepScheduler } from "../sweep-scheduler.do";
import { WAKE_URL } from "../schedule";
import type { AppBindings } from "../../types";

function build(alarm: number | null = null) {
  const storage = {
    alarm,
    async getAlarm() {
      return this.alarm;
    },
    async setAlarm(at: number) {
      this.alarm = at;
    },
  };
  const state = { storage, waitUntil() {} } as unknown as DurableObjectState;
  return { scheduler: new SweepScheduler(state, {} as AppBindings), storage };
}

const post = (body: string) => new Request(WAKE_URL, { method: "POST", body });

describe("SweepScheduler.fetch", () => {
  it("sets its alarm from a wake request", async () => {
    const { scheduler, storage } = build();
    const at = Date.now() + 120_000;
    const response = await scheduler.fetch(post(JSON.stringify({ at })));
    expect(response.status).toBe(204);
    expect(storage.alarm).toBe(at);
  });

  it("refuses a wake without a usable time", async () => {
    const { scheduler, storage } = build();
    expect((await scheduler.fetch(post("{}"))).status).toBe(400);
    expect((await scheduler.fetch(post("not json"))).status).toBe(400);
    expect(storage.alarm).toBeNull();
  });

  it("answers anything else with 404", async () => {
    const { scheduler } = build();
    expect((await scheduler.fetch(new Request(WAKE_URL))).status).toBe(404);
    expect((await scheduler.fetch(new Request("https://sweep-scheduler/other", { method: "POST" }))).status).toBe(404);
  });
});
