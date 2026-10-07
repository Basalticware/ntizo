import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck, ShieldOff } from "lucide-react";
import { Button, Skeleton } from "@ntizo/frontend-ui";
import type { AdminUserDetail } from "../domain/types";
import { RoleConfirmDialog } from "./role-confirm-dialog";
import { USER_CARD, UserCardHead } from "./user-card";

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
    <section className={USER_CARD}>
      <UserCardHead title={t("userDetailRoleSection")} hint={t("userDetailRoleHint")} />

      <div className="mt-5 grid gap-2.5">
        {loading || !change ? (
          <Skeleton className="h-[47px] w-full rounded-[var(--radius-field)]" />
        ) : change.blockedReason === "self" ? (
          <p className="m-0 flex items-start gap-3.5 rounded-[14px] bg-[var(--color-blue-softer)] p-4 text-[15px] leading-[1.45] text-[var(--color-ink-2)]">
            <Lock aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" />
            {t("userDetailSelf")}
          </p>
        ) : change.to ? (
          <Button
            type="button"
            variant={change.to === "admin" ? "default" : "outline"}
            className="w-full"
            onClick={() => setConfirmTo(change.to)}
          >
            {change.to === "admin" ? <ShieldCheck aria-hidden="true" /> : <ShieldOff aria-hidden="true" />}
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
