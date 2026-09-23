import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { Button, Skeleton } from "@ntizo/frontend-ui";
import type { AdminUserDetail } from "../domain/types";
import { RoleConfirmDialog } from "./role-confirm-dialog";

/**
 * Whether this person administers the platform, and the one move available.
 *
 * Which move it is comes from the server (`roleChange`), exactly as the
 * provider page takes `allowedTransitions`: a button the server would then
 * refuse is worse than no button. Removing access is outline, not red; the
 * red one is the confirm inside the dialog.
 */
export function RoleSection({
  detail,
  name,
  loading,
}: {
  detail: AdminUserDetail | undefined;
  name: string | null;
  loading: boolean;
}) {
  const { t } = useTranslation("admin");
  const [confirmTo, setConfirmTo] = useState<"admin" | "customer" | null>(null);
  const change = detail?.roleChange;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
      <p className="type-caption font-bold tracking-[0.14em] text-[var(--color-muted-foreground)] uppercase">
        {t("userDetailRoleSection")}
      </p>
      <p className="type-body mt-0.5 text-[var(--color-muted-foreground)]">{t("userDetailRoleHint")}</p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {loading || !change ? (
          <Skeleton className="h-11 w-36 rounded-[var(--radius-field)]" />
        ) : change.blockedReason === "self" ? (
          <p className="type-body flex items-start gap-2 text-[var(--color-muted-foreground)]">
            <Lock className="mt-1 h-4 w-4 shrink-0" />
            {t("userDetailSelf")}
          </p>
        ) : change.to ? (
          <Button
            type="button"
            variant={change.to === "admin" ? "default" : "outline"}
            className="w-full sm:w-auto"
            onClick={() => setConfirmTo(change.to)}
          >
            {t(change.to === "admin" ? "userDetailGrant" : "userDetailRevoke")}
          </Button>
        ) : null}
      </div>

      {confirmTo && detail && name && (
        <RoleConfirmDialog
          userId={detail.id}
          name={name}
          to={confirmTo}
          onClose={() => setConfirmTo(null)}
        />
      )}
    </section>
  );
}
