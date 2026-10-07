import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";
import { Badge, Skeleton } from "@ntizo/frontend-ui";
import { EmptyCard } from "@/shared/components/empty-card";
import type { Thread } from "@/features/messaging/domain/types";

/** The reader's own requests: subject, status, and when the last thing was said. */
export function HelpRequests({
  requests,
  loading,
  errorCode,
  locale,
  onOpen,
}: {
  requests: readonly Thread[];
  loading: boolean;
  errorCode?: string;
  locale: string;
  onOpen: (threadId: string) => void;
}) {
  const { t } = useTranslation("help");
  const when = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  if (errorCode) return <p className="type-body p-4 text-[var(--color-destructive)]">{t("requestsError")}</p>;
  if (loading) {
    return (
      <div className="grid gap-2 p-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }
  if (requests.length === 0) {
    return <EmptyCard badge={Inbox} title={t("requestsEmptyTitle")} body={t("requestsEmptyBody")} />;
  }

  return (
    <ul className="grid list-none gap-2.5 p-5">
      {requests.map((request) => (
        <li key={request.id}>
          <button
            type="button"
            onClick={() => onOpen(request.id)}
            className="grid w-full gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3.5 text-left hover:border-[var(--color-blue-line)] hover:bg-[var(--color-blue-softer)]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-[15px] font-semibold text-[var(--color-headline)]">
                {request.support?.subject}
              </span>
              <Badge tone={request.support?.status === "open" ? "info" : "neutral"}>
                {t(`status.${request.support?.status ?? "open"}`)}
              </Badge>
            </span>
            <span className="flex items-center justify-between gap-2 text-[13px] text-[var(--color-muted-foreground)]">
              <span className="truncate">{request.lastMessagePreview}</span>
              <span className="shrink-0">{when.format(new Date(request.lastMessageAt))}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
