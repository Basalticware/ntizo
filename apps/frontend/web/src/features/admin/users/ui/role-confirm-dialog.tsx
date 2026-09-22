import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ntizo/frontend-ui";
import { useSetPlatformRole } from "../viewmodel/use-admin-users";

/** The codes the command refuses with, each with its own sentence. */
const KNOWN_ERRORS = new Set(["ADMIN_ONLY", "CANNOT_CHANGE_OWN_ROLE", "USER_NOT_FOUND"]);

const ABILITIES = [
  "userDetailGrantAbilityBusinesses",
  "userDetailGrantAbilityCommission",
  "userDetailGrantAbilitySee",
  "userDetailGrantAbilityRoles",
] as const;

/**
 * Says what the access is before it is given or taken.
 *
 * Owns its mutation, like `CancelDialog`: the caller decides only whether it
 * is mounted. It stays open on a refusal and never closes as if it had
 * succeeded. After a refusal its only action is Close, because every refusal
 * here is one a second click would meet again.
 */
export function RoleConfirmDialog({
  userId,
  name,
  to,
  onClose,
}: {
  userId: string;
  name: string;
  to: "admin" | "customer";
  onClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const change = useSetPlatformRole(userId);
  const code = (change.error as { code?: string } | null)?.code;
  const granting = to === "admin";
  const titleId = useId();

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !change.isPending) onClose();
      }}
    >
      <DialogContent>
        {/*
         * `Dialog`/`DialogContent` draw a backdrop and a panel and nothing
         * else — no role, no name (follow-up #78, same gap `detail-gallery`
         * documents). `role="dialog"` and `aria-labelledby` are supplied here
         * for the same reason: without them this is a floating panel with no
         * boundary and no name for a screen reader, or for a test that needs
         * to scope its queries to "the dialog" rather than the whole page.
         */}
        <div role="dialog" aria-labelledby={titleId}>
          <DialogHeader>
            <DialogTitle id={titleId}>
              {t(granting ? "userDetailGrantTitle" : "userDetailRevokeTitle", { name })}
            </DialogTitle>
            <DialogDescription>
              {t(granting ? "userDetailGrantLead" : "userDetailRevokeBody", { name })}
            </DialogDescription>
          </DialogHeader>

          {granting && (
            <>
              <ul className="grid list-none gap-1.5 p-0">
                {ABILITIES.map((key) => (
                  <li key={key} className="type-body flex gap-2">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    {t(key)}
                  </li>
                ))}
              </ul>
              <p className="type-caption text-[var(--color-muted-foreground)]">{t("userDetailGrantAudit")}</p>
            </>
          )}

          {change.isError && (
            <p role="alert" className="type-body text-[var(--color-destructive)]">
              {code && KNOWN_ERRORS.has(code) ? t(`userDetailRoleError.${code}`) : t("userDetailRoleFailed")}
            </p>
          )}

          <DialogFooter>
            {change.isError ? (
              <Button type="button" variant="outline" onClick={onClose}>
                {t("userDetailClose")}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={onClose} disabled={change.isPending}>
                  {t("userDetailCancel")}
                </Button>
                <Button
                  type="button"
                  variant={granting ? "default" : "destructive"}
                  disabled={change.isPending}
                  onClick={() => change.mutate(to, { onSuccess: onClose })}
                >
                  {change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t(granting ? "userDetailGrantConfirm" : "userDetailRevokeConfirm")}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
