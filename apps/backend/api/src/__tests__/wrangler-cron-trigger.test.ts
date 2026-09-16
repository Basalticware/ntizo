import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Nothing else in this codebase reads `wrangler.jsonc`.
 *
 * `scheduled.ts` (the sweep that raises unread-message notifications, see
 * `scheduled.test.ts`) only ever runs because Cloudflare calls it on a cron
 * — and that cron exists solely as the `triggers.crons` array declared per
 * environment in this file. Delete `"triggers": { "crons": [...] }` from
 * every environment and `tsc`, `eslint`, and every other test in this repo
 * stay green: nothing imports or type-checks against this JSONC config, so
 * nothing else notices the sweep would silently never run again. The same
 * shape as the eight-handlers-mounted-nowhere failure this project already
 * shipped once (see `event-handler-registration.test.ts`'s doc comment) —
 * one config file over, where no compiler and no other test can see it.
 *
 * `r2_buckets` is a documented example of the same non-inheritance:
 * `wrangler.jsonc`'s own comment says a named `env` that omits a block gets
 * none of it, not the top-level one — `triggers` is exactly that kind of
 * block, which is why this asserts each of the three deployed environments
 * individually rather than checking once at the top level.
 *
 * `stripJsonComments` is a small, deliberately conservative hand-rolled
 * parser rather than a dependency added for one test: `wrangler.jsonc` has
 * comments AND string values that themselves contain `//` (every
 * `MEDIA_PUBLIC_URL_BASE`/`APP_URL` is an `http://` or `https://` URL), so a
 * naive `line.replace(/\/\/.*$/, "")` would truncate those values instead of
 * skipping real comments — this tracks whether it is inside a string before
 * treating `//` or `/*` as the start of a comment.
 */
function stripJsonComments(text: string): string {
  let result = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        result += c;
      }
      continue;
    }
    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      result += c;
      if (c === "\\") {
        result += next;
        i++;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }

    if (c === '"') {
      inString = true;
      result += c;
      continue;
    }
    if (c === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    result += c;
  }

  return result;
}

interface WranglerConfig {
  durable_objects?: { bindings?: { name: string; class_name: string }[] };
  migrations?: { tag: string; new_sqlite_classes?: string[] }[];
  env?: Record<
    string,
    {
      triggers?: { crons?: string[] };
      durable_objects?: { bindings?: { name: string; class_name: string }[] };
    }
  >;
}

const raw = readFileSync(join(import.meta.dir, "..", "..", "wrangler.jsonc"), "utf8");
const config = JSON.parse(stripJsonComments(raw)) as WranglerConfig;

describe("wrangler.jsonc: the unread-message sweep's cron trigger", () => {
  // Every deployed environment, not just one — `triggers`, like `r2_buckets`,
  // is NOT inherited from the top level in wrangler, so each named `env`
  // needs its own block or it silently gets none.
  for (const envName of ["dev", "qa", "prod"] as const) {
    it(`declares at least one cron for env.${envName}`, () => {
      const crons = config.env?.[envName]?.triggers?.crons;
      expect(Array.isArray(crons)).toBe(true);
      expect(crons?.length).toBeGreaterThan(0);
    });
  }

  it("sweeps at least hourly in every environment — the safety net under the sweep scheduler", () => {
    // The 2-minute notice window no longer depends on the cron: the sweep
    // scheduler's alarm wakes the sweeps when something is due. A per-minute
    // cron kept Neon's compute awake around the clock and exhausted its free
    // allowance in about 16 days.
    for (const envName of ["dev", "qa", "prod"] as const) {
      const crons = config.env?.[envName]?.triggers?.crons ?? [];
      expect(crons).toContain("0 * * * *");
      expect(crons).not.toContain("* * * * *");
    }
  });
});

describe("wrangler.jsonc: the sweep scheduler", () => {
  const binding = { name: "SWEEP_SCHEDULER", class_name: "SweepScheduler" };

  // Durable Object bindings, like `triggers`, are not inherited from the top
  // level: an env without its own block has no scheduler, and its deadlines
  // would wait for the hourly cron.
  for (const envName of ["dev", "qa", "prod"] as const) {
    it(`binds SWEEP_SCHEDULER in env.${envName}`, () => {
      expect(config.env?.[envName]?.durable_objects?.bindings ?? []).toContainEqual(binding);
    });
  }

  it("binds it for local `wrangler dev` too", () => {
    expect(config.durable_objects?.bindings ?? []).toContainEqual(binding);
  });

  it("creates the class on the SQLite backend — the only one on the Workers Free plan", () => {
    const created = (config.migrations ?? []).flatMap((m) => m.new_sqlite_classes ?? []);
    expect(created).toContain("SweepScheduler");
  });
});
