import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button, buttonVariants, cn } from "@ntizo/frontend-ui";
import { usePageAction, usePageHeader } from "@/shared/lib/page-header";
import { useServiceWizard } from "../viewmodel/use-service-wizard";
import type { ServiceStep } from "../domain/wizard-model";
import { StepBasics } from "./steps/step-basics";
import { StepBooking } from "./steps/step-booking";
import { StepPerformers } from "./steps/step-performers";
import { StepPricing } from "./steps/step-pricing";
import { StepImages } from "./steps/step-images";
import { StepLanguages } from "./steps/step-languages";
import { StepReview } from "./steps/step-review";

/**
 * Creating and editing a service, as the same wizard the provider met during
 * onboarding.
 *
 * It replaces a section-rail editor whose every screen carried a status badge,
 * a progress ring and a sticky save bar. That page answered "what is left?" on
 * all five sections at once, which is the right question for an editor and the
 * wrong one for a first-time creation: a provider filling in a name read the
 * publish blocker for options as a complaint rather than as step five.
 *
 * Drawn in the console's own frames rather than onboarding's full-screen
 * wizard chrome: the page title in the console heading, a step rail in the
 * settings page's rail on the left, and the step in one card beside it — the
 * question as the card's heading, the fields, and the actions in its foot.
 * The step list comes from `wizard-model.ts` and varies per service; nothing
 * here decides anything. Which steps exist, which are reachable and when the
 * server is spoken to all live in the domain and the viewmodel.
 */
