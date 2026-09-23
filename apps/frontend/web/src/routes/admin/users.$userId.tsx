import { createFileRoute } from "@tanstack/react-router";
import { AdminUserDetailPage } from "@/features/admin/users/ui/user-detail-page";

export const Route = createFileRoute("/admin/users/$userId")({
  component: AdminUserDetailPage,
});
