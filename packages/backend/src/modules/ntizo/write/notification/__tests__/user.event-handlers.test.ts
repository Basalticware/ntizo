import { beforeEach, describe, expect, it } from "bun:test";
import { NotificationType } from "@ntizo/shared";
import { EventRouter } from "../../../../../shared/infrastructure/events/event-router";
import type { RaiseNotificationInput } from "../../../bounded-contexts/notification/app/use-cases/raise-notification.internal.command";
import { UserRegistered } from "../../../bounded-contexts/user/domain/events";
import { ProviderCreated } from "../../../bounded-contexts/provider/domain/events";
import { registerUserNotificationHandlers } from "../events/handlers/user.event-handlers";

class SpyRaise {
  calls: RaiseNotificationInput[] = [];
  async execute(input: RaiseNotificationInput) {
    this.calls.push(input);
    return { notificationId: `n${this.calls.length}` };
  }
}

let router: EventRouter;
let raise: SpyRaise;

beforeEach(() => {
  router = new EventRouter();
  raise = new SpyRaise();
  registerUserNotificationHandlers(router, { raiseNotification: raise as never });
});

describe("user.registered", () => {
  it("welcomes the person, in their own inbox", async () => {
    await router.dispatch([
      new UserRegistered({ userId: "u1", email: "ana@ntizo.test", firstName: "Ana", emailVerified: true }),
    ]);

    expect(raise.calls).toHaveLength(1);
    expect(raise.calls[0]).toMatchObject({
      type: NotificationType.Welcome,
      audience: "user",
      userId: "u1",
    });
  });

  it("snapshots the first name the greeting uses", async () => {
    await router.dispatch([
      new UserRegistered({ userId: "u1", email: "ana@ntizo.test", firstName: "Ana", emailVerified: true }),
    ]);
    expect(raise.calls[0]!.payload).toEqual({ firstName: "Ana" });
  });

  it("still raises the row when no name is known", async () => {
    // A nameless welcome is a template problem, not a reason to leave a new
    // account with an empty inbox and a bell that has never lit up.
    await router.dispatch([
      new UserRegistered({ userId: "u1", email: "ana@ntizo.test", firstName: null, emailVerified: true }),
    ]);
    expect(raise.calls[0]!.payload).toEqual({ firstName: null });
  });

  it("keeps the inbox row but drops the email when the verification mail already welcomed them", async () => {
    // An e-mail sign-up gets one mail that says both "welcome" and "confirm
    // your address". A second welcome seconds later, saying the account was
    // ready, is the one people opened — while sign-in still refused them.
    await router.dispatch([
      new UserRegistered({ userId: "u1", email: "ana@ntizo.test", firstName: "Ana", emailVerified: false }),
    ]);
    expect(raise.calls).toHaveLength(1);
    expect(raise.calls[0]).toMatchObject({ type: NotificationType.Welcome, email: false });
  });

  it("still emails the welcome to an address that arrived verified", async () => {
    // A Google sign-up is never sent the verification mail, so this is the
    // only welcome in their inbox.
    await router.dispatch([
      new UserRegistered({ userId: "u1", email: "ana@ntizo.test", firstName: "Ana", emailVerified: true }),
    ]);
    expect(raise.calls[0]!.email).not.toBe(false);
  });

  it("registers only for user.registered", async () => {
    await router.dispatch([
      new ProviderCreated({ providerId: "p1", ownerUserId: "u1", type: "individual" }),
    ]);
    expect(raise.calls).toEqual([]);
  });
});
