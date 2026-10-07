import { useTranslation } from "react-i18next";
import { OptionsEditor } from "../options-editor";
import type { ServiceDraft } from "../../domain/service-draft";
import type { ServiceOption } from "../../domain/types";

/**
 * Step 5: what the service costs.
 *
 * The second half of the editor's old `PricingSection`, and the first step
 * that needs the service to exist — `service.options.add` is addressed by
 * service id. `wizard-model.ts` puts it after `CREATES_SERVICE` for exactly
 * that reason, and drops it altogether for a quote service, whose options the
 * server refuses outright (`SERVICE_QUOTE_HAS_OPTIONS`).
 *
 * The "save the service first" fallback survives the move, narrowed to the
 * one moment it can still happen: the create mutation has resolved and the
 * services list has not refetched yet, so this step is reachable a beat
 * before its own service appears in the cache.
 */
export function StepPricing({
  draft,
  providerId,
  serviceId,
  options,
}: {
  draft: ServiceDraft;
  providerId: string;
  /** Null until the service has been saved at least once. */
  serviceId: string | null;
  options: readonly ServiceOption[];
}) {
  const { t } = useTranslation("provider");

  if (!serviceId) {
    return (
      <p className="m-0 rounded-[14px] bg-[var(--color-blue-softer)] px-[18px] py-4 text-[15px] text-[var(--color-ink-2)]">
        {t("serviceOptionsSaveFirst")}
      </p>
    );
  }

  return (
    <OptionsEditor
      providerId={providerId}
      serviceId={serviceId}
      sourceLocale={draft.sourceLocale}
      options={options}
    />
  );
}
