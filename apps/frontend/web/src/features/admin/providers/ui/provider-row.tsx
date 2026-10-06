import { Link } from "@tanstack/react-router";
import { ProviderStatus } from "@ntizo/shared";
import { AdminPerson } from "@/features/admin/shared/ui/admin-list";
import type { AdminProvider } from "../domain/types";

export const PROVIDER_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  [ProviderStatus.Active]: "success",
  [ProviderStatus.Pending]: "warning",
  [ProviderStatus.Rejected]: "danger",
  [ProviderStatus.Suspended]: "danger",
  [ProviderStatus.Archived]: "info",
};

/**
 * Who the row is about: the monogram, the name, and where they are — the
 * admin lists' person cell, for the dashboard's latest applications.
 *
 * Initials rather than a type icon: a briefcase against a person told you
 * what kind of provider it was, which is not what somebody scanning a queue
 * is looking for. A monogram gives each business a shape you can find again.
 */
export function ProviderBusiness({ provider }: { provider: AdminProvider }) {
  return (
    <AdminPerson
      name={provider.name}
      className="max-w-[360px]"
      title={
        <Link
          to="/admin/providers/$providerId"
          params={{ providerId: provider.id }}
          className="hover:underline"
        >
          {provider.name}
        </Link>
      }
      sub={
        <span className="truncate">
          {[provider.city, provider.country].filter(Boolean).join(", ") || provider.slug}
        </span>
      }
    />
  );
}
