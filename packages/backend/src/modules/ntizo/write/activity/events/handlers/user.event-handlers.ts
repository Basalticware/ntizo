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