export function ServiceWizardPage() {
  const { t, i18n } = useTranslation("provider");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const vm = useServiceWizard();
  const title = t(vm.serviceId ? "serviceEdit" : "serviceNew");
  const slug = vm.provider?.slug;

  usePageHeader(title);
  usePageAction(
    slug ? (
      <Link
        to="/provider/$slug/services"
        params={{ slug }}
        className={buttonVariants({ variant: "outline" })}
      >
        <ArrowLeft aria-hidden="true" />
        {t("servicesTitle")}
      </Link>
    ) : null,
    [slug, t],
  );

  if (!vm.provider) return null;
  // Rebound so TypeScript can prove it stays non-null inside the closures below.
  const provider = vm.provider;

  const labels = Object.fromEntries(
    vm.steps.map((step) => [step, t(`serviceStep.${step}`)]),
  ) as Record<ServiceStep, string>;

  const isReview = vm.step === "review";
  const memberError = vm.memberErrorCode ? t(`serviceError.${vm.memberErrorCode}`) : undefined;

  function renderStep() {
    switch (vm.step) {
      case "basics":
        return (
          <StepBasics
            draft={vm.draft}
            setDraft={vm.setDraft}
            categories={vm.categories}
            locationChoice={vm.locationChoice}
            onLocationChoiceChange={vm.setLocationChoice}
          />
        );
      case "booking":
        return (
          <StepBooking
            draft={vm.draft}
            setDraft={vm.setDraft}
            canChangeBookingMode={vm.canChangeBookingMode}
          />
        );
      case "performers":
        return (
          <StepPerformers
            draft={vm.draft}
            setDraft={vm.setDraft}
            members={vm.members}
            {...(memberError ? { error: memberError } : {})}
            onErrorClear={vm.clearMemberError}
          />
        );
      case "pricing":
        return (
          <StepPricing
            draft={vm.draft}
            providerId={provider.id}
            serviceId={vm.serviceId}
            options={vm.current?.options ?? []}
          />
        );
      case "images":
        return (
          <StepImages
            providerId={provider.id}
            imageKeys={vm.draft.imageKeys}
            imageUrls={vm.current?.imageUrls ?? []}
            onChange={(next) => vm.setDraft((d) => ({ ...d, imageKeys: next }))}
          />
        );
      case "languages":
        // Needs a saved service: `service.translation.set` addresses rows by
        // service id. Reachable only after `CREATES_SERVICE`, so the fallback
        // covers just the beat between the create resolving and the list
        // refetching.
        return vm.current ? (
          <StepLanguages service={vm.current} providerId={provider.id} />
        ) : (
          <p className="type-body text-[var(--color-muted-foreground)]">
            {t("serviceTranslationsSaveFirst")}
          </p>
        );
      case "review":
        return (
          <StepReview
            service={vm.current}
            categoryLabel={
              vm.categories.options.find((o) => o.value === vm.draft.categoryId)?.label ?? ""
            }
            memberNames={vm.members
              .filter((m) => vm.draft.memberIds.includes(m.memberId))
              .map((m) => m.name ?? m.userId)}
            locale={locale}
            showPerformers={vm.steps.includes("performers")}
            blocker={vm.blocker}
            blockerStep={vm.blockerStep}
            onSeek={vm.seek}
            canPublish={vm.canPublish}
            busy={vm.statusChanging}
            onChangeStatus={(status) => void vm.changeStatus(status)}
          />
        );
      default:
        return null;
    }
  }

  const currentIndex = vm.steps.indexOf(vm.step);
  const total = vm.steps.length;
  const progress = t("serviceStepProgress", { current: currentIndex + 1, total });
  const progressBar = (
    <div
      role="progressbar"
      aria-label={progress}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={currentIndex + 1}
      className="h-1 overflow-hidden rounded-full bg-[var(--color-line-2)] dark:bg-[var(--color-muted)]"
    >
      <div
        className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
        style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
      />
    </div>
  );

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* The step rail: where this is, how far it goes, and what each later
            screen will ask. Hidden below `lg`, where the card's own count and
            bar say the same thing in the room a phone has. */}
        <nav aria-label={title} className="sticky top-6 hidden lg:block">
          <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="m-0 text-[13px] font-semibold text-[var(--color-muted-foreground)] tabular-nums">
              {progress}
            </p>
            <div className="mt-3 mb-5">{progressBar}</div>
            <ol className="m-0 grid list-none gap-1 p-0">
              {vm.steps.map((step, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                const reachable = vm.isReachable(step, vm.step);
                const last = i === total - 1;
                return (
                  <li key={step} className="relative min-w-0">
                    {/* The thread between markers, blue as far as the
                        provider has come. */}
                    {!last && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute top-[38px] bottom-[-10px] left-[23px] w-0.5 rounded-full",
                          done
                            ? "bg-[var(--color-primary)]"
                            : "bg-[var(--color-line-2)] dark:bg-[var(--color-muted)]",
                        )}
                      />
                    )}
                    <button
                      type="button"
                      disabled={!reachable}
                      // The rail is a list of destinations and one of them is
                      // where you are. Sighted readers get that from the
                      // filled marker; without this a screen reader hears
                      // interchangeable buttons.
                      {...(active ? { "aria-current": "step" as const } : {})}
                      onClick={() => reachable && vm.seek(step)}
                      className={cn(
                        "relative flex w-full items-center gap-3.5 rounded-[10px] px-2.5 py-2 text-left transition-colors",
                        active && "bg-[var(--color-blue-softer)]",
                        reachable ? "cursor-pointer" : "cursor-default",
                        reachable && !active && "hover:bg-[var(--color-blue-softer)]",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold tabular-nums",
                          done &&
                            "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]",
                          active &&
                            "border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary)] ring-4 ring-[var(--color-blue-soft)]",
                          !done &&
                            !active &&
                            "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]",
                        )}
                      >
                        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[15px] leading-5",
                          active
                            ? "font-semibold text-[var(--color-primary)]"
                            : done
                              ? "font-medium text-[var(--color-headline)]"
                              : "font-medium text-[var(--color-muted-foreground)]",
                        )}
                      >
                        {labels[step]}
                        {/* The marker's meaning, for anyone who cannot see it. */}
                        {done || active ? (
                          <span className="sr-only">
                            {` · ${done ? t("serviceStepStatus.done") : t("serviceStepStatus.active")}`}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <section className="min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="px-5 pt-6 pb-8 sm:px-10 sm:pt-9 sm:pb-10">
            {/* The phone's version of the rail: a count and a bar. A six-row
                rail above a form on a 390px screen would push the first field
                below the fold. */}
            <div className="mb-7 grid gap-3 lg:hidden">
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate text-[14px] font-semibold text-[var(--color-primary)]">
                  {labels[vm.step]}
                </span>
                <span className="shrink-0 text-[13px] font-medium text-[var(--color-muted-foreground)] tabular-nums">
                  {progress}
                </span>
              </div>
              {progressBar}
            </div>

            {vm.errorCode ? (
              <p className="mb-6 rounded-[10px] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] px-4 py-3 text-[15px] font-medium text-[var(--color-bad-fg)]">
                {t(`serviceError.${vm.errorCode}`, { defaultValue: t("serviceSaveFailed") })}
              </p>
            ) : null}

            <header className="mb-8 max-w-[720px]">
              <h2 className="m-0 text-[24px] leading-[1.2] font-bold tracking-[-0.01em] text-[var(--color-headline)] sm:text-[28px]">
                {t(`serviceStepTitle.${vm.step}`)}
              </h2>
              <p className="mt-2.5 mb-0 max-w-[60ch] text-[15px] leading-[1.55] text-[var(--color-muted-foreground)]">
                {t(`serviceStepDescription.${vm.step}`)}
              </p>
            </header>

            <div className="max-w-[720px]">
              {renderStep()}

              {/* Only the essentials have anything `stepBlocks` can refuse —
                  every other step either always carries a value or writes
                  through its own mutation, so this is the one place that
                  message is ever shown. */}
              {vm.showStepError && vm.step === "basics" ? (
                <p className="mt-5 mb-0 text-sm font-medium text-[var(--color-bad-fg)]">
                  {t("serviceStepIncomplete")}
                </p>
              ) : null}
            </div>
          </div>

          {/* The actions, pinned to the bottom of the viewport while the step
              runs longer than the screen. The primary is last, which is where
              a thumb reaches on a phone and where the eye lands after the
              final field. */}
          <footer className="sticky bottom-0 z-10 flex items-center gap-2 rounded-b-[14px] border-t border-[var(--color-line-2)] bg-[var(--color-card)] px-4 py-3.5 sm:gap-3 sm:px-10 sm:py-4">
            <Button type="button" variant="outline" onClick={vm.back} className="mr-auto max-sm:w-11 max-sm:px-0">
              <ArrowLeft aria-hidden="true" />
              <span className="max-sm:sr-only">{t("serviceWizardBack")}</span>
            </Button>
            {/* Only once there is something to save and somewhere to return
                to. On a brand-new service the primary button *is* the save. */}
            {vm.saved ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void vm.saveAndExit()}
                className="px-3 text-[var(--color-primary)]"
              >
                {t(
                  vm.current?.status === "published"
                    ? "serviceWizardSaveExit"
                    : "serviceWizardSaveDraft",
                )}
              </Button>
            ) : null}
            {isReview ? (
              <Button
                type="button"
                disabled={!vm.canPublish || vm.blocker !== null || vm.statusChanging}
                className="max-sm:flex-1"
                onClick={() => void vm.changeStatus("published")}
              >
                {vm.statusChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("servicePublish")}
              </Button>
            ) : (
              <Button type="button" disabled={vm.saving} onClick={() => void vm.advance()} className="max-sm:flex-1">
                {vm.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("serviceWizardContinue")}
                {vm.saving ? null : <ArrowRight aria-hidden="true" />}
              </Button>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}
