# Admin User Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page at `/admin/users/$userId` that shows one person's identity and workspaces, and lets an administrator grant or remove platform admin access, with the change recorded in the activity feed.

**Architecture:**
- **Read side:** a new projection (`user.detailForAdmin`) that returns the person's facts plus a server-decided `roleChange`.
- **Write side:** a new user-BC command (`SetPlatformRoleCommand`). It runs in one transaction that locks every admin row and the target's row, writes both role columns, and publishes `user.role.changed` through the outbox. The Activity context turns that event into a history row.
- **Web:** the page reuses the provider detail page's skeleton. It has a confirm dialog, and the users list links each name to the new page.

**Tech Stack:**
- Bun, TypeScript, Drizzle on Postgres (Neon), `@cosmneo/onion-lasagna` GraphQL kit, zod;
- React, TanStack Router and Query, i18next;
- Vitest with Testing Library, bun:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-admin-user-detail-design.md` (mockup: `docs/superpowers/specs/2026-09-22-admin-user-detail.mockup.html`)

## Global Constraints

- Work only in the worktree `.claude/worktrees/admin-user-detail` (branch `feat/admin-user-detail`, based on `origin/dev` `d678b8ab`).
- **Never `git add -A` or `git commit -a`.** Stage each path by name; another session edits the main checkout.
- `ntizo_user.user.role` is the authoritative role. `better_auth.user.role` is only mirrored, and nothing authorizes against it.
- Only `"admin"` and `"customer"` are assignable. Removing admin sets `"customer"`.
- Nobody may change their own role (`CANNOT_CHANGE_OWN_ROLE`). There is no `LAST_ADMIN` code.
- Public error codes are exactly `ADMIN_ONLY`, `CANNOT_CHANGE_OWN_ROLE` and `USER_NOT_FOUND`.
- The detail page never shows bio, date of birth, gender or timezone.
- Copy is gender-neutral: "Dar acesso de administração a {{name}}", never "tornar administradora".
- Every new string goes into all 8 locales (`en-US`, `pt-MZ`, `pt-PT`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `nl-NL`). The parity test in `apps/frontend/web/src/shared/locales/__tests__/locales.test.ts` enforces identical key sets for `admin` and `account`.
- Wrangler needs Node 22: `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Domain (event, aggregate method, exceptions)

**Files:**
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/events/index.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/aggregates/user.aggregate.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/platform-role.exceptions.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/index.ts` (last line)
- Test: `packages/backend/src/modules/ntizo/bounded-contexts/user/domain/aggregates/__tests__/user.aggregate.test.ts`

**Interfaces:**
- Produces:
  - `User.changePlatformRole(to: UserRole, changedByUserId: string): boolean`;
  - the event class `UserPlatformRoleChanged`, with `eventName` `"user.role.changed"` and payload `{ userId, from, to, changedByUserId }`;
  - `UserNotFoundError(userId)`, code `USER_NOT_FOUND`;
  - `CannotChangeOwnRoleError()`, code `CANNOT_CHANGE_OWN_ROLE`;
  - `RequesterNotAdminError()`, code `ADMIN_ONLY`.

- [ ] **Step 0: Prepare the worktree (first task only)**

```bash
cd /Users/saliffaustino/Desktop/Salif/Projects/Ntizo/ntizo-workspace/.claude/worktrees/admin-user-detail
bun install
cp ../../../packages/backend/.env packages/backend/.env
git check-ignore -v packages/backend/.env   # must print a .gitignore rule
```

- [ ] **Step 1: Write the failing test** (append to `user.aggregate.test.ts`)

```ts
import type { UserRole } from "@ntizo/shared";

