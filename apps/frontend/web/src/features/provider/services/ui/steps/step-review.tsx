import { useTranslation } from "react-i18next";
import { ArrowRight, Check, ImageIcon, Pencil } from "lucide-react";
import { Badge, Button, cn } from "@ntizo/frontend-ui";
import type { ServiceStatus } from "@ntizo/shared";
import type { PublishBlocker } from "../../domain/completeness";
import type { ServiceStep } from "../../domain/wizard-model";
import {
  formatOptionPrice,
  optionSourceName,
  ownerName,
  translatedCount,
  orderedLocales,
  STATUS_TONE,
  type ProviderService,
} from "../../domain/types";

/**
 * Step 6: everything the wizard asked, in one place, before it goes out.
 *
 * A review screen that says only "nothing is blocking you" is not a review —
 * it asks the provider to remember five screens rather than showing them. So
 * it opens on the service roughly as a customer will meet it — cover, name,
 * where and what it is — and then lists every answer under the step that set
 * it, each with its own way back. Publishing is a decision, and a decision
 * needs what it is about in front of it.
 *
 * This is also where the editor's old header and sticky bar ended up. That
 * page carried the status badge, the unpublish and archive buttons and the
 * publish blocker at the top of *every* section, so somebody filling in
 * prices read "a priced service needs at least one option" as a permanent
 * complaint rather than as the one thing left to do. Here it is a verdict,
 * delivered once, on the screen whose job is to deliver it.
 */
