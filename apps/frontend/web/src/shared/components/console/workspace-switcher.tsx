import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  cn,
} from "@ntizo/frontend-ui";
import { useActiveProvider } from "@/features/provider/viewmodel/use-active-provider";
import { useProviderDetail } from "@/features/provider/viewmodel/use-providers";
import { workspaceStatusBadgeKey } from "@/features/provider/domain/workspace-status";

/**
 * The same choice at the head of the phone's menu sheet, as plain rows. A
 * nested dropdown has no honest form under a thumb. Renders nothing when
 * there is only one workspace to be in.
 */
export function MobileWorkspaceSwitcher() {
  const { t } = useTranslation("provider");
  const { providers, activeProvider, setActive } = useActiveProvider();
  if (providers.length < 2) return null;

  return (
    <div className="mb-2 grid gap-1 border-b border-[var(--color-border)] pb-2">
      {providers.map((p) => {
        const isActive = p.id === activeProvider?.id;
        const badgeKey = workspaceStatusBadgeKey(p.status);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-[var(--radius-field)] px-2 py-2 text-left",
              isActive && "bg-[var(--color-muted)]",
            )}
          >
            <span className="flex aspect-square h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
              {p.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">{p.name}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {p.slug}
                {badgeKey && ` · ${t(badgeKey)}`}
              </span>
            </span>
            {isActive && <Check className="h-4 w-4 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The business at the head of the sidebar, as the mockups draw it: its logo,
 * its name, where it works — and, opened, the switch to another workspace.
 *
 * The switch used to be a sub-menu of the account menu. The mockups put the
 * business here and the person in the top bar, which is the same split the
 * account menu's own comment argued for: a person and the organizations they
 * work in are different things.
 *
 * The commission rate opens the menu. It used to be a strip under the header
 * on every page; the mockups have no strip, and the rate still has to be
 * reachable from any page, a bookmark to `/services/new` included.
 */
export function WorkspaceCard({ commission }: { commission: string | null }) {
  const { t } = useTranslation("provider");
  const { providers, activeProvider, setActive } = useActiveProvider();
  const { data: detail } = useProviderDetail(activeProvider?.id);
  const nav = useNavigate();
  const name = activeProvider?.name ?? t("noProvider");
  const place = [detail?.address?.district, detail?.address?.city].filter(Boolean).join(" • ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          type="button"
          data-slot="workspace-card"
          className="flex w-full items-center gap-4 rounded-xl text-left group-data-[collapsible=icon]:justify-center"
        >
          <Avatar className="h-[60px] w-[60px] shrink-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
            {detail?.logo?.url ? <AvatarImage src={detail.logo.url} alt="" /> : null}
            <AvatarFallback className="bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] text-sm font-semibold text-[var(--color-primary)]">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[17px] leading-tight font-bold text-[var(--color-headline)]">{name}</span>
            {place && <span className="mt-[3px] truncate text-[15px] leading-tight text-[var(--color-muted-foreground)]">{place}</span>}
          </span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-[var(--color-headline)] group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs font-normal text-[var(--color-muted-foreground)]">
          <span>{t("commissionRateLabel")}</span>
          <span className="font-semibold text-[var(--color-foreground)]">{commission ?? "—"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {providers.map((p) => {
          const isActive = p.id === activeProvider?.id;
          const badgeKey = workspaceStatusBadgeKey(p.status);
          return (
            <DropdownMenuItem key={p.id} onSelect={() => setActive(p.id)} className="py-2">
              <div className="mr-2 flex aspect-square h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">{p.slug}</span>
                {badgeKey && (
                  <span className="mt-0.5 w-fit rounded-full bg-[color-mix(in_srgb,var(--color-warning)_22%,transparent)] px-1.5 py-px text-[10px] font-medium text-[var(--color-foreground)]">
                    {t(badgeKey)}
                  </span>
                )}
              </div>
              {isActive && <Check className="ml-2 h-4 w-4" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => nav({ to: "/onboarding" })}>
          <Plus className="h-4 w-4" />
          {t("createNew")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