describe("User.changePlatformRole", () => {
  const existing = (role: UserRole) =>
    User.rehydrate({
      id: "u2",
      email: "b@ntizo.test",
      role,
      status: "active",
      verificationStatus: null,
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    });

  it("grants admin and records who did it", () => {
    const user = existing("customer");
    expect(user.changePlatformRole("admin", "u-admin")).toBe(true);
    expect(user.role).toBe("admin");
    const events = user.pullEvents();
    expect(events.map((e) => e.eventName)).toEqual(["user.role.changed"]);
    expect(events[0]!.aggregateId).toBe("u2");
    expect(events[0]!.payload).toEqual({
      userId: "u2",
      from: "customer",
      to: "admin",
      changedByUserId: "u-admin",
    });
  });

  it("removes admin back to customer", () => {
    const user = existing("admin");
    expect(user.changePlatformRole("customer", "u-admin")).toBe(true);
    expect(user.role).toBe("customer");
    expect((user.pullEvents()[0]!.payload as { from: string }).from).toBe("admin");
  });

  it("records nothing when the role is already the one asked for", () => {
    const user = existing("admin");
    expect(user.changePlatformRole("admin", "u-admin")).toBe(false);
    expect(user.pullEvents()).toHaveLength(0);
    expect(user.updatedAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
```

Put the `import type { UserRole }` line at the top of the file with the other imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/domain/aggregates/__tests__/user.aggregate.test.ts`
Expected: FAIL, because `changePlatformRole` is not a function.

- [ ] **Step 3: Add the event** (append to `domain/events/index.ts`)

```ts
import type { UserRole } from "@ntizo/shared";

/**
 * An administrator granted or removed platform administration.
 *
 * `changedByUserId` is on the event because the history row it becomes is
 * filed under the administrator who acted, not under the person changed.
 * `from` is carried so a consumer never has to guess what the role was.
 */
export class UserPlatformRoleChanged extends BaseDomainEvent<{
  userId: string;
  from: UserRole;
  to: UserRole;
  changedByUserId: string;
}> {
  constructor(payload: { userId: string; from: UserRole; to: UserRole; changedByUserId: string }) {
    super("user.role.changed", payload.userId, payload);
  }
}
```

Move the `import type { UserRole }` line up beside the existing `BaseDomainEvent` import.

- [ ] **Step 4: Add the aggregate method** in `user.aggregate.ts`

Change the events import to `import { UserPlatformRoleChanged, UserRegistered } from "../events";`, then add this method after `revertProviderUpgrade()`:

```ts
  /**
   * Grants or removes platform administration.
   *
   * Returns whether anything changed. Asking for the role somebody already
   * has records nothing, so a double-clicked confirm publishes one event, not
   * two. Who may ask is the command's rule, not this one's.
   */
  changePlatformRole(to: UserRole, changedByUserId: string): boolean {
    const from = this.props.role;
    if (from === to) return false;
    this.props.role = to;
    this.props.updatedAt = new Date();
    this.recordEvent(
      new UserPlatformRoleChanged({ userId: this.props.id, from, to, changedByUserId }),
    );
    return true;
  }
```

- [ ] **Step 5: Add the exceptions**

Create `domain/exceptions/platform-role.exceptions.ts`:

```ts
import { ForbiddenError, NotFoundError } from "@cosmneo/onion-lasagna";

/** The `code` strings are a public contract; the admin page branches on them. */

export class UserNotFoundError extends NotFoundError {
  constructor(userId: string) {
    super({ message: `No user with id "${userId}"`, code: "USER_NOT_FOUND" });
    this.name = "UserNotFoundError";
  }
}

/**
 * The rule that keeps the platform from ever running out of administrators:
 * whoever makes a change is an admin and is not the one changed, so they are
 * still an admin afterwards.
 */
export class CannotChangeOwnRoleError extends ForbiddenError {
  constructor() {
    super({ message: "Nobody may change their own platform role.", code: "CANNOT_CHANGE_OWN_ROLE" });
    this.name = "CannotChangeOwnRoleError";
  }
}

/**
 * The requester stopped being an admin between the request's own check and
 * the row lock: another admin removed them in the same instant. It carries the same
 * public code as every handler's `requireAdmin`, because to the person
 * reading it, it is the same fact.
 */
export class RequesterNotAdminError extends ForbiddenError {
  constructor() {
    super({ message: "Only administrators may change a platform role.", code: "ADMIN_ONLY" });
    this.name = "RequesterNotAdminError";
  }
}
```

Append this as the last line of `domain/exceptions/index.ts`:

```ts
export * from "./platform-role.exceptions";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/domain`
Expected: PASS (all tests, including the three new ones).

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/domain/events/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/aggregates/user.aggregate.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/aggregates/__tests__/user.aggregate.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/platform-role.exceptions.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/domain/exceptions/index.ts
git commit -m "feat(user): a user's platform role can change, and says who changed it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `SetPlatformRoleCommand`, its ports, adapters and bootstrap

**Files:**
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/role-change-lock.port.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/auth-role.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/set-platform-role.command.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/set-platform-role.command.ts`
- Test: `packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/set-platform-role.command.test.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/repositories/drizzle-user.repository.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-identity.adapter.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/user/bootstrap/index.ts`

**Interfaces:**
- Consumes (from Task 1): `User.changePlatformRole`, `UserNotFoundError`, `CannotChangeOwnRoleError`, `RequesterNotAdminError`.
- Produces:
  - `RoleChangeLockPort.lockForRoleChange(targetUserId: string): Promise<string[]>`;
  - `AuthRolePort.setRole(userId: string, role: UserRole): Promise<void>`;
  - `SetPlatformRolePort.execute(ctx: ExecutionContext, input: SetPlatformRoleInput): Promise<SetPlatformRoleOutput>`, where `SetPlatformRoleInput = { userId: string; role: "admin" | "customer" }` and `SetPlatformRoleOutput = { userId: string; role: UserRole }`;
  - `bootstrapUser().useCases.setPlatformRole`.

- [ ] **Step 1: Write the ports**

`app/ports/outbound/role-change-lock.port.ts`:

```ts
/**
 * The row locks a platform-role change needs.
 *
 * Its own port rather than a method on `UserRepositoryPort`, so every
 * existing fake of that repository stays valid.
 */
export interface RoleChangeLockPort {
  /**
   * Locks every admin's row and the target's row until the surrounding
   * transaction ends, and returns the admins' ids.
   *
   * Call it only inside `unitOfWork.atomicExecute`; outside a transaction the
   * lock is released as soon as the statement ends.
   */
  lockForRoleChange(targetUserId: string): Promise<string[]>;
}
```

`app/ports/outbound/auth-role.port.ts`:

```ts
import type { UserRole } from "@ntizo/shared";

/**
 * Mirrors the platform role onto better-auth's own `role` column.
 *
 * Nothing authorizes against that column; the GraphQL context reads
 * `ntizo_user.user.role`. It is written only so the two stop disagreeing,
 * which is what sent an admin promotion done by hand to the wrong column.
 */
export interface AuthRolePort {
  setRole(userId: string, role: UserRole): Promise<void>;
}
```

Append to `app/ports/outbound/index.ts`:

```ts
export type { RoleChangeLockPort } from "./role-change-lock.port";
export type { AuthRolePort } from "./auth-role.port";
```

`app/ports/inbound/set-platform-role.command.port.ts`:

```ts
import type { UserRole } from "@ntizo/shared";
import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";

/** The only two roles an administrator hands out; provider access comes from membership. */
export type AssignablePlatformRole = Extract<UserRole, "admin" | "customer">;

export interface SetPlatformRoleInput {
  userId: string;
  role: AssignablePlatformRole;
}

export interface SetPlatformRoleOutput {
  userId: string;
  role: UserRole;
}

export interface SetPlatformRolePort {
  execute(ctx: ExecutionContext, input: SetPlatformRoleInput): Promise<SetPlatformRoleOutput>;
}
```

Append to `app/ports/inbound/index.ts`:

```ts
export type * from "./set-platform-role.command.port";
```

- [ ] **Step 2: Write the failing test** `app/use-cases/__tests__/set-platform-role.command.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import type { BaseDomainEvent } from "@cosmneo/onion-lasagna";
import type { UnitOfWorkPort } from "@cosmneo/onion-lasagna/ports";
import type { UserRole } from "@ntizo/shared";
import type { OutboxPort } from "../../../../../shared/app/ports/outbox.port";
import type { ExecutionContext } from "../../../../../shared/infrastructure/execution-context";
import { User } from "../../../domain/aggregates/user.aggregate";
import type { AuthRolePort, RoleChangeLockPort, UserRepositoryPort } from "../../ports/outbound";
import { SetPlatformRoleCommand } from "../set-platform-role.command";

/** Tracks whether a call happened inside the unit of work, which is what makes it atomic. */
const tx = { inside: false };

const uow: UnitOfWorkPort = {
  async atomicExecute<T>(work: () => Promise<T>): Promise<T> {
    tx.inside = true;
    try {
      return await work();
    } finally {
      tx.inside = false;
    }
  },
};

class FakeUsers implements UserRepositoryPort, RoleChangeLockPort {
  readonly byId = new Map<string, User>();
  readonly saved: { id: string; role: UserRole; inside: boolean }[] = [];
  readonly lockedFor: string[] = [];
  constructor(seed: { id: string; role: UserRole }[]) {
    for (const s of seed) {
      this.byId.set(
        s.id,
        User.rehydrate({
          id: s.id,
          email: `${s.id}@ntizo.test`,
          role: s.role,
          status: "active",
          verificationStatus: null,
          createdAt: new Date("2026-09-01T00:00:00Z"),
          updatedAt: new Date("2026-09-01T00:00:00Z"),
        }),
      );
    }
  }
  async findById(id: string) {
    return this.byId.get(id) ?? null;
  }
  async findByEmail() {
    return null;
  }
  async save(user: User) {
    this.saved.push({ id: user.id, role: user.role, inside: tx.inside });
    this.byId.set(user.id, user);
  }
  async lockForRoleChange(targetUserId: string) {
    this.lockedFor.push(targetUserId);
    return [...this.byId.values()].filter((u) => u.role === "admin").map((u) => u.id);
  }
}

class SpyAuthRole implements AuthRolePort {
  readonly calls: { userId: string; role: UserRole; inside: boolean }[] = [];
  async setRole(userId: string, role: UserRole) {
    this.calls.push({ userId, role, inside: tx.inside });
  }
}

class SpyOutbox implements OutboxPort {
  readonly published: { event: BaseDomainEvent; aggregateType: string; inside: boolean }[] = [];
  async publish(events: BaseDomainEvent[], aggregateType: string) {
    for (const event of events) this.published.push({ event, aggregateType, inside: tx.inside });
  }
}

function as(userId: string): ExecutionContext {
  return {
    requester: {
      type: "authenticated",
      user: { userId, email: "", firstName: "", lastName: "", platformRole: "admin" },
    },
    metadata: { requestId: "r1", receivedAt: new Date() },
  };
}

function setup(seed: { id: string; role: UserRole }[]) {
  const users = new FakeUsers(seed);
  const authRole = new SpyAuthRole();
  const outbox = new SpyOutbox();
  const command = new SetPlatformRoleCommand(users, users, authRole, uow, outbox);
  return { users, authRole, outbox, command };
}

describe("SetPlatformRoleCommand", () => {
  it("grants admin: saves, mirrors and publishes, all inside the transaction", async () => {
    const { users, authRole, outbox, command } = setup([
      { id: "admin-1", role: "admin" },
      { id: "u2", role: "customer" },
    ]);

    const result = await command.execute(as("admin-1"), { userId: "u2", role: "admin" });

    expect(result).toEqual({ userId: "u2", role: "admin" });
    expect(users.lockedFor).toEqual(["u2"]);
    expect(users.saved).toEqual([{ id: "u2", role: "admin", inside: true }]);
    expect(authRole.calls).toEqual([{ userId: "u2", role: "admin", inside: true }]);
    expect(outbox.published).toHaveLength(1);
    expect(outbox.published[0]!.inside).toBe(true);
    expect(outbox.published[0]!.aggregateType).toBe("user");
    expect(outbox.published[0]!.event.payload).toEqual({
      userId: "u2",
      from: "customer",
      to: "admin",
      changedByUserId: "admin-1",
    });
  });

  it("removes admin back to customer", async () => {
    const { authRole, command } = setup([
      { id: "admin-1", role: "admin" },
      { id: "admin-2", role: "admin" },
    ]);

    const result = await command.execute(as("admin-1"), { userId: "admin-2", role: "customer" });

    expect(result).toEqual({ userId: "admin-2", role: "customer" });
    expect(authRole.calls).toEqual([{ userId: "admin-2", role: "customer", inside: true }]);
  });

  it("refuses to change the requester's own role, before taking any lock", async () => {
    const { users, command } = setup([{ id: "admin-1", role: "admin" }]);

    await expect(
      command.execute(as("admin-1"), { userId: "admin-1", role: "customer" }),
    ).rejects.toMatchObject({ code: "CANNOT_CHANGE_OWN_ROLE" });
    expect(users.lockedFor).toEqual([]);
    expect(users.saved).toEqual([]);
  });

  it("refuses when, under the lock, the requester is no longer an admin", async () => {
    // The race: another admin removed this one a moment before this lock.
    const { users, outbox, command } = setup([
      { id: "was-admin", role: "customer" },
      { id: "admin-2", role: "admin" },
    ]);

    await expect(
      command.execute(as("was-admin"), { userId: "admin-2", role: "customer" }),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY" });
    expect(users.saved).toEqual([]);
    expect(outbox.published).toEqual([]);
  });

  it("refuses an id nobody has", async () => {
    const { command } = setup([{ id: "admin-1", role: "admin" }]);

    await expect(
      command.execute(as("admin-1"), { userId: "ghost", role: "admin" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("does nothing, successfully, when the role is already the one asked for", async () => {
    const { users, authRole, outbox, command } = setup([
      { id: "admin-1", role: "admin" },
      { id: "admin-2", role: "admin" },
    ]);

    const result = await command.execute(as("admin-1"), { userId: "admin-2", role: "admin" });

    expect(result).toEqual({ userId: "admin-2", role: "admin" });
    expect(users.saved).toEqual([]);
    expect(authRole.calls).toEqual([]);
    expect(outbox.published).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/set-platform-role.command.test.ts`
Expected: FAIL, because the module `../set-platform-role.command` is not found.

- [ ] **Step 4: Write the command** `app/use-cases/set-platform-role.command.ts`

```ts
import type { UnitOfWorkPort } from "@cosmneo/onion-lasagna/ports";
import type { OutboxPort } from "../../../../shared/app/ports/outbox.port";
import {
  type ExecutionContext,
  requireAuthenticated,
} from "../../../../shared/infrastructure/execution-context";
import type { AuthRolePort, RoleChangeLockPort, UserRepositoryPort } from "../ports/outbound";
import type {
  SetPlatformRoleInput,
  SetPlatformRoleOutput,
  SetPlatformRolePort,
} from "../ports/inbound/set-platform-role.command.port";
import {
  CannotChangeOwnRoleError,
  RequesterNotAdminError,
  UserNotFoundError,
} from "../../domain/exceptions";

/**
 * An administrator grants or removes platform administration.
 *
 * The handler's `requireAdmin` runs before this, against the role read when
 * the request began. That is not enough on its own: two admins removing each
 * other in the same instant would both pass it and leave the platform with
 * none. So the admin check is repeated here under a row lock. The lock
 * covers every admin's row and the target's row. The second of the two
 * transactions waits, finds its requester is no longer an admin, and is
 * refused.
 *
 * The target's row is locked as well, so two admins granting the same person
 * at once record one change, not two. The second one's `findById` runs after
 * the first commits, and reads the role already changed.
 */
export class SetPlatformRoleCommand implements SetPlatformRolePort {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly roleChangeLock: RoleChangeLockPort,
    private readonly authRole: AuthRolePort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly outboxPort: OutboxPort,
  ) {}

  async execute(ctx: ExecutionContext, input: SetPlatformRoleInput): Promise<SetPlatformRoleOutput> {
    const requester = requireAuthenticated(ctx);
    // First, and outside the transaction: it needs no database, and it is the
    // rule that keeps at least one admin — the requester stays one.
    if (input.userId === requester.userId) throw new CannotChangeOwnRoleError();

    return this.unitOfWork.atomicExecute(async () => {
      const admins = await this.roleChangeLock.lockForRoleChange(input.userId);
      if (!admins.includes(requester.userId)) throw new RequesterNotAdminError();

      const user = await this.userRepo.findById(input.userId);
      if (!user) throw new UserNotFoundError(input.userId);

      if (user.changePlatformRole(input.role, requester.userId)) {
        await this.userRepo.save(user);
        await this.authRole.setRole(user.id, user.role);
        // Last, inside the transaction, as every command here does it: the
        // outbox row and the role commit or roll back together.
        await this.outboxPort.publish(user.pullEvents(), "user");
      }
      return { userId: user.id, role: user.role };
    });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/backend && bun test src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/set-platform-role.command.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Implement the adapters**

In `infrastructure/repositories/drizzle-user.repository.ts`:
- change the first import to `import { eq, or } from "drizzle-orm";`;
- change the type import to `import type { RoleChangeLockPort, UserRepositoryPort } from "../../app/ports/outbound";`;
- change the class line to `export class DrizzleUserRepository implements UserRepositoryPort, RoleChangeLockPort {`;
- add this method:

```ts
  /**
   * `FOR UPDATE` on every admin row and on the target's row.
   *
   * Under READ COMMITTED a row another transaction changed is re-checked
   * against this WHERE once its lock is released, and the `role` returned is
   * the committed one. So an admin demoted a moment ago comes back as
   * `customer`, and is not counted.
   */
  async lockForRoleChange(targetUserId: string): Promise<string[]> {
    const rows = await getDb()
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(or(eq(user.role, "admin"), eq(user.id, targetUserId)))
      .for("update");
    return rows.filter((r) => r.role === "admin").map((r) => r.id);
  }
```

In `infrastructure/adapters/better-auth-identity.adapter.ts`:
- change the type import to `import type { AuthIdentityPort, AuthRolePort } from "../../app/ports/outbound";`;
- add `import type { UserRole } from "@ntizo/shared";`;
- change the class line to `export class BetterAuthIdentityAdapter implements AuthIdentityPort, AuthRolePort {`;
- add this method:

```ts
  async setRole(userId: string, role: UserRole): Promise<void> {
    await this.db().update(authUser).set({ role }).where(eq(authUser.id, userId));
  }
```

- [ ] **Step 7: Wire the bootstrap** (`bootstrap/index.ts`)

Add the import:

```ts
import { SetPlatformRoleCommand } from "../app/use-cases/set-platform-role.command";
```

After `const authIdentity = new BetterAuthIdentityAdapter();`, add:

```ts
  const setPlatformRole = new SetPlatformRoleCommand(
    userRepository,
    userRepository,
    authIdentity,
    unitOfWork,
    outboxPort,
  );
```

Add `setPlatformRole,` to the returned `useCases` object, beside `startPhoneVerification`.

- [ ] **Step 8: Typecheck and run the user BC tests**

Run: `cd packages/backend && bunx tsc --noEmit && bun test src/modules/ntizo/bounded-contexts/user`
Expected: tsc prints no errors, and all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/role-change-lock.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/auth-role.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/outbound/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/set-platform-role.command.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/ports/inbound/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/set-platform-role.command.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/app/use-cases/__tests__/set-platform-role.command.test.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/repositories/drizzle-user.repository.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/infrastructure/adapters/better-auth-identity.adapter.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/user/bootstrap/index.ts
git commit -m "feat(user): an admin sets another person's platform role, under a row lock

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Prove the lock is real (dev database test)

**Files:**
- Create: `packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/role-change-lock.test.ts`

**Interfaces:**
- Consumes (from Task 2): `DrizzleUserRepository.lockForRoleChange`.

- [ ] **Step 1: Write the test**

```ts
/**
 * DB-backed test for `DrizzleUserRepository.lockForRoleChange` against the
 * real dev database, for the same reason `catalog-unpublish-sweep.test.ts`
 * exists. A fake would prove the fake; only the shipped SQL, run against
 * real rows, proves the `FOR UPDATE` is there and covers the right rows.
 *
 * The proof of the lock is a second connection: while the first transaction
 * holds it, `FOR UPDATE NOWAIT` on a locked row must fail with SQLSTATE 55P03
 * (lock_not_available), and must succeed on a row outside the lock.
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import * as authSchema from "../../../../../better-auth/infrastructure/database/schema";
import { __runWithTransactionContextForTests } from "../../../../../../shared/infrastructure/database/tx-context";
import type { DrizzleDb } from "../../../../../../shared/infrastructure/database/connection";
import { DrizzleUserRepository } from "../../../../bounded-contexts/user/infrastructure/repositories/drizzle-user.repository";
import { bestEffortCleanup, DEV_DB_COLD_START_TIMEOUT_MS, openDevDbConnection } from "./dev-db-test-connection";
import { user } from "../user/schemas/user.schema";

setDefaultTimeout(DEV_DB_COLD_START_TIMEOUT_MS);

const sql = openDevDbConnection();
const other = openDevDbConnection();
const db = drizzle(sql, { schema: authSchema });
const repo = new DrizzleUserRepository();

const suffix = crypto.randomUUID();
const adminId = `role-lock-admin-${suffix}`;
const targetId = `role-lock-target-${suffix}`;
const bystanderId = `role-lock-bystander-${suffix}`;

let seeding: Promise<unknown> = Promise.resolve();
beforeAll(() => (seeding = db.insert(user).values([
  { id: adminId, email: `${adminId}@example.com`, role: "admin" },
  { id: targetId, email: `${targetId}@example.com`, role: "customer" },
  { id: bystanderId, email: `${bystanderId}@example.com`, role: "customer" },
])));

afterAll(async () => {
  await seeding.catch(() => undefined);
  await bestEffortCleanup([
    () => db.delete(user).where(inArray(user.id, [adminId, targetId, bystanderId])),
    () => sql.end(),
    () => other.end(),
  ]);
});

async function tryLockElsewhere(id: string): Promise<"locked" | "free"> {
  try {
    await other.begin(async (tx) => {
      await tx`SELECT id FROM ntizo_user."user" WHERE id = ${id} FOR UPDATE NOWAIT`;
    });
    return "free";
  } catch (error) {
    if ((error as { code?: string }).code === "55P03") return "locked";
    throw error;
  }
}

describe("DrizzleUserRepository.lockForRoleChange", () => {
  test("returns the admins and holds locks on them and on the target until the transaction ends", async () => {
    await seeding;
    let seen: string[] = [];
    let adminWhileHeld: string | undefined;
    let targetWhileHeld: string | undefined;
    let bystanderWhileHeld: string | undefined;

    await db.transaction(async (tx) => {
      seen = await __runWithTransactionContextForTests(tx as unknown as DrizzleDb, () =>
        repo.lockForRoleChange(targetId),
      );
      adminWhileHeld = await tryLockElsewhere(adminId);
      targetWhileHeld = await tryLockElsewhere(targetId);
      bystanderWhileHeld = await tryLockElsewhere(bystanderId);
    });

    expect(seen).toContain(adminId);
    expect(seen).not.toContain(targetId);
    expect(adminWhileHeld).toBe("locked");
    expect(targetWhileHeld).toBe("locked");
    expect(bystanderWhileHeld).toBe("free");
    // Released at commit.
    expect(await tryLockElsewhere(adminId)).toBe("free");
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd packages/backend && bun test src/modules/ntizo/shared/infrastructure/database/__tests__/role-change-lock.test.ts`
Expected: PASS. It needs `DEV_DB_URL` from `packages/backend/.env`, which bun loads on its own. A 55P03 on the bystander, or "free" on the admin, means the `WHERE` or the `.for("update")` is wrong; fix the adapter, not the test.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/modules/ntizo/shared/infrastructure/database/__tests__/role-change-lock.test.ts
git commit -m "test(user): the role-change lock holds admin and target rows until commit

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The mutation `userAdminSetPlatformRole`

**Files:**
- Modify: `packages/backend/src/modules/ntizo/write/user/graphql/schema/mutations.ts`
- Modify: `packages/backend/src/modules/ntizo/write/user/graphql/handlers/mutations.handlers.ts`
- Modify: `packages/backend/src/modules/ntizo/write/user/__tests__/mutations.handlers.test.ts`
- Modify: `apps/backend/api/src/graphql/private.ts` (the `createUserWriteHandlers({...})` block)

**Interfaces:**
- Consumes (from Task 2): `SetPlatformRolePort` and `bootstrapUser().useCases.setPlatformRole`.
- Produces: the GraphQL mutation `userAdminSetPlatformRole(input: { userId: String!, role: admin|customer }) { userId role }`, with handler key `user.admin.setPlatformRole`.

- [ ] **Step 1: Write the failing tests** (append to `write/user/__tests__/mutations.handlers.test.ts`)

First update the existing `createUserWriteHandlers({...})` call in the file: add this property so the module satisfies the new field.

```ts
        setPlatformRole: { execute: async () => ({ userId: "", role: "customer" as const }) },
```

Then append:

```ts
import type { SetPlatformRoleInput } from "../../../bounded-contexts/user/app/ports/inbound/set-platform-role.command.port";

describe("user.admin.setPlatformRole", () => {
  function module(calls: { requester: string; input: SetPlatformRoleInput }[]) {
    return createUserWriteHandlers({
      updateMyProfile: { execute: async () => {} },
      addMyAddress: { execute: async () => ({ id: "a1" }) },
      updateMyAddress: { execute: async () => {} },
      deleteMyAddress: { execute: async () => {} },
      startPhoneVerification: {
        execute: async () => ({ code: "", businessNumber: "", expiresAt: new Date() }),
      },
      setPlatformRole: {
        execute: async (ec: ExecutionContext, input: SetPlatformRoleInput) => {
          if (ec.requester.type !== "authenticated") throw new Error("unreachable");
          calls.push({ requester: ec.requester.user.userId, input });
          return { userId: input.userId, role: input.role };
        },
      },
    });
  }
  const field = (calls: { requester: string; input: SetPlatformRoleInput }[]) =>
    module(calls).find((h) => h.key === "user.admin.setPlatformRole")!;

  it("refuses a non-admin with ADMIN_ONLY and never reaches the command", async () => {
    const calls: { requester: string; input: SetPlatformRoleInput }[] = [];
    await expect(
      field(calls).handler({ userId: "u2", role: "admin" }, ctx({ role: "customer" })),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY" });
    expect(calls).toEqual([]);
  });

  it("refuses an admin role with nobody behind it", async () => {
    const calls: { requester: string; input: SetPlatformRoleInput }[] = [];
    await expect(
      field(calls).handler({ userId: "u2", role: "admin" }, ctx({ requesterUserId: null, role: "admin" })),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY" });
    expect(calls).toEqual([]);
  });

  it("passes the session's admin as the requester, and the target from the input", async () => {
    const calls: { requester: string; input: SetPlatformRoleInput }[] = [];
    const result = await field(calls).handler({ userId: "u2", role: "admin" }, ctx({ role: "admin" }));
    expect(calls).toEqual([{ requester: "u-session", input: { userId: "u2", role: "admin" } }]);
    expect(result).toEqual({ userId: "u2", role: "admin" });
  });

  it("accepts only admin or customer as the role", () => {
    const json = setPlatformRoleForAdmin.input!.toJsonSchema() as {
      properties?: { role?: { enum?: string[] } };
    };
    expect(json.properties?.role?.enum).toEqual(["admin", "customer"]);
  });
});
```

Change the file's existing schema import to `import { setPlatformRoleForAdmin, updateMyProfile } from "../graphql/schema/mutations";`. Keep the new type import beside the file's other imports.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && bun test src/modules/ntizo/write/user/__tests__/mutations.handlers.test.ts`
Expected: FAIL, because `setPlatformRoleForAdmin` is not exported and the `user.admin.setPlatformRole` handler is missing.

- [ ] **Step 3: Declare the mutation** in `write/user/graphql/schema/mutations.ts`

Append this paragraph to the file's opening docblock, right after the "no `userId` field" paragraph:

```ts
 *
 * One exception, under `admin`: `setPlatformRole` names its subject, because
 * an administrator acts on somebody else. Its handler's `requireAdmin` is its
 * whole authorization surface, and the command refuses self-changes.
```

Then, before `userWriteSchema`, add:

```ts
/**
 * An administrator grants or removes platform administration.
 *
 * `role` is only ever `admin` or `customer`. Provider access comes from
 * membership, so no other role is an administrator's to hand out.
 */
export const setPlatformRoleForAdmin = defineMutation({
  input: zodSchema(
    z.object({
      userId: z.string().trim().min(1).max(64),
      role: z.enum(["admin", "customer"]),
    }),
  ),
  output: zodSchema(z.object({ userId: z.string(), role: z.string() })),
  docs: { summary: "Grant or remove platform administration", tags: ["Admin"] },
});
```

Inside `userWriteSchema`'s `user: { ... }`, add `admin: { setPlatformRole: setPlatformRoleForAdmin },` after `startPhoneVerification,`.

- [ ] **Step 4: Handle it** in `write/user/graphql/handlers/mutations.handlers.ts`

Add these imports:

```ts
import { ForbiddenError } from "@cosmneo/onion-lasagna";
import type { NtizoGraphqlContext } from "../../../../graphql/context";
import type { SetPlatformRolePort } from "../../../../bounded-contexts/user/app/ports/inbound/set-platform-role.command.port";
```

Add `readonly setPlatformRole: SetPlatformRolePort;` to `UserWriteModule`. Then add this function above `createUserWriteHandlers`:

```ts
/**
 * Refuses anyone whose platform role is not `admin`.
 *
 * Both the id and the role: the context defaults an anonymous caller to
 * `customer`, so a role check alone would be reading a value chosen for the
 * absence of a user. Same shape and code as every other write module's.
 */
function requireAdmin(ctx: NtizoGraphqlContext): void {
  if (!ctx.requesterUserId || ctx.role !== "admin") {
    throw new ForbiddenError({
      message: "Only administrators may change a platform role",
      code: "ADMIN_ONLY",
    });
  }
}
```

Add this handler before `.build()`:

```ts
    .handle("user.admin.setPlatformRole", async (args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      requireAdmin(nctx);
      return writeModule.setPlatformRole.execute(toExecutionContext(nctx), {
        userId: args.input.userId,
        role: args.input.role,
      });
    })
```

- [ ] **Step 5: Mount it in the API** (`apps/backend/api/src/graphql/private.ts`)

In the `createUserWriteHandlers({ ... })` object, add:

```ts
        setPlatformRole: user.useCases.setPlatformRole,
```

- [ ] **Step 6: Run tests and typecheck**

Run: `cd packages/backend && bun test src/modules/ntizo/write/user && bunx tsc --noEmit`
Then: `cd ../../apps/backend/api && bunx tsc --noEmit && bun test src/graphql`
Expected: PASS, and no type errors. The API's field-coverage test fails if the mutation is declared but not mounted.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/modules/ntizo/write/user/graphql/schema/mutations.ts \
  packages/backend/src/modules/ntizo/write/user/graphql/handlers/mutations.handlers.ts \
  packages/backend/src/modules/ntizo/write/user/__tests__/mutations.handlers.test.ts \
  apps/backend/api/src/graphql/private.ts
git commit -m "feat(api): userAdminSetPlatformRole, for administrators only

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The query `userDetailForAdmin`

**Files:**
- Create: `packages/shared/src/read-models/system/user/user-admin-detail.schema.ts`
- Modify: `packages/shared/src/read-models/system/user/index.ts`
- Modify: `packages/backend/src/modules/ntizo/read/user/app/ports/outbound/user-admin.repository.port.ts`
- Modify: `packages/backend/src/modules/ntizo/read/user/infra/repositories/drizzle/user-admin.repository.ts`
- Create: `packages/backend/src/modules/ntizo/read/user/app/use-cases/get-user-detail-for-admin.projection.ts`
- Modify: `packages/backend/src/modules/ntizo/read/user/graphql/schema/queries.ts`
- Modify: `packages/backend/src/modules/ntizo/read/user/graphql/handlers/queries.handlers.ts`
- Modify: `packages/backend/src/modules/ntizo/read/user/bootstrap/index.ts`
- Modify: `packages/backend/src/modules/ntizo/read/user/__tests__/queries.handlers.test.ts`
- Test: `packages/backend/src/modules/ntizo/read/user/__tests__/user-detail-for-admin.test.ts`

**Interfaces:**
- Produces:
  - the shared types `UserAdminDetailDTO` and `UserAdminWorkspaceDTO`, with the zod model `userAdminDetailReadModel`;
  - `roleChangeFor(role: string, isSelf: boolean)`;
  - `GetUserDetailForAdminProjection.execute({ requesterUserId, userId })`;
  - the GraphQL query `userDetailForAdmin(input: { userId })`.

- [ ] **Step 1: The shared read model**

`packages/shared/src/read-models/system/user/user-admin-detail.schema.ts`:

```ts
import { z } from "zod";

/** One workspace a person belongs to, as the admin detail page lists it. */
export const userAdminWorkspaceReadModel = z.object({
  providerId: z.string().min(1),
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  /** The business's own status: `pending` | `active` | `rejected` | `suspended` | `archived`. */
  providerStatus: z.string(),
  /** This person's role in it: `owner` | `admin` | `staff`. */
  memberRole: z.string(),
  /** ISO 8601. */
  joinedAt: z.string(),
});

/**
 * One person, as the administration detail page sees them.
 *
 * The list's restraint, kept: no bio, no date of birth, no gender, no
 * timezone. What is added is what an administrator checks when opening one
 * account: whether the email and phone are confirmed, the language they read,
 * where they work, and the one role move available.
 *
 * `roleChange` is the server's decision, not the page's: `to` is the role the
 * one available button would set, and `blockedReason` says why there is none.
 */
export const userAdminDetailReadModel = z.object({
  id: z.string().min(1),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  phoneNumber: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  language: z.string(),
  /** ISO 8601. */
  createdAt: z.string(),
  workspaces: z.array(userAdminWorkspaceReadModel),
  roleChange: z.object({
    to: z.enum(["admin", "customer"]).nullable(),
    blockedReason: z.enum(["self"]).nullable(),
  }),
});

export type UserAdminWorkspaceDTO = z.infer<typeof userAdminWorkspaceReadModel>;
export type UserAdminDetailDTO = z.infer<typeof userAdminDetailReadModel>;
```

Append to `packages/shared/src/read-models/system/user/index.ts`:

```ts
export * from "./user-admin-detail.schema";
```

- [ ] **Step 2: Write the failing tests** `read/user/__tests__/user-detail-for-admin.test.ts`

```ts
import { describe, expect, it } from "bun:test";
import type { NtizoGraphqlContext } from "../../../graphql/context";
import { createUserReadHandlers } from "../graphql/handlers/queries.handlers";
import {
  GetUserDetailForAdminProjection,
  roleChangeFor,
} from "../app/use-cases/get-user-detail-for-admin.projection";
import type {
  UserAdminDetailRecord,
  UserAdminRepositoryPort,
} from "../app/ports/outbound/user-admin.repository.port";

const record: UserAdminDetailRecord = {
  id: "u2", email: "ana@exemplo.co.mz", name: "Ana Sitoe", avatarUrl: null,
  role: "customer", status: "active", phoneNumber: "+258845550142",
  emailVerified: true, phoneVerified: false, language: "pt-MZ",
  createdAt: "2026-09-14T08:00:00.000Z", workspaces: [],
};

function repo(found: UserAdminDetailRecord | null): UserAdminRepositoryPort {
  return {
    listAll: async () => [],
    countAll: async () => 0,
    findDetail: async () => found,
  };
}

function ctx(overrides: Partial<NtizoGraphqlContext> = {}): NtizoGraphqlContext {
  return {
    requesterUserId: "admin-1", email: null, firstName: null, lastName: null,
    role: "admin", requestId: null, ipAddress: null, userAgent: null,
    ...overrides,
  };
}

describe("roleChangeFor", () => {
  it("offers nothing on the requester's own account", () => {
    expect(roleChangeFor("admin", true)).toEqual({ to: null, blockedReason: "self" });
  });
  it("offers removal for another admin", () => {
    expect(roleChangeFor("admin", false)).toEqual({ to: "customer", blockedReason: null });
  });
  it("offers a grant for every role that is not admin", () => {
    for (const role of ["customer", "individual_provider", "organization_owner"]) {
      expect(roleChangeFor(role, false)).toEqual({ to: "admin", blockedReason: null });
    }
  });
});

describe("GetUserDetailForAdminProjection", () => {
  it("adds the server's role decision to what the repository found", async () => {
    const out = await new GetUserDetailForAdminProjection(repo(record)).execute({
      requesterUserId: "admin-1",
      userId: "u2",
    });
    expect(out).toEqual({ ...record, roleChange: { to: "admin", blockedReason: null } });
  });

  it("is a typed USER_NOT_FOUND for an id nobody has", async () => {
    await expect(
      new GetUserDetailForAdminProjection(repo(null)).execute({ requesterUserId: "admin-1", userId: "ghost" }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });
});

describe("user.detailForAdmin handler", () => {
  function field(seen: { requesterUserId: string; userId: string }[]) {
    return createUserReadHandlers({
      getCurrentUser: { execute: async () => { throw new Error("unused"); } },
      listMyAddresses: { execute: async () => [] },
      listUsersForAdmin: { execute: async () => [] } as never,
      getUserDetailForAdmin: {
        execute: async (input: { requesterUserId: string; userId: string }) => {
          seen.push(input);
          return { ...record, roleChange: { to: "admin" as const, blockedReason: null } };
        },
      } as never,
    }).find((h) => h.key === "user.detailForAdmin")!;
  }

  it("refuses a non-admin with ADMIN_ONLY", async () => {
    const seen: { requesterUserId: string; userId: string }[] = [];
    await expect(field(seen).handler({ userId: "u2" }, ctx({ role: "customer" }))).rejects.toMatchObject({
      code: "ADMIN_ONLY",
    });
    expect(seen).toEqual([]);
  });

  it("refuses an admin role with nobody behind it", async () => {
    const seen: { requesterUserId: string; userId: string }[] = [];
    await expect(
      field(seen).handler({ userId: "u2" }, ctx({ requesterUserId: null })),
    ).rejects.toMatchObject({ code: "ADMIN_ONLY" });
  });

  it("takes the requester from the session and the target from the input", async () => {
    const seen: { requesterUserId: string; userId: string }[] = [];
    await field(seen).handler({ userId: "u2", requesterUserId: "victim" }, ctx());
    expect(seen).toEqual([{ requesterUserId: "admin-1", userId: "u2" }]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd packages/backend && bun test src/modules/ntizo/read/user/__tests__/user-detail-for-admin.test.ts`
Expected: FAIL, because the projection module is not found.

- [ ] **Step 4: Port and projection**

In `read/user/app/ports/outbound/user-admin.repository.port.ts`, change the import to `import type { UserAdminDetailDTO, UserAdminDTO } from "@ntizo/shared/read-models";`, then add:

```ts
/** What the detail page knows about one person before anyone asks who is looking. */
export type UserAdminDetailRecord = Omit<UserAdminDetailDTO, "roleChange">;
```

Add this member to the interface:

```ts
  /** One person, or null for an id nobody has. */
  findDetail(userId: string): Promise<UserAdminDetailRecord | null>;
```

Create `read/user/app/use-cases/get-user-detail-for-admin.projection.ts`:

```ts
import { NotFoundError } from "@cosmneo/onion-lasagna";
import type { UserAdminDetailDTO } from "@ntizo/shared/read-models";
import type { UserAdminRepositoryPort } from "../ports/outbound/user-admin.repository.port";

export interface GetUserDetailForAdminInput {
  requesterUserId: string;
  userId: string;
}

/**
 * The one role move this page may offer.
 *
 * Here and not in the repository, whose contract is that its answer does not
 * vary by who asks. This one does: the requester's own account offers
 * nothing, which is also why no "last admin" case exists — the person reading
 * is an admin, and is never the one changed.
 */
export function roleChangeFor(role: string, isSelf: boolean): UserAdminDetailDTO["roleChange"] {
  if (isSelf) return { to: null, blockedReason: "self" };
  return { to: role === "admin" ? "customer" : "admin", blockedReason: null };
}

export class GetUserDetailForAdminProjection {
  constructor(private readonly repo: UserAdminRepositoryPort) {}

  async execute(input: GetUserDetailForAdminInput): Promise<UserAdminDetailDTO> {
    const found = await this.repo.findDetail(input.userId);
    // A typed 404, like the provider detail: a stale link is a page, not a crash.
    if (!found) {
      throw new NotFoundError({ message: `No user with id "${input.userId}"`, code: "USER_NOT_FOUND" });
    }
    return { ...found, roleChange: roleChangeFor(found.role, input.userId === input.requesterUserId) };
  }
}
```

- [ ] **Step 5: Repository** in `read/user/infra/repositories/drizzle/user-admin.repository.ts`

Change the imports to:

```ts
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { USER_ROLES } from "@ntizo/shared";
import type { UserAdminDTO } from "@ntizo/shared/read-models";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { user as authUser } from "../../../../../../better-auth/infrastructure/database/schema";
import { profile, user } from "../../../../../shared/infrastructure/database/user/schemas";
import { provider, providerMember } from "../../../../../shared/infrastructure/database/provider/schemas";
import { mediaUrl } from "../../../../../shared/infrastructure/media";
import type {
  UserAdminDetailRecord,
  UserAdminRepositoryPort,
} from "../../../app/ports/outbound/user-admin.repository.port";
import { resolveAvatarUrl } from "./user-read.repository";
```

Add this method to the class:

```ts
  /**
   * One person, with the two verification flags from better-auth's own row
   * and the workspaces from `provider_member` — the same rows the list's
   * `providerCount` counts, so the two numbers cannot disagree.
   *
   * Columns are named one by one, as in `listAll`, so a personal field added
   * to the profile later does not appear here by default.
   */
  async findDetail(userId: string): Promise<UserAdminDetailRecord | null> {
    const db = getDb();
    const [row] = await db
      .select({
        id: user.id,
        email: user.email,
        name: profile.displayName,
        avatarKey: profile.avatarKey,
        avatarUrl: profile.avatarUrl,
        role: user.role,
        status: user.status,
        phoneNumber: profile.phoneNumber,
        language: profile.language,
        createdAt: user.createdAt,
        emailVerified: authUser.emailVerified,
        phoneVerified: authUser.phoneNumberVerified,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .leftJoin(authUser, eq(authUser.id, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;

    const workspaces = await db
      .select({
        providerId: provider.id,
        name: provider.name,
        slug: provider.slug,
        logoKey: provider.logoKey,
        providerStatus: provider.status,
        memberRole: providerMember.role,
        joinedAt: providerMember.joinedAt,
      })
      .from(providerMember)
      .innerJoin(provider, eq(provider.id, providerMember.providerId))
      .where(eq(providerMember.userId, userId))
      .orderBy(asc(providerMember.joinedAt));

    return {
      id: row.id,
      email: row.email,
      name: row.name?.trim() ? row.name : null,
      avatarUrl: resolveAvatarUrl(row.avatarKey ?? null, row.avatarUrl ?? null),
      role: row.role,
      status: row.status,
      phoneNumber: row.phoneNumber?.trim() ? row.phoneNumber : null,
      emailVerified: row.emailVerified === true,
      phoneVerified: row.phoneVerified === true,
      // The profile column defaults to en-US; a missing profile row reads the same.
      language: row.language ?? "en-US",
      createdAt: row.createdAt.toISOString(),
      workspaces: workspaces.map((w) => ({
        providerId: w.providerId,
        name: w.name,
        slug: w.slug,
        logoUrl: w.logoKey ? mediaUrl(w.logoKey) : null,
        providerStatus: w.providerStatus,
        memberRole: w.memberRole,
        joinedAt: w.joinedAt.toISOString(),
      })),
    };
  }
```

- [ ] **Step 6: Query, handler, bootstrap**

In `read/user/graphql/schema/queries.ts`, add `userAdminDetailReadModel` to the `@ntizo/shared/read-models` import, then add:

```ts
/** One person, for the administration detail page. Guarded by the handler. */
export const getUserDetailForAdmin = defineQuery({
  input: zodSchema(z.object({ userId: z.string().trim().min(1).max(64) })),
  output: zodSchema(userAdminDetailReadModel),
  docs: { summary: "One user, for administration", tags: ["Admin"] },
});
```

Also add `detailForAdmin: getUserDetailForAdmin,` inside `user: { ... }` in `userReadSchema`.

In `read/user/graphql/handlers/queries.handlers.ts`, add this import:

```ts
import type { GetUserDetailForAdminProjection } from "../../app/use-cases/get-user-detail-for-admin.projection";
import type { NtizoGraphqlContext } from "../../../../graphql/context";
```

Add `readonly getUserDetailForAdmin: GetUserDetailForAdminProjection;` to `UserReadModule`, and add this function above `createUserReadHandlers`:

```ts
/**
 * Both the id and the role: the context defaults an anonymous caller to
 * `customer` rather than to null, so a role check alone would be reading a
 * value chosen for the absence of a user.
 */
function requireAdminRequester(ctx: NtizoGraphqlContext, message: string): string {
  const { requesterUserId, role } = ctx;
  if (!requesterUserId || role !== "admin") {
    throw new ForbiddenError({ message, code: "ADMIN_ONLY" });
  }
  return requesterUserId;
}
```

Replace the body of the `user.allForAdmin` argsMapper's check with:

```ts
        requireAdminRequester(asNtizoGraphqlContext(ctx), "Only administrators may list every user");
```

Keep its existing `return { role, search, limit, offset }`. Add a new handler before `.build()`:

```ts
    .handleWithUseCase("user.detailForAdmin", {
      argsMapper: (args, ctx) => ({
        requesterUserId: requireAdminRequester(
          asNtizoGraphqlContext(ctx),
          "Only administrators may read a user's file",
        ),
        userId: args.input.userId,
      }),
      useCase: readModule.getUserDetailForAdmin,
      responseMapper: (output) => output,
    })
```

In `read/user/bootstrap/index.ts`, add the import:

```ts
import { GetUserDetailForAdminProjection } from "../app/use-cases/get-user-detail-for-admin.projection";
```

Add `getUserDetailForAdmin: new GetUserDetailForAdminProjection(userAdminRepository),` to `useCases`.

- [ ] **Step 7: Keep the existing handler test honest**

In `read/user/__tests__/queries.handlers.test.ts`, add this property to both `createUserReadHandlers({...})` calls:

```ts
      getUserDetailForAdmin: { execute: async () => { throw new Error("unused"); } } as never,
```

Change `expect(handlers.length).toBe(3);` to `expect(handlers.length).toBe(4);`. Update its comment to read "Four now: the profile, the address list, the admin user list and the admin user detail."

- [ ] **Step 8: Run tests and typecheck**

Run: `cd packages/backend && bun test src/modules/ntizo/read/user && bunx tsc --noEmit && (cd ../shared && bunx tsc --noEmit) && (cd ../../apps/backend/api && bunx tsc --noEmit && bun test src/graphql)`
Expected: PASS, and no type errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/read-models/system/user/user-admin-detail.schema.ts \
  packages/shared/src/read-models/system/user/index.ts \
  packages/backend/src/modules/ntizo/read/user/app/ports/outbound/user-admin.repository.port.ts \
  packages/backend/src/modules/ntizo/read/user/infra/repositories/drizzle/user-admin.repository.ts \
  packages/backend/src/modules/ntizo/read/user/app/use-cases/get-user-detail-for-admin.projection.ts \
  packages/backend/src/modules/ntizo/read/user/graphql/schema/queries.ts \
  packages/backend/src/modules/ntizo/read/user/graphql/handlers/queries.handlers.ts \
  packages/backend/src/modules/ntizo/read/user/bootstrap/index.ts \
  packages/backend/src/modules/ntizo/read/user/__tests__/queries.handlers.test.ts \
  packages/backend/src/modules/ntizo/read/user/__tests__/user-detail-for-admin.test.ts
git commit -m "feat(api): userDetailForAdmin, with the server's role decision on it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Activity, `user.role.changed` from start to finish

**Files:**
- Modify: `packages/shared/src/enums/activity-enums/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/activity/app/ports/outbound/user-name-reader.port.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/activity/app/ports/outbound/index.ts`
- Create: `packages/backend/src/modules/ntizo/bounded-contexts/activity/infrastructure/outbound-adapters/cross-bc/user-name-reader.adapter.ts`
- Modify: `packages/backend/src/modules/ntizo/bounded-contexts/activity/bootstrap/index.ts`
- Modify: `packages/backend/src/modules/ntizo/write/activity/events/handlers/user.event-handlers.ts`
- Modify: `packages/backend/src/modules/ntizo/write/activity/__tests__/event-handlers.test.ts`
- Modify: `apps/backend/api/src/api.ts` (the `registerUserActivityHandlers` call)
- Modify: `apps/backend/api/src/__tests__/event-handler-registration.activity.test.ts`
- Modify: `apps/frontend/web/src/features/activity/ui/activity-icon.tsx`
- Modify: `apps/frontend/web/src/features/activity/viewmodel/describe-activity.ts`
- Modify: `apps/frontend/web/src/features/activity/domain/__tests__/types.test.ts`
- Modify: `apps/frontend/web/src/features/activity/viewmodel/__tests__/describe-activity.test.ts`
- Modify: `apps/frontend/web/src/features/activity/viewmodel/__tests__/activity-payload-interpolation.test.ts`
- Modify: `apps/frontend/web/src/shared/locales/*/admin.json` (8 files; Appendix B)
- Modify: `apps/frontend/web/src/shared/locales/*/account.json` (8 files; Appendix C)

**Interfaces:**
- Consumes (from Task 1): the event `"user.role.changed"` with payload `{ userId, from, to, changedByUserId }`.
- Produces:
  - the activity type `"user.role.changed"`, with payload `{ targetName: string | null, to: string }` and actor = `changedByUserId`;
  - `UserNameReaderPort.findNameById(userId): Promise<string | null>`.

- [ ] **Step 1: Write the failing backend tests**

In `write/activity/__tests__/event-handlers.test.ts`, add the import:

```ts
import type { UserNameReaderPort } from "../../../bounded-contexts/activity/app/ports/outbound/user-name-reader.port";
import { UserPlatformRoleChanged } from "../../../bounded-contexts/user/domain/events";
```

Merge the second line into the existing `UserRegistered` import. Add these fakes next to the others:

```ts
class FakeUserNames implements UserNameReaderPort {
  constructor(private readonly namesById: Record<string, string> = {}) {}
  async findNameById(userId: string): Promise<string | null> {
    return this.namesById[userId] ?? null;
  }
}
class ThrowingUserNames implements UserNameReaderPort {
  async findNameById(): Promise<string | null> {
    throw new Error("boom");
  }
}
```

Change the `beforeEach` registration to:

```ts
  registerUserActivityHandlers(router, {
    recordActivity: record,
    userNameReader: new FakeUserNames({ u2: "Ana Sitoe" }),
  });
```

Append:

```ts
describe("user.role.changed", () => {
  const changed = (to: "admin" | "customer") =>
    new UserPlatformRoleChanged({
      userId: "u2",
      from: to === "admin" ? "customer" : "admin",
      to,
      changedByUserId: "admin-1",
    });

  it("files the row under the admin who acted, naming the person changed", async () => {
    await router.dispatch([changed("admin")]);
    expect(record.calls[0]).toMatchObject({ actorUserId: "admin-1", type: "user.role.changed" });
    expect(record.calls[0]!.payload).toEqual({ targetName: "Ana Sitoe", to: "admin" });
  });

  it("records a removal with to = customer", async () => {
    await router.dispatch([changed("customer")]);
    expect(record.calls[0]!.payload).toEqual({ targetName: "Ana Sitoe", to: "customer" });
  });

  it("still records, nameless, when the name cannot be resolved", async () => {
    const r = new EventRouter();
    const rec = new SpyRecord();
    registerUserActivityHandlers(r, { recordActivity: rec, userNameReader: new FakeUserNames() });
    await r.dispatch([changed("admin")]);
    expect(rec.calls[0]!.payload).toEqual({ targetName: null, to: "admin" });
  });

  it("still records, nameless, when the lookup throws", async () => {
    const r = new EventRouter();
    const rec = new SpyRecord();
    registerUserActivityHandlers(r, { recordActivity: rec, userNameReader: new ThrowingUserNames() });
    await r.dispatch([changed("admin")]);
    expect(rec.calls[0]!.payload).toEqual({ targetName: null, to: "admin" });
  });
});
```

In `apps/backend/api/src/__tests__/event-handler-registration.activity.test.ts`, add `"user.role.changed": 1,` to `EXPECTED_HANDLER_COUNT`. Also update the docblock's counting sentence: it becomes "Four of the ten … the other six carry 1".

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/backend && bun test src/modules/ntizo/write/activity`
Expected: FAIL, because `user-name-reader.port` is missing and no row is recorded for `user.role.changed`.

- [ ] **Step 3: Shared type, port, adapter, bootstrap**

In `packages/shared/src/enums/activity-enums/index.ts`, append `"user.role.changed",` as the last entry of `ACTIVITY_TYPES`.

Create `bounded-contexts/activity/app/ports/outbound/user-name-reader.port.ts`:

```ts
/**
 * A person's current name, as the Activity context needs it to snapshot a
 * history row. This is this context's own port, like `ProviderNameReaderPort` (F5).
 */
export interface UserNameReaderPort {
  /** Display name, else the email; null if the account no longer exists. */
  findNameById(userId: string): Promise<string | null>;
}
```

Append to `bounded-contexts/activity/app/ports/outbound/index.ts`:

```ts
export type { UserNameReaderPort } from "./user-name-reader.port";
```

Create `bounded-contexts/activity/infrastructure/outbound-adapters/cross-bc/user-name-reader.adapter.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../better-auth/infrastructure/client/drizzle";
import { profile, user } from "../../../../../shared/infrastructure/database/user/schemas";
import type { UserNameReaderPort } from "../../../app/ports/outbound/user-name-reader.port";

/**
 * The single place the Activity context reads a person's name.
 *
 * Display name first and the email second, the same fallback the admin users
 * list uses. A history row that names nobody at all is worse than one that
 * names an address.
 */
export class DrizzleUserNameReader implements UserNameReaderPort {
  async findNameById(userId: string): Promise<string | null> {
    const [row] = await getDb()
      .select({ email: user.email, displayName: profile.displayName })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;
    return row.displayName?.trim() || row.email;
  }
}
```

In `bounded-contexts/activity/bootstrap/index.ts`, import `DrizzleUserNameReader` from `"../infrastructure/outbound-adapters/cross-bc/user-name-reader.adapter"`, construct `const userNameReader = new DrizzleUserNameReader();`, and return `adapters: { providerNameReader, serviceNameReader, userNameReader }`.

- [ ] **Step 4: The handler** (`write/activity/events/handlers/user.event-handlers.ts`)

Replace the file with:

```ts
import type { EventRouter } from "../../../../../../shared/infrastructure/events/event-router";
import type { RecordActivityInternalPort } from "../../../../bounded-contexts/activity/app/ports/inbound/record-activity.internal.command.port";
import type { UserNameReaderPort } from "../../../../bounded-contexts/activity/app/ports/outbound/user-name-reader.port";

export interface UserActivityDeps {
  readonly recordActivity: RecordActivityInternalPort;
  readonly userNameReader: UserNameReaderPort;
}

/**
 * A lookup failure costs the name, never the row. Same rule and reasoning as
 * `resolveProviderName` in `provider.event-handlers.ts`.
 */
async function resolveUserName(reader: UserNameReaderPort, userId: string): Promise<string | null> {
  try {
    return await reader.findNameById(userId);
  } catch (error) {
    console.error("[activity] could not resolve a user's name", error);
    return null;
  }
}

/**
 * What the User context's events mean to somebody's history.
 *
 * Registered rather than imported by the producer, like the notification
 * handlers: the User context publishes its events and does not know that
 * anything keeps a history.
 *
 * `user.role.changed` is filed under the administrator who acted, and it
 * snapshots the name of the person changed. A history row can outlive a
 * rename; a bare id would let it quietly change what it says about the past.
 */
export function registerUserActivityHandlers(router: EventRouter, deps: UserActivityDeps): void {
  router.on("user.registered", async (event) => {
    const payload = event.payload as { userId: string };
    await deps.recordActivity.execute({
      actorUserId: payload.userId,
      type: "user.registered",
      payload: {},
      occurredAt: event.occurredOn,
    });
  });

  router.on("user.role.changed", async (event) => {
    const payload = event.payload as { userId: string; to: string; changedByUserId: string };
    const targetName = await resolveUserName(deps.userNameReader, payload.userId);
    await deps.recordActivity.execute({
      actorUserId: payload.changedByUserId,
      type: "user.role.changed",
      payload: { targetName, to: payload.to },
      occurredAt: event.occurredOn,
    });
  });
}
```

In `apps/backend/api/src/api.ts`, change the registration to:

```ts
registerUserActivityHandlers(eventRouter, {
  recordActivity: activityBootstrap.useCases.internal.recordActivity,
  userNameReader: activityBootstrap.adapters.userNameReader,
});
```

- [ ] **Step 5: Run the backend tests**

Run: `cd packages/backend && bun test src/modules/ntizo/write/activity src/modules/ntizo/bounded-contexts/activity && bunx tsc --noEmit && (cd ../../apps/backend/api && bunx tsc --noEmit && bun test src/__tests__/event-handler-registration.activity.test.ts)`
Expected: PASS.

- [ ] **Step 6: Write the failing web tests**

In `features/activity/domain/__tests__/types.test.ts`, inside "flattens all nine real wire types…", add:

```ts
    expect(activityTypeKey("user.role.changed")).toBe("userRoleChanged");
```

Rename that test to "flattens all ten real wire types, including the three with a second dot".

In `features/activity/viewmodel/__tests__/activity-payload-interpolation.test.ts`, add this to `HANDLER_PAYLOADS`:

```ts
  "user.role.changed": { targetName: "Ana Sitoe", to: "admin" },
```

Add this line to the docblock table above it:

```ts
 *   user.role.changed          .../user.event-handlers.ts                                        -> { targetName, to }
```

Append to `features/activity/viewmodel/__tests__/describe-activity.test.ts`:

```ts
describe("describeActivity: user.role.changed", () => {
  it("says which way the role went, by `to`", () => {
    const t = i18n.getFixedT("en-US", "admin");
    expect(describeActivity(t, entry("user.role.changed", { targetName: "Ana Sitoe", to: "admin" }))).toBe(
      "Gave Ana Sitoe admin access",
    );
    expect(
      describeActivity(t, entry("user.role.changed", { targetName: "Ana Sitoe", to: "customer" })),
    ).toBe("Removed Ana Sitoe's admin access");
  });

  it("names nobody in particular when the account is gone", () => {
    const t = i18n.getFixedT("pt-MZ", "account");
    expect(describeActivity(t, entry("user.role.changed", { targetName: null, to: "admin" }))).toBe(
      "Deu acesso de administração a um utilizador",
    );
  });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `cd apps/frontend/web && bunx vitest run src/features/activity src/shared/locales`
Expected: FAIL, because of the missing keys and the untyped `ICONS` entry.

- [ ] **Step 8: Web implementation**

In `features/activity/ui/activity-icon.tsx`, add `ShieldCheck` to the lucide import and `"user.role.changed": ShieldCheck,` to `ICONS`. Update the docblock's "the same nine" to "the same ten".

In `features/activity/viewmodel/describe-activity.ts`, in `withFallbackNames`:

```ts
  const serviceIsNull = payload.serviceName === null;
  const providerIsNull = payload.providerName === null;
  const targetIsNull = payload.targetName === null;
  return {
    replace: {
      ...payload,
      ...(serviceIsNull ? { serviceName: t("activityType.unnamedService") } : {}),
      ...(providerIsNull ? { providerName: t("activityType.unnamedProvider") } : {}),
      ...(targetIsNull ? { targetName: t("activityType.unnamedUser") } : {}),
    },
    usedFallback: serviceIsNull || providerIsNull || targetIsNull,
  };
```

Update its docblock's "`serviceName`/`providerName`" mentions to include `targetName`.

Merge the keys from **Appendix B** into each locale's `admin.json`, and from **Appendix C** into each locale's `account.json`. The new `activityType.*` keys go inside the existing `"activityType"` object, after `"reviewCreated"` and before `"unnamedProvider"`, with `"unnamedUser"` after `"unnamedService"`. `activityKind.userRoleChanged` goes last inside `"activityKind"`. Keep the files' two-space indentation. Validate each file with `python3 -m json.tool <file> > /dev/null`.

- [ ] **Step 9: Run the web tests and typecheck**

Run: `cd apps/frontend/web && bunx vitest run src/features/activity src/shared/locales && bunx tsc -b`
Expected: PASS, and no type errors.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/enums/activity-enums/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/activity/app/ports/outbound/user-name-reader.port.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/activity/app/ports/outbound/index.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/activity/infrastructure/outbound-adapters/cross-bc/user-name-reader.adapter.ts \
  packages/backend/src/modules/ntizo/bounded-contexts/activity/bootstrap/index.ts \
  packages/backend/src/modules/ntizo/write/activity/events/handlers/user.event-handlers.ts \
  packages/backend/src/modules/ntizo/write/activity/__tests__/event-handlers.test.ts \
  apps/backend/api/src/api.ts \
  apps/backend/api/src/__tests__/event-handler-registration.activity.test.ts \
  apps/frontend/web/src/features/activity/ui/activity-icon.tsx \
  apps/frontend/web/src/features/activity/viewmodel/describe-activity.ts \
  apps/frontend/web/src/features/activity/domain/__tests__/types.test.ts \
  apps/frontend/web/src/features/activity/viewmodel/__tests__/describe-activity.test.ts \
  apps/frontend/web/src/features/activity/viewmodel/__tests__/activity-payload-interpolation.test.ts \
  apps/frontend/web/src/shared/locales/*/admin.json \
  apps/frontend/web/src/shared/locales/*/account.json
git commit -m "feat(activity): a role change is recorded under the admin who made it

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Web data layer and routes

**Files:**
- Modify: `apps/frontend/web/src/features/admin/users/domain/types.ts`
- Modify: `apps/frontend/web/src/features/admin/users/data/admin-user.repository.ts`
- Modify: `apps/frontend/web/src/features/admin/users/viewmodel/use-admin-users.ts`
- Modify: `apps/frontend/web/src/shared/components/language-switcher.tsx`
- Rename: `apps/frontend/web/src/routes/admin/users.tsx` → `apps/frontend/web/src/routes/admin/users.index.tsx`
- Create: `apps/frontend/web/src/routes/admin/users.$userId.tsx`
- Create (placeholder, replaced in Task 8): `apps/frontend/web/src/features/admin/users/ui/user-detail-page.tsx`
- Regenerate: `apps/frontend/web/src/routeTree.gen.ts`

**Interfaces:**
- Consumes (from Tasks 4–5): `userDetailForAdmin` and `userAdminSetPlatformRole`.
- Produces:
  - `AdminUserDetail` and `AdminUserWorkspace` types;
  - `displayName(user: Pick<AdminUser, "name" | "email">)`;
  - `adminUserQueries.detail(userId)`, with key `["admin","user",userId]`;
  - `setPlatformRole(userId, role)`, `useAdminUserDetail(userId)` and `useSetPlatformRole(userId)`;
  - `localeName(code)`;
  - `AdminUserDetailPage`.

- [ ] **Step 1: Types**

In `domain/types.ts`, add at the top:

```ts
import type { UserAdminDetailDTO, UserAdminWorkspaceDTO } from "@ntizo/shared/read-models";

/** One person as the detail page reads them — the server's shape, unchanged. */
export type AdminUserDetail = UserAdminDetailDTO;
export type AdminUserWorkspace = UserAdminWorkspaceDTO;
```

Change `displayName`'s signature to `export function displayName(user: Pick<AdminUser, "name" | "email">): string {`, keeping the body.

- [ ] **Step 2: Repository**

In `data/admin-user.repository.ts`, change the types import to `import type { AdminUser, AdminUserDetail } from "../domain/types";`, then add:

```ts
const DETAIL = `
  query UserDetailForAdmin($input: UserDetailForAdminInput!) {
    userDetailForAdmin(input: $input) {
      id email name avatarUrl role status phoneNumber emailVerified phoneVerified language createdAt
      workspaces { providerId name slug logoUrl providerStatus memberRole joinedAt }
      roleChange { to blockedReason }
    }
  }`;

const SET_ROLE = `
  mutation UserAdminSetPlatformRole($input: UserAdminSetPlatformRoleInput!) {
    userAdminSetPlatformRole(input: $input) { userId role }
  }`;
```

Add this inside `adminUserQueries`:

```ts
  detail: (userId: string) =>
    queryOptions({
      queryKey: ["admin", "user", userId],
      queryFn: async (): Promise<AdminUserDetail> => {
        const d = await sessionGraphql<{ userDetailForAdmin: AdminUserDetail }>(DETAIL, {
          input: { userId },
        });
        return d.userDetailForAdmin;
      },
      // An empty id would come back FORBIDDEN and read as a permissions problem.
      enabled: userId.length > 0,
      // A stale link is not worth retrying.
      retry: (failures, error) =>
        (error as { code?: string }).code !== "USER_NOT_FOUND" && failures < 2,
    }),
```

Add after the object:

```ts
export async function setPlatformRole(userId: string, role: "admin" | "customer"): Promise<void> {
  await sessionGraphql(SET_ROLE, { input: { userId, role } });
}
```

- [ ] **Step 3: Viewmodel**

Replace `viewmodel/use-admin-users.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUserQueries, setPlatformRole } from "../data/admin-user.repository";

export function useAdminUsers(input: { role?: string; search?: string }) {
  // Server-side, like the provider queue: this is the largest list on the
  // platform by definition — every provider is also a user — so deciding
  // which fifty of ten thousand to draw is not the browser's decision.
  return useQuery(adminUserQueries.all(input));
}

export function useAdminUserDetail(userId: string) {
  return useQuery(adminUserQueries.detail(userId));
}

/**
 * Invalidates this person's file and the list together. The list shows the
 * role too, and leaving it stale would make a promotion look undone the
 * moment an admin went back.
 */
export function useSetPlatformRole(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: "admin" | "customer") => setPlatformRole(userId, role),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "user", userId] }),
        qc.invalidateQueries({ queryKey: ["admin", "users"] }),
      ]);
    },
  });
}
```

- [ ] **Step 4: `localeName`**

In `shared/components/language-switcher.tsx`, add this below the `LOCALES` constant:

```ts
/** A locale's own name for itself, as the picker shows it; the code itself for anything unknown. */
export function localeName(code: string): string {
  return LOCALES[code]?.name ?? code;
}
```

- [ ] **Step 5: Routes**

```bash
git mv apps/frontend/web/src/routes/admin/users.tsx apps/frontend/web/src/routes/admin/users.index.tsx
```

Set `users.index.tsx` to:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersPage } from "@/features/admin/users/ui/users-page";

export const Route = createFileRoute("/admin/users/")({
  component: AdminUsersPage,
});
```

Create `routes/admin/users.$userId.tsx`:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { AdminUserDetailPage } from "@/features/admin/users/ui/user-detail-page";

export const Route = createFileRoute("/admin/users/$userId")({
  component: AdminUserDetailPage,
});
```

Create a placeholder `features/admin/users/ui/user-detail-page.tsx`, so the route compiles until Task 8 replaces it:

```tsx
export function AdminUserDetailPage() {
  return null;
}
```

- [ ] **Step 6: Regenerate the route tree and typecheck**

Run: `cd apps/frontend/web && export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH" && bunx vite build && bunx tsc -b`
Expected: the build succeeds, and `git diff --stat src/routeTree.gen.ts` shows `/admin/users/` and `/admin/users/$userId` added in place of `/admin/users`. `tsc` prints no errors.

- [ ] **Step 7: Run the existing tests that name `/admin/users`**

Run: `cd apps/frontend/web && bunx vitest run src/shared/lib src/routes src/features/admin`
Expected: PASS. Those tests use the URL string `/admin/users`, which still resolves to the index route.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/web/src/features/admin/users/domain/types.ts \
  apps/frontend/web/src/features/admin/users/data/admin-user.repository.ts \
  apps/frontend/web/src/features/admin/users/viewmodel/use-admin-users.ts \
  apps/frontend/web/src/features/admin/users/ui/user-detail-page.tsx \
  apps/frontend/web/src/shared/components/language-switcher.tsx \
  apps/frontend/web/src/routes/admin/users.index.tsx \
  apps/frontend/web/src/routes/admin/users.\$userId.tsx \
  apps/frontend/web/src/routeTree.gen.ts
git commit -m "feat(admin): the user detail route and its data

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

(`git mv` already staged the deletion of `users.tsx`.)

---

### Task 8: The page, the role section, the dialog and the workspaces

**Files:**
- Modify (replace the placeholder): `apps/frontend/web/src/features/admin/users/ui/user-detail-page.tsx`
- Create: `apps/frontend/web/src/features/admin/users/ui/role-section.tsx`
- Create: `apps/frontend/web/src/features/admin/users/ui/role-confirm-dialog.tsx`
- Create: `apps/frontend/web/src/features/admin/users/ui/workspaces-section.tsx`
- Modify: `apps/frontend/web/src/shared/locales/*/admin.json` (8 files; Appendix A)
- Test: `apps/frontend/web/src/features/admin/users/ui/__tests__/user-detail-page.test.tsx`

**Interfaces:**
- Consumes (from Task 7): `useAdminUserDetail`, `useSetPlatformRole`, `displayName`, `localeName`, and `AdminUserDetail` / `AdminUserWorkspace`.

- [ ] **Step 1: Add the Appendix A keys** to every `admin.json`

Place them after the existing `"users*"` keys, before `"userRole"`. Validate each file with `python3 -m json.tool`.

- [ ] **Step 2: Write the failing test** `ui/__tests__/user-detail-page.test.tsx`

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { GraphqlError } from "@/shared/lib/graphql/session-graphql";
import type { AdminUserDetail } from "../../domain/types";
import { AdminUserDetailPage } from "../user-detail-page";

const fakes = vi.hoisted(() => ({
  detail: null as unknown as AdminUserDetail,
  setRole: vi.fn(),
}));

vi.mock("@/features/admin/users/data/admin-user.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/users/data/admin-user.repository")>();
  return {
    ...actual,
    setPlatformRole: fakes.setRole,
    adminUserQueries: {
      ...actual.adminUserQueries,
      // Real options, fake fetch: every read, including the refetch after a
      // change, answers with whatever `fakes.detail` holds at that moment.
      detail: (userId: string) => ({
        ...actual.adminUserQueries.detail(userId),
        queryFn: async () => fakes.detail,
      }),
    },
  };
});

afterEach(() => {
  fakes.setRole.mockReset();
});

const base: AdminUserDetail = {
  id: "u-2", email: "ana.sitoe@exemplo.co.mz", name: "Ana Sitoe", avatarUrl: null,
  role: "customer", status: "active", phoneNumber: "+258845550142",
  emailVerified: true, phoneVerified: false, language: "pt-MZ",
  createdAt: "2026-09-14T08:00:00.000Z",
  workspaces: [
    {
      providerId: "p-1", name: "Estúdio Mavalane", slug: "estudio-mavalane", logoUrl: null,
      providerStatus: "active", memberRole: "staff", joinedAt: "2026-09-03T08:00:00.000Z",
    },
  ],
  roleChange: { to: "admin", blockedReason: null },
};

async function renderPage(detail: Partial<AdminUserDetail> = {}) {
  fakes.detail = { ...base, ...detail };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rootRoute = createRootRoute();
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users/$userId", component: AdminUserDetailPage }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/users", component: () => <p>users</p> }),
      createRoute({ getParentRoute: () => rootRoute, path: "/admin/providers/$providerId", component: () => <p>provider</p> }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/admin/users/u-2"] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: "Ana Sitoe" });
}

describe("AdminUserDetailPage", () => {
  it("shows who this is, with both verification states", async () => {
    await renderPage();
    expect(screen.getAllByText("ana.sitoe@exemplo.co.mz").length).toBeGreaterThan(0);
    expect(screen.getByText("verified")).toBeInTheDocument();
    expect(screen.getByText("not verified")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
    expect(screen.getByText("Português (Moçambique)")).toBeInTheDocument();
    expect(screen.getByText("u-2")).toBeInTheDocument();
  });

  it("asks before granting, and grants only on confirm", async () => {
    const user = userEvent.setup();
    fakes.setRole.mockResolvedValue(undefined);
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Make admin" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Give Ana Sitoe admin access?")).toBeInTheDocument();
    expect(fakes.setRole).not.toHaveBeenCalled();

    fakes.detail = { ...base, role: "admin", roleChange: { to: "customer", blockedReason: null } };
    await user.click(within(dialog).getByRole("button", { name: "Give access" }));

    expect(fakes.setRole).toHaveBeenCalledWith("u-2", "admin");
    expect(await screen.findByRole("button", { name: "Remove admin" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("removes admin from another admin, through its own dialog", async () => {
    const user = userEvent.setup();
    fakes.setRole.mockResolvedValue(undefined);
    await renderPage({ role: "admin", roleChange: { to: "customer", blockedReason: null } });

    await user.click(screen.getByRole("button", { name: "Remove admin" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Remove Ana Sitoe's admin access?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove access" }));

    expect(fakes.setRole).toHaveBeenCalledWith("u-2", "customer");
  });

  it("offers nothing on your own account, and says why", async () => {
    await renderPage({ roleChange: { to: null, blockedReason: "self" } });
    expect(screen.queryByRole("button", { name: /admin/i })).not.toBeInTheDocument();
    expect(
      screen.getByText("This is your account. Only another administrator can change your role."),
    ).toBeInTheDocument();
  });

  it("keeps a refusal inside the dialog, with Close as the only way on", async () => {
    const user = userEvent.setup();
    fakes.setRole.mockRejectedValue(
      new GraphqlError(200, [
        { message: "no", extensions: { code: "FORBIDDEN", originalCode: "ADMIN_ONLY" } },
      ]),
    );
    await renderPage({ role: "admin", roleChange: { to: "customer", blockedReason: null } });

    await user.click(screen.getByRole("button", { name: "Remove admin" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove access" }));

    expect(
      await within(dialog).findByText(/another administrator removed it in the meantime/i),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Remove access" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("lists the workspaces, each opening its admin page", async () => {
    await renderPage();
    const link = screen.getByRole("link", { name: /Estúdio Mavalane/ });
    expect(link).toHaveAttribute("href", "/admin/providers/p-1");
    expect(within(link).getByText(/Staff · member since/)).toBeInTheDocument();
  });

  it("says so when there are no workspaces", async () => {
    await renderPage({ workspaces: [] });
    expect(screen.getByText("Doesn't belong to any workspace.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd apps/frontend/web && bunx vitest run src/features/admin/users`
Expected: FAIL, because the placeholder page renders nothing and there is no heading.

- [ ] **Step 4: `workspaces-section.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@ntizo/frontend-ui";
import { ProviderStatus } from "@ntizo/shared";
import { initialsFrom } from "@/shared/lib/initials";
import type { AdminUserWorkspace } from "../domain/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  [ProviderStatus.Active]: "success",
  [ProviderStatus.Pending]: "warning",
  [ProviderStatus.Rejected]: "danger",
  [ProviderStatus.Suspended]: "danger",
  [ProviderStatus.Archived]: "info",
};

/**
 * The businesses this person belongs to.
 *
 * The same rows the list's "Espaços" count counts, so the number there and
 * the rows here agree. The role words come from the `provider` namespace,
 * where the workspace's own people list reads them.
 */
export function WorkspacesSection({
  workspaces,
  loading,
}: {
  workspaces: readonly AdminUserWorkspace[];
  loading: boolean;
}) {
  const { t, i18n } = useTranslation("admin");
  const { t: tp } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <div className="px-5 py-4">
        <p className="type-caption font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase">
          {t("userDetailWorkspaces")}
        </p>
        <p className="type-body mt-0.5 text-[var(--color-muted-foreground)]">
          {t("userDetailWorkspacesHint")}
        </p>
      </div>

      {loading ? (
        <p className="type-body border-t border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-muted-foreground)]">
          {t("providerDetailDocumentsLoading")}
        </p>
      ) : (
        <ul className="grid list-none gap-0 p-0">
          {workspaces.map((w) => (
            <li key={w.providerId} className="border-t border-[var(--color-border)]">
              <Link
                to="/admin/providers/$providerId"
                params={{ providerId: w.providerId }}
                className="group flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[var(--color-muted)]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0 rounded-[10px]">
                    {w.logoUrl && <AvatarImage src={w.logoUrl} alt="" />}
                    <AvatarFallback className="rounded-[10px] text-xs">{initialsFrom(w.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="type-body-medium truncate font-semibold group-hover:underline">{w.name}</p>
                    <p className="type-caption truncate text-[var(--color-muted-foreground)]">
                      {t("userDetailWorkspaceLine", {
                        role: tp(`peopleRoles.${w.memberRole}`, { defaultValue: w.memberRole }),
                        date: date(w.joinedAt),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={STATUS_TONE[w.providerStatus] ?? "info"}>
                    {t(`providerStatus.${w.providerStatus}`, { defaultValue: w.providerStatus })}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                </div>
              </Link>
            </li>
          ))}
          {workspaces.length === 0 && (
            <li className="type-body border-t border-[var(--color-border)] px-5 py-8 text-center text-[var(--color-muted-foreground)]">
              {t("userDetailNoWorkspaces")}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: `role-confirm-dialog.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ntizo/frontend-ui";
import { useSetPlatformRole } from "../viewmodel/use-admin-users";

/** The codes the command refuses with, each with its own sentence. */
const KNOWN_ERRORS = new Set(["ADMIN_ONLY", "CANNOT_CHANGE_OWN_ROLE", "USER_NOT_FOUND"]);

const ABILITIES = [
  "userDetailGrantAbilityBusinesses",
  "userDetailGrantAbilityCommission",
  "userDetailGrantAbilitySee",
  "userDetailGrantAbilityRoles",
] as const;

/**
 * Says what the access is before it is given or taken.
 *
 * Owns its mutation, like `CancelDialog`: the caller decides only whether it
 * is mounted. It stays open on a refusal and never closes as if it had
 * succeeded. After a refusal its only action is Close, because every refusal
 * here is one a second click would meet again.
 */
export function RoleConfirmDialog({
  userId,
  name,
  to,
  onClose,
}: {
  userId: string;
  name: string;
  to: "admin" | "customer";
  onClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const change = useSetPlatformRole(userId);
  const code = (change.error as { code?: string } | null)?.code;
  const granting = to === "admin";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !change.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(granting ? "userDetailGrantTitle" : "userDetailRevokeTitle", { name })}</DialogTitle>
          <DialogDescription>
            {t(granting ? "userDetailGrantLead" : "userDetailRevokeBody", { name })}
          </DialogDescription>
        </DialogHeader>

        {granting && (
          <>
            <ul className="grid list-none gap-1.5 p-0">
              {ABILITIES.map((key) => (
                <li key={key} className="type-body flex gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                  {t(key)}
                </li>
              ))}
            </ul>
            <p className="type-caption text-[var(--color-muted-foreground)]">{t("userDetailGrantAudit")}</p>
          </>
        )}

        {change.isError && (
          <p role="alert" className="type-body text-[var(--color-destructive)]">
            {code && KNOWN_ERRORS.has(code) ? t(`userDetailRoleError.${code}`) : t("userDetailRoleFailed")}
          </p>
        )}

        <DialogFooter>
          {change.isError ? (
            <Button type="button" variant="outline" onClick={onClose}>
              {t("userDetailClose")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={change.isPending}>
                {t("userDetailCancel")}
              </Button>
              <Button
                type="button"
                variant={granting ? "default" : "destructive"}
                disabled={change.isPending}
                onClick={() => change.mutate(to, { onSuccess: onClose })}
              >
                {change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t(granting ? "userDetailGrantConfirm" : "userDetailRevokeConfirm")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: `role-section.tsx`**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { Button, Skeleton } from "@ntizo/frontend-ui";
import type { AdminUserDetail } from "../domain/types";
import { RoleConfirmDialog } from "./role-confirm-dialog";

/**
 * Whether this person administers the platform, and the one move available.
 *
 * Which move it is comes from the server (`roleChange`), exactly as the
 * provider page takes `allowedTransitions`: a button the server would then
 * refuse is worse than no button. Removing access is outline, not red; the
 * red one is the confirm inside the dialog.
 */
export function RoleSection({
  detail,
  name,
  loading,
}: {
  detail: AdminUserDetail | undefined;
  name: string | null;
  loading: boolean;
}) {
  const { t } = useTranslation("admin");
  const [confirming, setConfirming] = useState(false);
  const change = detail?.roleChange;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
      <p className="type-caption font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase">
        {t("userDetailRoleSection")}
      </p>
      <p className="type-body mt-0.5 text-[var(--color-muted-foreground)]">{t("userDetailRoleHint")}</p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {loading || !change ? (
          <Skeleton className="h-11 w-36 rounded-[var(--radius-field)]" />
        ) : change.blockedReason === "self" ? (
          <p className="type-body flex items-start gap-2 text-[var(--color-muted-foreground)]">
            <Lock className="mt-1 h-4 w-4 shrink-0" />
            {t("userDetailSelf")}
          </p>
        ) : change.to ? (
          <Button
            type="button"
            variant={change.to === "admin" ? "default" : "outline"}
            className="w-full sm:w-auto"
            onClick={() => setConfirming(true)}
          >
            {t(change.to === "admin" ? "userDetailGrant" : "userDetailRevoke")}
          </Button>
        ) : null}
      </div>

      {confirming && detail && change?.to && name && (
        <RoleConfirmDialog
          userId={detail.id}
          name={name}
          to={change.to}
          onClose={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 7: `user-detail-page.tsx`** (replace the placeholder)

```tsx
import { useTranslation } from "react-i18next";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, Badge, Skeleton } from "@ntizo/frontend-ui";
import { localeName } from "@/shared/components/language-switcher";
import { initialsFrom } from "@/shared/lib/initials";
import { usePageHeader } from "@/shared/lib/page-header";
import { displayName } from "../domain/types";
import { useAdminUserDetail } from "../viewmodel/use-admin-users";
import { RoleSection } from "./role-section";
import { WorkspacesSection } from "./workspaces-section";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

/**
 * One person, and whether they administer the platform.
 *
 * The provider detail page's skeleton on purpose: back link, who this is, the
 * decision, then a list. An administrator who has learned one of the two
 * pages has learned both.
 *
 * What is left out is deliberate and matches the list: no bio, no date of
 * birth, no gender, no timezone. Nothing on this page needs them.
 */
export function AdminUserDetailPage() {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { userId } = useParams({ strict: false }) as { userId: string };

  const query = useAdminUserDetail(userId);
  const detail = query.data;
  const name = detail ? displayName(detail) : null;

  usePageHeader(name ?? t("userDetailTitle"), detail?.email);

  const notFound = (query.error as { code?: string } | null)?.code === "USER_NOT_FOUND";
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  const verification = (verified: boolean) => ({
    text: t(verified ? "userDetailVerified" : "userDetailUnverified"),
    verified,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        to="/admin/users"
        className="type-body inline-flex items-center gap-1.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("usersTitle")}
      </Link>

      {query.error && (
        <p className="type-body text-[var(--color-destructive)]">
          {t(notFound ? "userDetailNotFound" : "userDetailError")}
        </p>
      )}

      {/* ── Who this is ──────────────────────────────────────────────────── */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
        {query.isLoading || !detail || !name ? (
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="grid gap-2">
              <Skeleton className="h-[24px] w-56" />
              <Skeleton className="h-[19px] w-40" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="h-14 w-14 shrink-0">
                  {detail.avatarUrl && <AvatarImage src={detail.avatarUrl} alt="" />}
                  <AvatarFallback>{initialsFrom(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="type-h3 truncate font-semibold">{name}</h2>
                  <p className="type-body truncate text-[var(--color-muted-foreground)]">{detail.email}</p>
                </div>
              </div>
              <Badge tone={STATUS_TONE[detail.status] ?? "info"}>
                {t(`userStatus.${detail.status}`, { defaultValue: detail.status })}
              </Badge>
            </div>

            <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
              <Pair label={t("userDetailEmail")} value={detail.email} note={verification(detail.emailVerified)} />
              <Pair
                label={t("userDetailPhone")}
                value={detail.phoneNumber}
                note={detail.phoneNumber ? verification(detail.phoneVerified) : undefined}
              />
              <Pair label={t("userDetailRole")} value={t(`userRole.${detail.role}`, { defaultValue: detail.role })} />
              <Pair label={t("userDetailLanguage")} value={localeName(detail.language)} />
              <Pair label={t("userDetailJoined")} value={date(detail.createdAt)} />
              {/* Shown because support quotes it. */}
              <Pair label={t("userDetailId")} value={detail.id} mono />
            </dl>
          </>
        )}
      </section>

      <RoleSection detail={detail} name={name} loading={query.isLoading} />
      <WorkspacesSection workspaces={detail?.workspaces ?? []} loading={query.isLoading} />
    </div>
  );
}

function Pair({
  label,
  value,
  note,
  mono,
}: {
  label: string;
  value: string | null;
  /** A state that belongs beside the value — whether an email or phone is confirmed. */
  note?: { text: string; verified: boolean } | undefined;
  mono?: boolean;
}) {
  const shown = value?.trim();
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="type-caption text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={mono ? "type-caption m-0 truncate font-mono" : "type-body m-0 flex min-w-0 items-center gap-2"}>
        <span className="truncate">{shown || "—"}</span>
        {note && shown && (
          <Badge tone={note.verified ? "success" : "warning"} className="shrink-0">
            {note.text}
          </Badge>
        )}
      </dd>
    </div>
  );
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `cd apps/frontend/web && bunx vitest run src/features/admin/users src/shared/locales && bunx tsc -b`
Expected: PASS, and no type errors.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/web/src/features/admin/users/ui/user-detail-page.tsx \
  apps/frontend/web/src/features/admin/users/ui/role-section.tsx \
  apps/frontend/web/src/features/admin/users/ui/role-confirm-dialog.tsx \
  apps/frontend/web/src/features/admin/users/ui/workspaces-section.tsx \
  apps/frontend/web/src/features/admin/users/ui/__tests__/user-detail-page.test.tsx \
  apps/frontend/web/src/shared/locales/*/admin.json
git commit -m "feat(admin): the user page, where an admin grants or removes admin access

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The users list links to the page

**Files:**
- Modify: `apps/frontend/web/src/features/admin/users/ui/users-page.tsx`
- Test: `apps/frontend/web/src/features/admin/users/ui/__tests__/users-page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { AdminUser } from "../../domain/types";
import { AdminUsersPage } from "../users-page";

const rows: AdminUser[] = [
  {
    id: "u-2", email: "ana.sitoe@exemplo.co.mz", name: "Ana Sitoe", role: "customer",
    status: "active", phoneNumber: null, providerCount: 1, createdAt: "2026-09-14T08:00:00.000Z",
  },
];

vi.mock("@/features/admin/users/data/admin-user.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/users/data/admin-user.repository")>();
  return {
    ...actual,
    adminUserQueries: {
      ...actual.adminUserQueries,
      all: (input: Parameters<typeof actual.adminUserQueries.all>[0]) => ({
        ...actual.adminUserQueries.all(input),
        queryFn: async () => rows,
      }),
    },
  };
});

describe("AdminUsersPage", () => {
  it("links each person's name to their page", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rootRoute = createRootRoute();
    const router = createRouter({
      routeTree: rootRoute.addChildren([
        createRoute({ getParentRoute: () => rootRoute, path: "/admin/users", component: AdminUsersPage }),
        createRoute({ getParentRoute: () => rootRoute, path: "/admin/users/$userId", component: () => <p>detail</p> }),
      ]),
      history: createMemoryHistory({ initialEntries: ["/admin/users"] }),
    });
    await router.load();
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const links = await screen.findAllByRole("link", { name: "Ana Sitoe" });
    expect(links[0]).toHaveAttribute("href", "/admin/users/u-2");
  });
});
```

`findAllByRole` is used because `CollectionCard` renders both a table row and a mobile card for each person.

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/frontend/web && bunx vitest run src/features/admin/users/ui/__tests__/users-page.test.tsx`
Expected: FAIL, because no link is named "Ana Sitoe".

- [ ] **Step 3: Link the name** in `users-page.tsx`

Add `import { Link } from "@tanstack/react-router";`. In `Person`, replace

```tsx
        <p className="type-body-medium truncate font-semibold">{name}</p>
```

with

```tsx
        {/* A link now that there is somewhere to go, as `ProviderRow` did when
            the provider page arrived. */}
        <Link
          to="/admin/users/$userId"
          params={{ userId: user.id }}
          className="type-body-medium block truncate font-semibold hover:underline"
        >
          {name}
        </Link>
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/frontend/web && bunx vitest run src/features/admin && bunx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/web/src/features/admin/users/ui/users-page.tsx \
  apps/frontend/web/src/features/admin/users/ui/__tests__/users-page.test.tsx
git commit -m "feat(admin): a person's name in the users list opens their page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: End to end, plus screenshots

**Files:**
- Create: `apps/e2e/tests/admin-users.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { createVerifiedUser, type VerifiedUser } from "../fixtures/auth";
import { fillSignInForm } from "../fixtures/ui";
import { sql } from "../fixtures/db";

async function cleanup(users: readonly VerifiedUser[]): Promise<void> {
  for (const user of users) {
    await sql()`DELETE FROM ntizo_activity.activity WHERE actor_user_id = ${user.id}`.catch((err) =>
      console.error("[e2e] admin-users cleanup: activity", err),
    );
    // Cascades to ntizo_user.profile.
    await sql()`DELETE FROM ntizo_user."user" WHERE id = ${user.id}`.catch((err) =>
      console.error("[e2e] admin-users cleanup: user", err),
    );
  }
}

test("an admin grants admin access from a person's page", async ({ page }) => {
  const admin = await createVerifiedUser("admin", { firstName: "Ada", lastName: "Admin" });
  const customer = await createVerifiedUser(undefined, { firstName: "Cora", lastName: "Customer" });

  try {
    await page.goto("/sign-in");
    await fillSignInForm(page, admin);
    await page.waitForURL(/\/admin/);

    await page.goto(`/admin/users/${customer.id}`);
    await expect(page.getByRole("heading", { name: customer.name })).toBeVisible();
    await page.screenshot({ path: "screenshots/admin-user-detail-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "Make admin" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Give ${customer.name} admin access?`)).toBeVisible();
    await page.screenshot({ path: "screenshots/admin-user-detail-confirm.png" });

    await dialog.getByRole("button", { name: "Give access" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Remove admin" })).toBeVisible();

    const [ntizo] = await sql()`SELECT role FROM ntizo_user."user" WHERE id = ${customer.id}`;
    const [auth] = await sql()`SELECT role FROM better_auth."user" WHERE id = ${customer.id}`;
    expect(ntizo?.role).toBe("admin");
    expect(auth?.role).toBe("admin");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "screenshots/admin-user-detail-phone.png", fullPage: true });
  } finally {
    await cleanup([customer, admin]);
  }
});
```

- [ ] **Step 2: Check the activity table and screenshot folder names**

Run: `grep -rn "pgSchema(\"ntizo_activity\")\|actor_user_id" packages/backend/src/modules/ntizo/shared/infrastructure/database/activity/schemas/*.ts | head -3; git check-ignore -v apps/e2e/screenshots/x.png`
Expected: the schema is `ntizo_activity`, the table is `activity` with an `actor_user_id` column, and the screenshots folder is ignored. If a name differs, fix the cleanup SQL. If the screenshots are not ignored, write them to `test-results/` instead.

- [ ] **Step 3: Run it**

```bash
open -a Docker && sleep 20 && docker start ntizo-e2e-pg
cd apps/e2e && bun run e2e tests/admin-users.spec.ts --project=chromium
```

Expected: 1 passed, with the three screenshots written. Look at them: the desktop page matches the mockup's section 1, the dialog its section 2, and the phone its section 4.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/admin-users.spec.ts
git commit -m "test(e2e): an admin grants admin access from a person's page

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Verify everything, then ship to dev

- [ ] **Step 1: Bring in `origin/dev`**

```bash
git fetch origin && git merge origin/dev
```

If this produces a merge commit, rerun every step below after it; semantic conflicts only show up in typecheck.

- [ ] **Step 2: Full suites**

```bash
(cd packages/backend && bunx tsc --noEmit && bun test src scripts)
(cd packages/shared && bunx tsc --noEmit)
(cd apps/backend/api && bunx tsc --noEmit && bun test)
(cd apps/frontend/web && bunx tsc -b && bunx vitest run)
```

Expected: everything passes except the known baseline failures from memory: `admin-stats.repository.test.ts` racing on the shared dev DB, and any test that needs a `DATABASE_URL` the API does not have locally. Compare each failure against `origin/dev` before calling it baseline.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/admin-user-detail
gh pr create --base dev --title "feat(admin): user detail page, and granting or removing admin access" --body-file /tmp/pr-body.md
```

Write `/tmp/pr-body.md` before running this:
- a "What" section copied from the spec's "What";
- a "Verification" section listing each Step 2 command with its pass or fail count and any baseline failure named;
- the three screenshot paths from Task 10;
- the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 4: Merge and deploy dev** (only with the user's go-ahead)

```bash
gh pr merge <n> --merge
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
(cd apps/backend/api && bun run deploy:dev)
(cd apps/frontend/web && bun run deploy:dev)
```

The API goes first: the web's new queries need its fields. Smoke-check by running an admin's `userDetailForAdmin` against `https://dev.api.ntizo.co.mz/graphql`, or by opening `https://dev.ntizo.co.mz/admin/users` signed in as an admin.

---

## Appendix A: `admin.json` keys for the page (Task 8)

**en-US**
```json
"userDetailTitle": "User",
"userDetailError": "Couldn't load this user.",
"userDetailNotFound": "This user no longer exists.",
"userDetailEmail": "Email",
"userDetailPhone": "Phone",
"userDetailRole": "Role",
"userDetailLanguage": "Language",
"userDetailJoined": "Joined",
"userDetailId": "ID",
"userDetailVerified": "verified",
"userDetailUnverified": "not verified",
"userDetailRoleSection": "Platform role",
"userDetailRoleHint": "An administrator approves and suspends businesses, sets commissions, sees every user and booking, and can change other people's roles.",
"userDetailGrant": "Make admin",
"userDetailRevoke": "Remove admin",
"userDetailSelf": "This is your account. Only another administrator can change your role.",
"userDetailGrantTitle": "Give {{name}} admin access?",
"userDetailGrantLead": "From their next request, {{name}} will be able to:",
"userDetailGrantAbilityBusinesses": "approve, reject and suspend businesses",
"userDetailGrantAbilityCommission": "set commissions",
"userDetailGrantAbilitySee": "see every user, booking and support request",
"userDetailGrantAbilityRoles": "change other people's roles, including yours",
"userDetailGrantAudit": "It is recorded in the activity, under your name.",
"userDetailGrantConfirm": "Give access",
"userDetailRevokeTitle": "Remove {{name}}'s admin access?",
"userDetailRevokeBody": "From their next request, {{name}} will no longer see the administration. Their workspaces don't change.",
"userDetailRevokeConfirm": "Remove access",
"userDetailCancel": "Cancel",
"userDetailClose": "Close",
"userDetailRoleError": {
  "ADMIN_ONLY": "You no longer have admin access: another administrator removed it in the meantime. Nothing was changed.",
  "CANNOT_CHANGE_OWN_ROLE": "You can't change your own role.",
  "USER_NOT_FOUND": "This user no longer exists."
},
"userDetailRoleFailed": "Couldn't change the role. Try again.",
"userDetailWorkspaces": "Workspaces",
"userDetailWorkspacesHint": "The businesses this person belongs to, and what they do in each.",
"userDetailWorkspaceLine": "{{role}} · member since {{date}}",
"userDetailNoWorkspaces": "Doesn't belong to any workspace."
```

**pt-MZ**
```json
"userDetailTitle": "Utilizador",
"userDetailError": "Não foi possível carregar este utilizador.",
"userDetailNotFound": "Este utilizador já não existe.",
"userDetailEmail": "Email",
"userDetailPhone": "Telefone",
"userDetailRole": "Papel",
"userDetailLanguage": "Idioma",
"userDetailJoined": "Registado em",
"userDetailId": "ID",
"userDetailVerified": "verificado",
"userDetailUnverified": "por verificar",
"userDetailRoleSection": "Papel na plataforma",
"userDetailRoleHint": "Um administrador aprova e suspende negócios, define comissões, vê todos os utilizadores e reservas, e pode mudar o papel de outras pessoas.",
"userDetailGrant": "Tornar admin",
"userDetailRevoke": "Retirar admin",
"userDetailSelf": "Esta é a sua conta. Só outro administrador pode mudar o seu papel.",
"userDetailGrantTitle": "Dar acesso de administração a {{name}}?",
"userDetailGrantLead": "A partir do próximo pedido, {{name}} passa a poder:",
"userDetailGrantAbilityBusinesses": "aprovar, recusar e suspender negócios",
"userDetailGrantAbilityCommission": "definir comissões",
"userDetailGrantAbilitySee": "ver todos os utilizadores, reservas e pedidos de suporte",
"userDetailGrantAbilityRoles": "mudar o papel de outras pessoas, incluindo o seu",
"userDetailGrantAudit": "Fica registado na actividade, com o seu nome.",
"userDetailGrantConfirm": "Dar acesso",
"userDetailRevokeTitle": "Retirar o acesso de administração a {{name}}?",
"userDetailRevokeBody": "A partir do próximo pedido, {{name}} deixa de ver a administração. Os espaços a que pertence não mudam.",
"userDetailRevokeConfirm": "Retirar acesso",
"userDetailCancel": "Cancelar",
"userDetailClose": "Fechar",
"userDetailRoleError": {
  "ADMIN_ONLY": "Já não tem acesso de administração: outro administrador retirou-o entretanto. Nada foi alterado.",
  "CANNOT_CHANGE_OWN_ROLE": "Não pode mudar o seu próprio papel.",
  "USER_NOT_FOUND": "Este utilizador já não existe."
},
"userDetailRoleFailed": "Não foi possível alterar o papel. Tente novamente.",
"userDetailWorkspaces": "Espaços",
"userDetailWorkspacesHint": "Os negócios a que esta pessoa pertence, e o que faz em cada um.",
"userDetailWorkspaceLine": "{{role}} · membro desde {{date}}",
"userDetailNoWorkspaces": "Não pertence a nenhum espaço."
```

**pt-PT**: identical to pt-MZ, except `"userDetailGrantAudit": "Fica registado na atividade, com o seu nome."` (pt-PT writes "atividade", as its `nav.activity` does).

**es-ES**
```json
"userDetailTitle": "Usuario",
"userDetailError": "No se pudo cargar este usuario.",
"userDetailNotFound": "Este usuario ya no existe.",
"userDetailEmail": "Correo",
"userDetailPhone": "Teléfono",
"userDetailRole": "Rol",
"userDetailLanguage": "Idioma",
"userDetailJoined": "Registrado el",
"userDetailId": "ID",
"userDetailVerified": "verificado",
"userDetailUnverified": "sin verificar",
"userDetailRoleSection": "Rol en la plataforma",
"userDetailRoleHint": "Un administrador aprueba y suspende negocios, fija comisiones, ve todos los usuarios y reservas, y puede cambiar el rol de otras personas.",
"userDetailGrant": "Hacer admin",
"userDetailRevoke": "Quitar admin",
"userDetailSelf": "Esta es tu cuenta. Solo otro administrador puede cambiar tu rol.",
"userDetailGrantTitle": "¿Dar acceso de administración a {{name}}?",
"userDetailGrantLead": "A partir de su próxima solicitud, {{name}} podrá:",
"userDetailGrantAbilityBusinesses": "aprobar, rechazar y suspender negocios",
"userDetailGrantAbilityCommission": "fijar comisiones",
"userDetailGrantAbilitySee": "ver todos los usuarios, reservas y solicitudes de soporte",
"userDetailGrantAbilityRoles": "cambiar el rol de otras personas, incluido el tuyo",
"userDetailGrantAudit": "Queda registrado en la actividad, con tu nombre.",
"userDetailGrantConfirm": "Dar acceso",
"userDetailRevokeTitle": "¿Quitar el acceso de administración a {{name}}?",
"userDetailRevokeBody": "A partir de su próxima solicitud, {{name}} dejará de ver la administración. Sus espacios no cambian.",
"userDetailRevokeConfirm": "Quitar acceso",
"userDetailCancel": "Cancelar",
"userDetailClose": "Cerrar",
"userDetailRoleError": {
  "ADMIN_ONLY": "Ya no tienes acceso de administración: otro administrador te lo quitó mientras tanto. No se ha cambiado nada.",
  "CANNOT_CHANGE_OWN_ROLE": "No puedes cambiar tu propio rol.",
  "USER_NOT_FOUND": "Este usuario ya no existe."
},
"userDetailRoleFailed": "No se pudo cambiar el rol. Inténtalo de nuevo.",
"userDetailWorkspaces": "Espacios",
"userDetailWorkspacesHint": "Los negocios a los que pertenece esta persona y lo que hace en cada uno.",
"userDetailWorkspaceLine": "{{role}} · miembro desde {{date}}",
"userDetailNoWorkspaces": "No pertenece a ningún espacio."
```

**fr-FR**
```json
"userDetailTitle": "Utilisateur",
"userDetailError": "Impossible de charger cet utilisateur.",
"userDetailNotFound": "Cet utilisateur n'existe plus.",
"userDetailEmail": "E-mail",
"userDetailPhone": "Téléphone",
"userDetailRole": "Rôle",
"userDetailLanguage": "Langue",
"userDetailJoined": "Inscrit le",
"userDetailId": "ID",
"userDetailVerified": "vérifié",
"userDetailUnverified": "non vérifié",
"userDetailRoleSection": "Rôle sur la plateforme",
"userDetailRoleHint": "Un administrateur approuve et suspend les entreprises, fixe les commissions, voit tous les utilisateurs et toutes les réservations, et peut changer le rôle des autres.",
"userDetailGrant": "Nommer admin",
"userDetailRevoke": "Retirer les droits admin",
"userDetailSelf": "C'est votre compte. Seul un autre administrateur peut changer votre rôle.",
"userDetailGrantTitle": "Donner l'accès administrateur à {{name}} ?",
"userDetailGrantLead": "Dès sa prochaine requête, {{name}} pourra :",
"userDetailGrantAbilityBusinesses": "approuver, refuser et suspendre des entreprises",
"userDetailGrantAbilityCommission": "fixer les commissions",
"userDetailGrantAbilitySee": "voir tous les utilisateurs, réservations et demandes d'assistance",
"userDetailGrantAbilityRoles": "changer le rôle des autres, y compris le vôtre",
"userDetailGrantAudit": "C'est enregistré dans l'activité, à votre nom.",
"userDetailGrantConfirm": "Donner l'accès",
"userDetailRevokeTitle": "Retirer l'accès administrateur de {{name}} ?",
"userDetailRevokeBody": "Dès sa prochaine requête, {{name}} ne verra plus l'administration. Ses espaces ne changent pas.",
"userDetailRevokeConfirm": "Retirer l'accès",
"userDetailCancel": "Annuler",
"userDetailClose": "Fermer",
"userDetailRoleError": {
  "ADMIN_ONLY": "Vous n'avez plus l'accès administrateur : un autre administrateur l'a retiré entre-temps. Rien n'a été modifié.",
  "CANNOT_CHANGE_OWN_ROLE": "Vous ne pouvez pas changer votre propre rôle.",
  "USER_NOT_FOUND": "Cet utilisateur n'existe plus."
},
"userDetailRoleFailed": "Impossible de changer le rôle. Réessayez.",
"userDetailWorkspaces": "Espaces",
"userDetailWorkspacesHint": "Les entreprises auxquelles cette personne appartient, et ce qu'elle y fait.",
"userDetailWorkspaceLine": "{{role}} · membre depuis le {{date}}",
"userDetailNoWorkspaces": "N'appartient à aucun espace."
```

**de-DE**
```json
"userDetailTitle": "Nutzer",
"userDetailError": "Dieser Nutzer konnte nicht geladen werden.",
"userDetailNotFound": "Diesen Nutzer gibt es nicht mehr.",
"userDetailEmail": "E-Mail",
"userDetailPhone": "Telefon",
"userDetailRole": "Rolle",
"userDetailLanguage": "Sprache",
"userDetailJoined": "Registriert am",
"userDetailId": "ID",
"userDetailVerified": "bestätigt",
"userDetailUnverified": "nicht bestätigt",
"userDetailRoleSection": "Rolle auf der Plattform",
"userDetailRoleHint": "Ein Administrator genehmigt und sperrt Unternehmen, legt Provisionen fest, sieht alle Nutzer und Buchungen und kann die Rolle anderer ändern.",
"userDetailGrant": "Zum Admin machen",
"userDetailRevoke": "Admin entziehen",
"userDetailSelf": "Das ist Ihr Konto. Nur ein anderer Administrator kann Ihre Rolle ändern.",
"userDetailGrantTitle": "{{name}} Administratorzugriff geben?",
"userDetailGrantLead": "Ab der nächsten Anfrage kann {{name}}:",
"userDetailGrantAbilityBusinesses": "Unternehmen genehmigen, ablehnen und sperren",
"userDetailGrantAbilityCommission": "Provisionen festlegen",
"userDetailGrantAbilitySee": "alle Nutzer, Buchungen und Supportanfragen sehen",
"userDetailGrantAbilityRoles": "die Rolle anderer ändern, auch Ihre",
"userDetailGrantAudit": "Das wird in der Aktivität unter Ihrem Namen festgehalten.",
"userDetailGrantConfirm": "Zugriff geben",
"userDetailRevokeTitle": "{{name}} den Administratorzugriff entziehen?",
"userDetailRevokeBody": "Ab der nächsten Anfrage sieht {{name}} die Verwaltung nicht mehr. Die Arbeitsbereiche bleiben unverändert.",
"userDetailRevokeConfirm": "Zugriff entziehen",
"userDetailCancel": "Abbrechen",
"userDetailClose": "Schließen",
"userDetailRoleError": {
  "ADMIN_ONLY": "Sie haben keinen Administratorzugriff mehr: Ein anderer Administrator hat ihn inzwischen entzogen. Nichts wurde geändert.",
  "CANNOT_CHANGE_OWN_ROLE": "Sie können Ihre eigene Rolle nicht ändern.",
  "USER_NOT_FOUND": "Diesen Nutzer gibt es nicht mehr."
},
"userDetailRoleFailed": "Die Rolle konnte nicht geändert werden. Versuchen Sie es erneut.",
"userDetailWorkspaces": "Arbeitsbereiche",
"userDetailWorkspacesHint": "Die Unternehmen, zu denen diese Person gehört, und was sie dort tut.",
"userDetailWorkspaceLine": "{{role}} · Mitglied seit {{date}}",
"userDetailNoWorkspaces": "Gehört zu keinem Arbeitsbereich."
```

**it-IT**
```json
"userDetailTitle": "Utente",
"userDetailError": "Impossibile caricare questo utente.",
"userDetailNotFound": "Questo utente non esiste più.",
"userDetailEmail": "Email",
"userDetailPhone": "Telefono",
"userDetailRole": "Ruolo",
"userDetailLanguage": "Lingua",
"userDetailJoined": "Registrato il",
"userDetailId": "ID",
"userDetailVerified": "verificato",
"userDetailUnverified": "da verificare",
"userDetailRoleSection": "Ruolo sulla piattaforma",
"userDetailRoleHint": "Un amministratore approva e sospende le attività, stabilisce le commissioni, vede tutti gli utenti e le prenotazioni e può cambiare il ruolo di altre persone.",
"userDetailGrant": "Rendi admin",
"userDetailRevoke": "Togli admin",
"userDetailSelf": "Questo è il tuo account. Solo un altro amministratore può cambiare il tuo ruolo.",
"userDetailGrantTitle": "Dare l'accesso di amministrazione a {{name}}?",
"userDetailGrantLead": "Dalla prossima richiesta, {{name}} potrà:",
"userDetailGrantAbilityBusinesses": "approvare, rifiutare e sospendere attività",
"userDetailGrantAbilityCommission": "stabilire le commissioni",
"userDetailGrantAbilitySee": "vedere tutti gli utenti, le prenotazioni e le richieste di assistenza",
"userDetailGrantAbilityRoles": "cambiare il ruolo di altre persone, compreso il tuo",
"userDetailGrantAudit": "Viene registrato nell'attività, a tuo nome.",
"userDetailGrantConfirm": "Dai accesso",
"userDetailRevokeTitle": "Togliere l'accesso di amministrazione a {{name}}?",
"userDetailRevokeBody": "Dalla prossima richiesta, {{name}} non vedrà più l'amministrazione. I suoi spazi non cambiano.",
"userDetailRevokeConfirm": "Togli accesso",
"userDetailCancel": "Annulla",
"userDetailClose": "Chiudi",
"userDetailRoleError": {
  "ADMIN_ONLY": "Non hai più l'accesso di amministrazione: un altro amministratore l'ha tolto nel frattempo. Non è stato cambiato nulla.",
  "CANNOT_CHANGE_OWN_ROLE": "Non puoi cambiare il tuo ruolo.",
  "USER_NOT_FOUND": "Questo utente non esiste più."
},
"userDetailRoleFailed": "Impossibile cambiare il ruolo. Riprova.",
"userDetailWorkspaces": "Spazi",
"userDetailWorkspacesHint": "Le attività a cui appartiene questa persona e cosa fa in ognuna.",
"userDetailWorkspaceLine": "{{role}} · membro dal {{date}}",
"userDetailNoWorkspaces": "Non appartiene a nessuno spazio."
```

**nl-NL**
```json
"userDetailTitle": "Gebruiker",
"userDetailError": "Deze gebruiker kon niet worden geladen.",
"userDetailNotFound": "Deze gebruiker bestaat niet meer.",
"userDetailEmail": "E-mail",
"userDetailPhone": "Telefoon",
"userDetailRole": "Rol",
"userDetailLanguage": "Taal",
"userDetailJoined": "Geregistreerd op",
"userDetailId": "ID",
"userDetailVerified": "geverifieerd",
"userDetailUnverified": "niet geverifieerd",
"userDetailRoleSection": "Rol op het platform",
"userDetailRoleHint": "Een beheerder keurt bedrijven goed en schorst ze, stelt commissies vast, ziet alle gebruikers en boekingen en kan de rol van anderen wijzigen.",
"userDetailGrant": "Beheerder maken",
"userDetailRevoke": "Beheer intrekken",
"userDetailSelf": "Dit is je eigen account. Alleen een andere beheerder kan je rol wijzigen.",
"userDetailGrantTitle": "{{name}} beheerderstoegang geven?",
"userDetailGrantLead": "Vanaf het volgende verzoek kan {{name}}:",
"userDetailGrantAbilityBusinesses": "bedrijven goedkeuren, afwijzen en schorsen",
"userDetailGrantAbilityCommission": "commissies vaststellen",
"userDetailGrantAbilitySee": "alle gebruikers, boekingen en supportverzoeken zien",
"userDetailGrantAbilityRoles": "de rol van anderen wijzigen, ook die van jou",
"userDetailGrantAudit": "Dit wordt vastgelegd in de activiteit, op jouw naam.",
"userDetailGrantConfirm": "Toegang geven",
"userDetailRevokeTitle": "Beheerderstoegang van {{name}} intrekken?",
"userDetailRevokeBody": "Vanaf het volgende verzoek ziet {{name}} het beheer niet meer. De werkruimtes veranderen niet.",
"userDetailRevokeConfirm": "Toegang intrekken",
"userDetailCancel": "Annuleren",
"userDetailClose": "Sluiten",
"userDetailRoleError": {
  "ADMIN_ONLY": "Je hebt geen beheerderstoegang meer: een andere beheerder heeft die intussen ingetrokken. Er is niets gewijzigd.",
  "CANNOT_CHANGE_OWN_ROLE": "Je kunt je eigen rol niet wijzigen.",
  "USER_NOT_FOUND": "Deze gebruiker bestaat niet meer."
},
"userDetailRoleFailed": "De rol kon niet worden gewijzigd. Probeer het opnieuw.",
"userDetailWorkspaces": "Werkruimtes",
"userDetailWorkspacesHint": "De bedrijven waartoe deze persoon behoort, en wat die er doet.",
"userDetailWorkspaceLine": "{{role}} · lid sinds {{date}}",
"userDetailNoWorkspaces": "Hoort bij geen enkele werkruimte."
```

## Appendix B: `admin.json` activity keys (Task 6)

Each locale gets `activityKind.userRoleChanged`, and `activityType.userRoleChanged`, `_admin`, `_customer` and `unnamedUser`.

| locale | activityKind.userRoleChanged | activityType.userRoleChanged | activityType.userRoleChanged_admin | activityType.userRoleChanged_customer | activityType.unnamedUser |
|---|---|---|---|---|---|
| en-US | Role changed | Changed {{targetName}}'s role | Gave {{targetName}} admin access | Removed {{targetName}}'s admin access | a user |
| pt-MZ | Papel alterado | Alterou o papel de {{targetName}} | Deu acesso de administração a {{targetName}} | Retirou o acesso de administração a {{targetName}} | um utilizador |
| pt-PT | Papel alterado | Alterou o papel de {{targetName}} | Deu acesso de administração a {{targetName}} | Retirou o acesso de administração a {{targetName}} | um utilizador |
| es-ES | Rol cambiado | Cambió el rol de {{targetName}} | Dio acceso de administración a {{targetName}} | Quitó el acceso de administración a {{targetName}} | un usuario |
| fr-FR | Rôle modifié | Rôle de {{targetName}} modifié | Accès administrateur donné à {{targetName}} | Accès administrateur retiré à {{targetName}} | un utilisateur |
| de-DE | Rolle geändert | Rolle von {{targetName}} geändert | {{targetName}} Administratorzugriff gegeben | {{targetName}} Administratorzugriff entzogen | einem Nutzer |
| it-IT | Ruolo cambiato | Cambiato il ruolo di {{targetName}} | Dato accesso di amministrazione a {{targetName}} | Tolto l'accesso di amministrazione a {{targetName}} | un utente |
| nl-NL | Rol gewijzigd | Rol van {{targetName}} gewijzigd | {{targetName}} beheerderstoegang gegeven | Beheerderstoegang van {{targetName}} ingetrokken | een gebruiker |

Put `activityKind.userRoleChanged` last in `"activityKind"`. Put the three `userRoleChanged*` keys after `"reviewCreated"` in `"activityType"`, and `"unnamedUser"` after `"unnamedService"`.

## Appendix C: `account.json` activity keys (Task 6)

These are the same `activityType.userRoleChanged`, `_admin`, `_customer` and `unnamedUser` values as Appendix B, for each locale. There is no `activityKind` in `account.json`. They go in the same positions inside `account.json`'s `"activityType"` object.