export function StepReview({
  service,
  categoryLabel,
  memberNames,
  locale,
  showPerformers,
  blocker,
  blockerStep,
  onSeek,
  canPublish,
  busy,
  onChangeStatus,
}: {
  /** Null in the beat between the create mutation resolving and the list refetching. */
  service: ProviderService | null;
  categoryLabel: string;
  memberNames: readonly string[];
  locale: string;
  /** Whether this shape asks the performers question at all. */
  showPerformers: boolean;
  blocker: PublishBlocker;
  /**
   * The step that would fix `blocker`, when there is one to point at.
   *
   * Null for `PROVIDER_NOT_ACTIVE`: no step in this wizard can approve a
   * workspace, so the banner states it and stays unclickable rather than
   * sending somebody to a form that was never the problem.
   */
  blockerStep: ServiceStep | null;
  onSeek: (step: ServiceStep) => void;
  /** Owners and admins publish; other members do not. */
  canPublish: boolean;
  busy: boolean;
  onChangeStatus: (status: ServiceStatus) => void;
}) {
  const { t } = useTranslation("provider");

  if (!service) {
    return (
      <p className="type-body text-[var(--color-muted-foreground)]">
        {t("serviceTranslationsSaveFirst")}
      </p>
    );
  }

  const source = service.translations.find((tr) => tr.locale === service.sourceLocale);
  const languageCount = translatedCount(service);
  const languageTotal = orderedLocales(service.sourceLocale).length;
  const where =
    service.locationType === "remote"
      ? t("serviceLocationRemote")
      : t(`serviceLocationType.${service.locationType}`, { defaultValue: service.locationType });
  const cover = service.imageUrls[0] ?? null;
  const photoCount = service.imageKeys.length;

  return (
    <div className="grid gap-6">
      {/* What will be published, roughly as a customer meets it. */}
      <article className="grid overflow-hidden rounded-[14px] border border-[var(--color-border)] sm:grid-cols-[200px_minmax(0,1fr)]">
        {/* An empty cover is worth a corner on a wide screen and nothing on a
            phone, where it would push the answers below the fold. */}
        <div
          className={cn(
            "grid aspect-[16/9] place-items-center bg-[var(--color-blue-softer)] sm:aspect-auto sm:min-h-[150px]",
            !cover && "max-sm:hidden",
          )}
        >
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon aria-hidden="true" className="h-7 w-7 text-[var(--color-blue-line)]" />
          )}
        </div>
        <div className="grid content-start gap-2 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="m-0 min-w-0 text-[19px] leading-tight font-bold break-words text-[var(--color-headline)]">
              {source?.name ?? ownerName(service, locale)}
            </p>
            <Badge tone={STATUS_TONE[service.status]}>{t(`servicesStatus.${service.status}`)}</Badge>
          </div>
          <p className="m-0 text-[14px] text-[var(--color-muted-foreground)]">
            {[categoryLabel, where].filter(Boolean).join(" · ")}
          </p>
          {source?.description ? (
            <p className="m-0 line-clamp-3 text-[15px] leading-[1.5] text-[var(--color-ink-2)]">
              {source.description}
            </p>
          ) : null}
        </div>
      </article>

      {/* Every answer, under the step that set it, with the way back beside
          it: finding a mistake here and having to hunt the rail for where it
          lives is the whole reason a review screen feels like a formality. */}
      <div className="grid divide-y divide-[var(--color-line-2)] rounded-[14px] border border-[var(--color-border)]">
        <Section title={t("serviceStep.basics")} step="basics" onSeek={onSeek}>
          <Fact label={t("serviceCategory")}>{categoryLabel || <Missing />}</Fact>
          <Fact label={t("serviceLocationQuestion")}>{where}</Fact>
        </Section>

        <Section title={t("serviceStep.booking")} step="booking" onSeek={onSeek}>
          <Fact>{t(`serviceBookingMode.${service.bookingMode}`)}</Fact>
        </Section>

        {showPerformers && (
          <Section title={t("serviceStep.performers")} step="performers" onSeek={onSeek}>
            <Fact>{memberNames.length > 0 ? memberNames.join(", ") : <Missing />}</Fact>
          </Section>
        )}

        {service.bookingMode === "priced" && (
          <Section title={t("serviceStep.pricing")} step="pricing" onSeek={onSeek}>
            {service.options.length === 0 ? (
              <Fact>
                <Missing />
              </Fact>
            ) : (
              service.options.map((option) => (
                <Fact key={option.id} label={optionSourceName(option, service.sourceLocale)}>
                  <span className="font-semibold text-[var(--color-headline)] tabular-nums">
                    {formatOptionPrice(option, locale)}
                  </span>
                </Fact>
              ))
            )}
          </Section>
        )}

        <Section title={t("serviceStep.images")} step="images" onSeek={onSeek}>
          {photoCount === 0 ? (
            <Fact>
              <Missing />
            </Fact>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {service.imageUrls.slice(0, 4).map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-11 w-14 rounded-[8px] border border-[var(--color-border)] object-cover"
                />
              ))}
              <span className="text-[14px] text-[var(--color-muted-foreground)] tabular-nums">
                {t("serviceReviewPhotos", { count: photoCount })}
              </span>
            </div>
          )}
        </Section>

        <Section title={t("serviceStep.languages")} step="languages" onSeek={onSeek}>
          <Fact>
            <span className="tabular-nums">
              {languageCount}/{languageTotal}
            </span>
          </Fact>
        </Section>
      </div>

      {blocker ? (
        <button
          type="button"
          onClick={() => blockerStep && onSeek(blockerStep)}
          disabled={!blockerStep}
          className="flex items-center gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] px-[18px] py-3.5 text-left text-[15px] text-[var(--color-bad-fg)] enabled:cursor-pointer enabled:hover:underline"
        >
          <span className="flex-1">{t(`serviceError.${blocker}`)}</span>
          {blockerStep ? <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
        </button>
      ) : (
        <p className="m-0 flex items-center gap-2.5 rounded-[14px] bg-[var(--color-blue-softer)] px-[18px] py-3.5 text-[15px] font-medium text-[var(--color-primary)]">
          <Check className="h-4 w-4 shrink-0" />
          {t("serviceReviewReady")}
        </p>
      )}

      {/* Leaving the marketplace, for a service already on it. Not in the
          footer beside Publish: these two undo each other, and a row that
          offers both at once invites the wrong one. */}
      {canPublish ? (
        <div className="flex flex-wrap gap-2.5">
          {service.status === "published" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onChangeStatus("draft")}
            >
              {t("serviceUnpublish")}
            </Button>
          ) : null}
          {service.status !== "archived" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onChangeStatus("archived")}
            >
              {t("serviceArchive")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One step's answers, titled by the step and with its own way back to it. */
function Section({
  title,
  step,
  onSeek,
  children,
}: {
  title: string;
  step: ServiceStep;
  onSeek: (step: ServiceStep) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation("provider");
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-start sm:gap-5">
      <h3 className="m-0 text-[14px] leading-6 font-semibold text-[var(--color-headline)]">
        {title}
      </h3>
      <div className="col-span-2 grid min-w-0 gap-1.5 sm:col-span-1">{children}</div>
      <button
        type="button"
        onClick={() => onSeek(step)}
        className="inline-flex cursor-pointer items-center gap-1.5 justify-self-end rounded-[8px] text-[14px] leading-6 font-semibold text-[var(--color-primary)] hover:underline max-sm:col-start-2 max-sm:row-start-1"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        {t("serviceReviewEdit")}
        <span className="sr-only"> {title}</span>
      </button>
    </section>
  );
}

/** One answer, with its own label when the section holds more than one. */
function Fact({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <p className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-2 text-[15px] leading-6 break-words text-[var(--color-ink-2)]">
      {label ? <span className="text-[var(--color-muted-foreground)]">{label}</span> : null}
      {label ? <span aria-hidden="true" className="text-[var(--color-faint)]">·</span> : null}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** An answer that has not been given, said plainly rather than left blank. */
function Missing() {
  const { t } = useTranslation("provider");
  return (
    <span className="text-[var(--color-muted-foreground)] italic">{t("serviceReviewMissing")}</span>
  );
}
