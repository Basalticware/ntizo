import { useTranslation } from "react-i18next";
import { Button } from "@ntizo/frontend-ui";
import { CustomerPageHeading } from "@/features/account/ui/customer-page";
import type { ActivityEntry } from "../domain/types";
import { useMyActivity } from "../viewmodel/use-activity";
import { describeActivity } from "../viewmodel/describe-activity";
import { ActivityList } from "./activity-list";

/**
 * What this person has done on Ntizo.
 *
 * The customer zone has no sidebar and no page header component — it is a
 * header over content — so this page carries its own title, in the size the
 * console's page heading gives every other title.
 *
 * The only one of the three zones wired to `useMyActivity()` — the provider
 * and admin feeds read a different slice of the same table and are not this
 * task's to wire. `renderDescription` delegates to `describeActivity`
 * (`viewmodel/describe-activity.ts`), which reads the `account` namespace's
 * own `activityType.*` keys and handles the null-name fallback and its
 * capitalisation — kept out of this component so it can be unit-tested
 * against real translation resources without mounting a page.
 */
export function CustomerActivityPage() {
  const { t, i18n } = useTranslation("account");
  const { entries, loading, hasMore, loadMore } = useMyActivity();

  const renderDescription = (entry: ActivityEntry) =>
    describeActivity(t, entry);

  return (
    // No centred measure: `CustomerShell` already gives the column, and a
    // narrower one inside it would lose the header's alignment.
    <div className="w-full max-w-[1400px]">
      <CustomerPageHeading title={t("activityTitle")} />
      <div className="mt-[30px]">
        <ActivityList
          entries={entries}
          loading={loading}
          locale={i18n.resolvedLanguage ?? i18n.language}
          title={t("activityListTitle")}
          hint={t("activityHint")}
          emptyTitle={t("activityEmptyTitle")}
          emptyBody={t("activityEmptyBody")}
          renderDescription={renderDescription}
        />
        {hasMore ? (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => loadMore()}>
              {t("activityLoadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
