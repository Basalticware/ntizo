import { bootstrapNotification } from "@ntizo/backend/modules/ntizo/bounded-contexts/notification";
import { bootstrapCommunication } from "@ntizo/backend/modules/ntizo/bounded-contexts/communication";
import { bootstrapBooking } from "@ntizo/backend/modules/ntizo/bounded-contexts/booking";
import { bootstrapQuote } from "@ntizo/backend/modules/ntizo/bounded-contexts/quote";
import { AttachmentStorageAdapter } from "../attachment-storage.adapter";
import { bookingOpenerForCron, disputeThreadForCron, startThreadForCron } from "./sweeps";

/** The earliest of the dates given, ignoring contexts with nothing due; null when none has anything. */
export function earliestOf(...candidates: Array<Date | null>): Date | null {
  let earliest: Date | null = null;
  for (const candidate of candidates) {
    if (candidate && (!earliest || candidate.getTime() < earliest.getTime())) earliest = candidate;
  }
  return earliest;
}

/**
 * When any of the four sweeps next has work: the earliest of the three
 * contexts' own answers. Must run inside an `infraStore.runAsync` scope.
 *
 * Asked one context at a time, not with `Promise.all`: the scope's postgres
 * pool is `{ max: 1 }`, so parallel asks only queue behind each other.
 *
 * The bootstraps are the same cheap object graphs `runSweeps` builds, with the
 * same never-called dependencies; see the comments there.
 */
export async function computeNextDueAt(): Promise<Date | null> {
  const raiseNotification = bootstrapNotification().useCases.internal.raiseNotification;
  const communication = bootstrapCommunication({
    raiseNotification,
    attachmentStorage: new AttachmentStorageAdapter(),
  });
  const booking = bootstrapBooking({ raiseNotification, openDisputeThread: disputeThreadForCron() });
  const quote = bootstrapQuote({
    raiseNotification,
    openBooking: bookingOpenerForCron(),
    startThread: startThreadForCron(),
    attachmentStorage: new AttachmentStorageAdapter(),
  });

  const notice = await communication.useCases.internal.nextNoticeDueAt.execute();
  const bookingDue = await booking.useCases.internal.nextDueAt.execute();
  const quoteDue = await quote.useCases.internal.nextDueAt.execute();
  return earliestOf(notice, bookingDue, quoteDue);
}
