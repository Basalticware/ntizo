import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";
import { Button } from "@ntizo/frontend-ui";
import { usePageHeader } from "@/shared/lib/page-header";
import { providerErrorMessage } from "../viewmodel/error-message";
import { useRegisterMe } from "../viewmodel/use-provider-mutations";
import { useActiveProvider } from "../viewmodel/use-active-provider";
import { CreateProviderDialog } from "./create-provider-dialog";

export function NoProviderPage() {
  const { t } = useTranslation("provider");
  const nav = useNavigate();
  const registerMut = useRegisterMe();
  const { setActive, refresh } = useActiveProvider();
  const [dialogOpen, setDialogOpen] = useState(false);

  usePageHeader(t("welcomeTitle"), t("welcomeSubtitle"));

  async function handleAuto() {
    try {
      const { providerId } = await registerMut.mutateAsync({});
      await refresh();
      if (providerId) setActive(providerId);
      nav({ to: "/provider" });
    } catch {
      /* error state via mutation */
    }
  }

  return (
    // The title and the sentence under it are the console heading's, set
    // above with `usePageHeader`; the page itself is the one card of choices.
    <div className="w-full max-w-[720px]">
      <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-card)] p-5 md:p-6">
        <div className="flex gap-[18px] rounded-[14px] bg-[var(--color-blue-softer)] p-[18px]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-blue-soft)] text-[var(--color-primary)]">
            <Store aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="m-0 self-center text-[15px] leading-[1.5] text-[var(--color-ink-2)]">
            {t("welcomeSubtitle")}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:flex">
          <Button onClick={handleAuto} disabled={registerMut.isPending}>
            {registerMut.isPending ? t("settingUp") : t("setMeUpAutomatically")}
          </Button>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            {t("createManually")}
          </Button>
        </div>

        {registerMut.error && (
          <p className="mt-4 mb-0 text-sm text-[var(--color-destructive)]">
            {providerErrorMessage(t, registerMut.error)}
          </p>
        )}
      </section>

      <CreateProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => {
          setActive(id);
          nav({ to: "/provider" });
        }}
      />
    </div>
  );
}
