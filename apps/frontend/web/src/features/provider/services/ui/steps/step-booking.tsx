import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Lock, Tag } from "lucide-react";
import { ChoiceCards } from "../choice-cards";
import type { ServiceDraft } from "../../domain/service-draft";
import type { ServiceBookingMode } from "../../domain/types";

/**
 * Step 2: how the service is charged — the question only, never the amounts.
 *
 * This is the first half of the editor's old `PricingSection`. That component
 * asked the mode and collected the options on one screen, and hid the second
 * half behind a `showOptionsEditor` flag, because `service.options.add` is
 * addressed by a service id that does not exist until the first save. The
 * wizard says the same thing with its running order instead: the mode is
 * asked here, before `CREATES_SERVICE`, and the amounts on the `pricing` step
 * after it.
 *
 * `bookingMode` is still only choosable before that first save.
 * `service.update` carries no field for it, because changing it under a
 * service that already has priced options (or a quote form) leaves one of the
 * two in a shape the other invariant refuses.
 */
export function StepBooking({
  draft,
  setDraft,
  canChangeBookingMode,
}: {
  draft: ServiceDraft;
  setDraft: Dispatch<SetStateAction<ServiceDraft>>;
  canChangeBookingMode: boolean;
}) {
  const { t } = useTranslation("provider");

  return (
    <div className="grid gap-4">
      <ChoiceCards
        name="service-booking-mode"
        legend={t("serviceBookingModeQuestion")}
        value={draft.bookingMode}
        onChange={(v) => setDraft((d) => ({ ...d, bookingMode: v as ServiceBookingMode }))}
        options={[
          {
            value: "priced",
            label: t("serviceBookingMode.priced"),
            hint: t("serviceBookingModeCardHint.priced"),
            icon: Tag,
            disabled: !canChangeBookingMode,
          },
          {
            value: "quote",
            label: t("serviceBookingMode.quote"),
            hint: t("serviceBookingModeCardHint.quote"),
            icon: FileText,
            disabled: !canChangeBookingMode,
          },
        ]}
      />
      {/* Only the lock needs saying: each card already carries its own line. */}
      {canChangeBookingMode ? null : (
        <p className="m-0 flex items-start gap-2.5 rounded-[12px] bg-[var(--color-blue-softer)] px-4 py-3 text-[14px] leading-[1.45] text-[var(--color-ink-2)]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
          {t("serviceBookingModeLocked")}
        </p>
      )}
    </div>
  );
}
