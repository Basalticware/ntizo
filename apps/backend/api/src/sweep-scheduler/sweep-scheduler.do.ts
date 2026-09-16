import type { DurableObjectState } from "@cloudflare/workers-types";
import { infraStore } from "@ntizo/backend/shared/infra";
import { Db } from "@ntizo/backend/shared/infra/database";
import { toInfraEnv } from "../infra-env";
import type { AppBindings } from "../types";
import { computeNextDueAt } from "./next-due";
import { handleAlarm, WAKE_URL, wakeAt } from "./schedule";
import { runSweeps } from "./sweeps";

const WAKE_PATH = new URL(WAKE_URL).pathname;

/**
 * One alarm per environment, set to when the sweeps next have work.
 *
 * Replaces "look every minute": a per-minute cron kept Neon's compute awake
 * around the clock (6 CU-hours a day against 100 a month) to find nothing
 * most of the time. See docs/superpowers/specs/2026-09-16-sweep-scheduler-design.md.
 *
 * A legacy class — `fetch` plus `alarm`, no `extends DurableObject` — on
 * purpose. RPC would need `cloudflare:workers`, which bun's test runner cannot
 * resolve, and `src/index.ts` (which exports this class) is imported by the
 * test suite. The SQLite storage backend and alarms work the same either way;
 * a local spike confirmed it on 2026-09-16.
 */
export class SweepScheduler {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: AppBindings,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== WAKE_PATH) {
      return new Response("Not found", { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as { at?: unknown } | null;
    const at = body?.at;
    if (typeof at !== "number" || !Number.isFinite(at)) {
      return new Response("Bad request", { status: 400 });
    }
    await wakeAt(this.state.storage, at, Date.now());
    return new Response(null, { status: 204 });
  }

  /**
   * The same scope the cron opens, then the rules in `handleAlarm`. The
   * deferred work the sweeps start (notification emails) is awaited here
   * before the pool closes: unlike a cron's `ctx.waitUntil`, nothing keeps an
   * alarm's promises alive after this returns.
   */
  async alarm(): Promise<void> {
    await infraStore.runAsync(toInfraEnv(this.env), async () => {
      infraStore.setHyperdrive(
        (this.env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE,
      );
      infraStore.setWaitUntil((promise) => this.state.waitUntil(promise));
      try {
        await handleAlarm({
          storage: this.state.storage,
          runSweeps,
          nextDueAt: computeNextDueAt,
          now: () => Date.now(),
        });
      } finally {
        await infraStore.settleDeferredWork();
        await Db.closeDbConnection();
      }
    });
  }
}
