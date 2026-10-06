import { Skeleton, cn } from "@ntizo/frontend-ui";
import {
  SETTINGS_BOX,
  Section,
  SettingsLayout,
  SettingsSaveBar,
} from "./settings-shell";

/**
 * The settings page before its data arrives.
 *
 * Built from the same `SettingsLayout`, `Section`, `SETTINGS_BOX` and
 * `SettingsSaveBar` the real page uses, not from a copy of their classes —
 * card padding, icon tile, column widths and the save bar cannot drift
 * between the two states because there is one definition of each. Only the
 * content inside each card is blocked out here, at the heights the loaded
 * page draws: a label 18, a field 38, a document tile 120.
 *
 * `aria-busy` and `aria-hidden` together: a screen reader is told the region
 * is loading once, and is not then read a wall of meaningless boxes.
 */
export function SettingsSkeleton() {
  return (
    <div aria-busy="true">
      <SettingsLayout
        hero={
          <div aria-hidden="true" className={cn(SETTINGS_BOX, "flex gap-6 px-5 py-5")}>
            <Skeleton className="h-[108px] w-[105px] shrink-0 rounded-[10px]" />
            <div className="grid flex-1 content-start gap-2 pt-1.5">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-[17px] w-32" />
              <Skeleton className="h-[42px] w-full max-w-md" />
            </div>
          </div>
        }
        nav={
          <div aria-hidden="true" className={cn(SETTINGS_BOX, "hidden gap-1 px-3 pt-2.5 pb-3 lg:grid")}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex gap-4 py-3 pr-2 pl-2.5">
                <Skeleton className="mt-1 h-[21px] w-[21px] shrink-0" />
                <div className="grid flex-1 gap-1">
                  <Skeleton className="h-[19px] w-24" />
                  <Skeleton className="h-[18px] w-28" />
                </div>
              </div>
            ))}
          </div>
        }
        aside={
          <div aria-hidden="true" className={cn(SETTINGS_BOX, "p-[19px]")}>
            <Skeleton className="h-[21px] w-32" />
            <div className="mt-3.5 flex gap-3.5">
              <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
              <div className="grid flex-1 content-start gap-1.5 pt-1.5">
                <Skeleton className="h-[19px] w-36" />
                <Skeleton className="h-[38px] w-full" />
              </div>
            </div>
            <Skeleton className="mt-4 h-[260px] rounded-[9px]" />
          </div>
        }
        save={
          <SettingsSaveBar>
            <div className="mx-auto flex max-w-6xl items-center justify-end gap-3.5 py-3.5 xl:py-0" aria-hidden="true">
              <Skeleton className="h-[46px] w-28 rounded-[9px]" />
              <Skeleton className="h-[46px] w-40 rounded-[9px] xl:flex-1" />
            </div>
          </SettingsSaveBar>
        }
      >
        {/* Brand: the logo block beside the portfolio. */}
        <SectionSkeleton>
          <div className="grid gap-6">
            <div className="flex gap-5">
              <Skeleton className="h-24 w-24 shrink-0 rounded-[var(--radius-card-sm)]" />
              <div className="grid flex-1 content-start gap-1.5">
                <Skeleton className="h-[23px] w-24" />
                <Skeleton className="h-[34px] w-full" />
                <Skeleton className="mt-1.5 h-11 w-40 rounded-[var(--radius-field)]" />
              </div>
            </div>
            <div className="grid content-start gap-2.5">
              <Skeleton className="h-[18px] w-28" />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                <Skeleton className="aspect-square rounded-[var(--radius-card-sm)]" />
              </div>
            </div>
          </div>
        </SectionSkeleton>

        {/* Identity: name and the locked type, then the description. */}
        <SectionSkeleton>
          <div className="grid gap-x-[21px] gap-y-3 sm:grid-cols-2">
            <Field />
            <Field />
            <div className="grid gap-[5px] sm:col-span-2">
              <Skeleton className="h-[18px] w-24" />
              <Skeleton className="h-[92px] rounded-[7px]" />
            </div>
          </div>
        </SectionSkeleton>

        {/* Address: three, then two. */}
        <SectionSkeleton>
          <div className="grid gap-x-[21px] gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field />
            <Field />
            <Field />
            <Field />
            <Field className="lg:col-span-2" />
          </div>
        </SectionSkeleton>

        {/* Verification: the identity tile and the one paper every business needs. */}
        <SectionSkeleton>
          <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
            <Skeleton className="h-[120px] rounded-lg" />
            <Skeleton className="h-[120px] rounded-lg" />
          </div>
        </SectionSkeleton>

        {/* Danger zone. Grey, not red: nothing has loaded to be alarmed about. */}
        <SectionSkeleton>
          <Skeleton className="h-11 w-44 rounded-[var(--radius-field)]" />
        </SectionSkeleton>
      </SettingsLayout>
    </div>
  );
}

/** A section card with its heading blocked out, in the real `Section`. */
function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden="true">
      <Section
        icon={<Skeleton className="h-5 w-5" />}
        title={<Skeleton className="h-[21px] w-40" />}
        blurb={<Skeleton className="mt-1 h-[20px] w-full max-w-md" />}
      >
        {children}
      </Section>
    </div>
  );
}

/** Label plus input — the shape every field on this page has. */
function Field({ className }: { className?: string }) {
  return (
    <div className={`grid gap-[5px] ${className ?? ""}`}>
      <Skeleton className="h-[18px] w-20" />
      <Skeleton className="h-[38px] rounded-[7px]" />
    </div>
  );
}
