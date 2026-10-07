import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
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

  return (
    <div className="flex w-full max-w-[1400px] flex-col">
      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* The step rail, in the settings page's rail: one white box, the
            current step on the soft blue ground with the brand bar on its
            left edge. Hidden below `lg`, where the card's own bar and counter
            say the same thing in the room a phone has. */}
        <nav aria-label={title} className="hidden lg:block">
          <ol className="sticky top-6 m-0 grid list-none gap-1 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] px-3 pt-2.5 pb-3">
            {vm.steps.map((step, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              const reachable = vm.isReachable(step, vm.step);
              return (
                <li key={step} className="relative min-w-0">
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 -left-3 h-[50px] w-[3px] -translate-y-1/2 rounded-r-sm bg-[var(--color-primary)]"
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
                      "flex w-full gap-3.5 rounded-[9px] py-3 pr-2 pl-2.5 text-left transition-colors",
                      active
                        ? "bg-[var(--color-blue-soft)] text-[var(--color-primary)]"
                        : "text-[var(--color-headline)]",
                      reachable
                        ? "cursor-pointer"
                        : "cursor-default",
                      reachable && !active && "hover:bg-[color-mix(in_srgb,var(--color-blue-soft)_50%,transparent)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold tabular-nums",
                        done && "border-[var(--color-primary)] bg-[var(--color-primary)] text-white",
                        active && "border-[var(--color-primary)] bg-[var(--color-card)] text-[var(--color-primary)]",
                        !done && !active && "border-[var(--color-border)] text-[var(--color-muted-foreground)]",
                      )}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span
                        className={cn(
                          "truncate text-[14.5px] leading-[19px] font-medium",
                          !done && !active && "text-[var(--color-muted-foreground)]",
                        )}
                      >
                        {labels[step]}
                      </span>
                      <span className="mt-0.5 text-[13px] leading-[1.4] text-[var(--color-muted-foreground)]">
                        {t("serviceStepStatus.stepPrefix")} {i + 1}
                        {done || active ? (
                          <>
                            {" · "}
                            <span className="font-medium text-[var(--color-primary)]">
                              {done ? t("serviceStepStatus.done") : t("serviceStepStatus.active")}
                            </span>
                          </>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="min-w-0 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-8">
          {/* The phone's version of the rail: a count and a bar. A seven-row
              rail above a form on a 390px screen would push the first field
              below the fold. */}
          <div className="mb-7 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <span className="truncate text-[15px] font-semibold text-[var(--color-headline)]">
                {labels[vm.step]}
              </span>
              <span className="shrink-0 rounded-full bg-[var(--color-blue-soft)] px-3 py-1 text-[13px] font-semibold text-[var(--color-primary)] tabular-nums">
                {t("serviceStepStatus.stepPrefix")} {currentIndex + 1}/{total}
              </span>
            </div>
            <div className="mt-3.5 h-1 rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
              />
            </div>
          </div>

          {vm.errorCode ? (
            <p className="mb-6 rounded-[10px] bg-[color-mix(in_srgb,var(--color-destructive)_8%,transparent)] px-4 py-3 text-[15px] font-medium text-[var(--color-bad-fg)]">
              {t(`serviceError.${vm.errorCode}`, { defaultValue: t("serviceSaveFailed") })}
            </p>
          ) : null}

          <header className="mb-7 border-b border-[var(--color-line-2)] pb-6">
            <h2 className="m-0 text-[22px] leading-tight font-bold text-[var(--color-headline)]">
              {t(`serviceStepTitle.${vm.step}`)}
            </h2>
            <p className="mt-2 mb-0 max-w-[62ch] text-[15px] leading-[1.5] text-[var(--color-muted-foreground)]">
              {t(`serviceStepDescription.${vm.step}`)}
            </p>
          </header>

          <div className="max-w-[760px]">
            {renderStep()}

            {/* Only the essentials have anything `stepBlocks` can refuse —
                every other step either always carries a value or writes
                through its own mutation, so this is the one place that
                message is ever shown. */}
            {vm.showStepError && vm.step === "basics" ? (
              <p className="mt-4 mb-0 text-sm text-[var(--color-destructive)]">
                {t("serviceStepIncomplete")}
              </p>
            ) : null}
          </div>

          {/* The actions under every screen. The primary is last, which is
              where a thumb reaches on a phone and where the eye lands after
              the final field. */}
          <footer className="mt-9 grid gap-3 border-t border-[var(--color-line-2)] pt-6 sm:flex sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={vm.back}
            >
              <ArrowLeft aria-hidden="true" />
              {t("serviceWizardBack")}
            </Button>
            <div className="grid gap-3 sm:flex sm:justify-end">
              {/* Only once there is something to save and somewhere to
                  return to. On a brand-new service the primary button *is*
                  the save. */}
              {vm.saved ? (
                <Button type="button" variant="secondary" onClick={() => void vm.saveAndExit()}>
                  {t("serviceWizardSaveExit")}
                </Button>
              ) : null}
              {isReview ? (
                <Button
                  type="button"
                  disabled={!vm.canPublish || vm.blocker !== null || vm.statusChanging}
                  onClick={() => void vm.changeStatus("published")}
                >
                  {vm.statusChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("servicePublish")}
                </Button>
              ) : (
                <Button type="button" disabled={vm.saving} onClick={() => void vm.advance()}>
                  {vm.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("serviceWizardContinue")}
                </Button>
              )}
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
