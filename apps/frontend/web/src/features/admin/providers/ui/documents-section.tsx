import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ExternalLink, Eye, FileText, Loader2 } from "lucide-react";
import { Badge, Button, Input, Skeleton, cn } from "@ntizo/frontend-ui";
import { ProviderDocumentStatus } from "@ntizo/shared";
import { documentUrl } from "../data/admin-provider.repository";
import { useReviewDocument } from "../viewmodel/use-admin-providers";
import type { AdminProviderDocument } from "../domain/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  [ProviderDocumentStatus.Accepted]: "success",
  [ProviderDocumentStatus.Pending]: "warning",
  [ProviderDocumentStatus.Rejected]: "danger",
  [ProviderDocumentStatus.Superseded]: "neutral",
};

/**
 * The papers that stand today, one tile each, for the overview's
 * "Documentos de verificação" card: the kind, its state and the file, with
 * the eye opening it. The decision on each lives on the Documents tab, where
 * the reviewer has room to write a reason.
 *
 * A document glyph instead of the mockup's thumbnail: these are PDFs as
 * often as images, and the read says nothing about what the first page
 * looks like.
 */
export function DocumentTiles({
  documents,
  loading,
}: {
  documents: readonly AdminProviderDocument[];
  loading: boolean;
}) {
  const { t } = useTranslation("admin");

  if (loading) {
    return (
      <div className="mt-[18px] grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[150px] rounded-[9px]" />
        ))}
      </div>
    );
  }
  if (documents.length === 0) {
    return (
      <p className="mt-[18px] mb-0 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {t("providerDetailNoDocuments")}
      </p>
    );
  }
  return (
    <ul className="mt-[18px] mb-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-4">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex min-w-0 flex-col items-start rounded-[9px] border border-[var(--color-border)] px-[9px] pt-2.5 pb-3"
        >
          <span className="grid h-[52px] w-[42px] place-items-center self-center rounded-md bg-[var(--color-muted)] text-[var(--color-primary)]">
            <FileText aria-hidden="true" className="h-6 w-6" />
          </span>
          <b className="mt-2.5 block text-sm leading-[1.3] font-bold text-[var(--color-headline)]">
            {t(`documentType.${doc.type}`, { defaultValue: doc.type })}
          </b>
          <Badge tone={STATUS_TONE[doc.status] ?? "neutral"} className="mt-2 mb-3 h-[26px] px-3 text-[13px]">
            {t(`documentStatus.${doc.status}`, { defaultValue: doc.status })}
          </Badge>
          <footer className="mt-auto flex w-full items-center justify-between gap-1.5">
            <span className="min-w-0 truncate text-[13px] text-[var(--color-faint)]">{doc.fileName || "—"}</span>
            {/* A new tab, not an inline preview: the browser's own viewer
                handles PDFs and images better than anything built here. */}
            <a
              href={documentUrl(doc.id)}
              target="_blank"
              rel="noreferrer"
              aria-label={t("providerDetailOpenDocument")}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] border border-[var(--color-blue-line)] text-[var(--color-primary)] hover:bg-[var(--color-blue-soft)]"
            >
              <Eye aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </footer>
        </li>
      ))}
    </ul>
  );
}

/**
 * The papers the provider sent, and the decision about each.
 *
 * Superseded rows stay in the list. The reason the table is append-only is
 * that an approved identity document could otherwise be swapped for a forged
 * one afterwards, and a reviewer who cannot see that a document was replaced
 * has no way to notice that it happened. They are visibly retired rather than
 * hidden.
 */
export function DocumentsSection({
  providerId,
  documents,
  reverificationRequestedAt,
  loading,
}: {
  providerId: string;
  documents: readonly AdminProviderDocument[];
  reverificationRequestedAt: string | null;
  loading: boolean;
}) {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const review = useReviewDocument(providerId);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <section className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_2px_8px_rgba(30,70,140,0.025)]">
      <div className="px-[22px] pt-5 pb-4">
        <h2 className="m-0 text-lg font-bold text-[var(--color-headline)]">{t("providerPage.documents")}</h2>
        <p className="mt-1.5 mb-0 text-sm text-[var(--color-muted-foreground)]">
          {t("providerDetailDocumentsHint")}
        </p>
      </div>

      {/* The single most important thing on this screen when it is set: an
          approved document was replaced after the fact. */}
      {reverificationRequestedAt && (
        <div className="mx-[22px] mb-4 flex items-start gap-3 rounded-[9px] bg-[color-mix(in_srgb,var(--color-warn-bg)_70%,var(--color-card))] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warn-fg)]" />
          <p className="m-0 text-sm text-[var(--color-warn-fg)]">
            {t("providerDetailReverification", {
              when: when(reverificationRequestedAt),
            })}
          </p>
        </div>
      )}

      {loading ? (
        <p className="m-0 border-t border-[var(--color-line-2)] px-[22px] py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {t("providerDetailDocumentsLoading")}
        </p>
      ) : documents.length === 0 ? (
        <p className="m-0 border-t border-[var(--color-line-2)] px-[22px] py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {t("providerDetailNoDocuments")}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-0 p-0">
          {documents.map((doc) => {
            const superseded = doc.status === ProviderDocumentStatus.Superseded;
            const decidable = doc.status === ProviderDocumentStatus.Pending;
            return (
              <li
                key={doc.id}
                className={cn("border-t border-[var(--color-line-2)] px-[22px] py-4", superseded && "opacity-60")}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="grid h-[52px] w-[42px] shrink-0 place-items-center rounded-md bg-[var(--color-muted)] text-[var(--color-primary)]">
                      <FileText aria-hidden="true" className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-[15px] font-bold text-[var(--color-headline)]">
                        {t(`documentType.${doc.type}`, { defaultValue: doc.type })}
                      </p>
                      <p className="m-0 mt-1 truncate text-sm text-[var(--color-muted-foreground)]">
                        {doc.fileName || "—"} · {when(doc.uploadedAt)}
                      </p>
                      {doc.rejectionReason && (
                        <p className="m-0 mt-1 text-sm text-[var(--color-destructive)]">
                          {doc.rejectionReason}
                        </p>
                      )}
                      {doc.supersedesId && (
                        // Named on the row that did the replacing, not only on
                        // the one replaced: the reviewer is looking at the new
                        // document and that is where the fact belongs.
                        <p className="m-0 mt-1 text-sm text-[var(--color-warn-fg)]">
                          {t("providerDetailReplacesEarlier")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>
                      {t(`documentStatus.${doc.status}`, { defaultValue: doc.status })}
                    </Badge>
                    {/* A new tab, not an inline preview: these are PDFs as
                        often as images, and the browser's own viewer handles
                        both better than anything built here would. */}
                    <a
                      href={documentUrl(doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-blue-outline)] px-3.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-blue-soft)]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("providerDetailOpenDocument")}
                    </a>
                  </div>
                </div>

                {decidable && (
                  <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:pl-14">
                    <Button
                      type="button"
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate({ documentId: doc.id, accept: true })
                      }
                    >
                      {review.isPending &&
                        review.variables?.documentId === doc.id && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      {t("providerDetailAcceptDocument")}
                    </Button>

                    {rejecting === doc.id ? (
                      <>
                        <Input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={t("providerDetailRejectReason")}
                          aria-label={t("providerDetailRejectReason")}
                          className="min-w-[220px] flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          // A refusal with no reason is one the provider
                          // cannot act on: they are told to send it again with
                          // no idea what was wrong. The server refuses it too.
                          disabled={!reason.trim() || review.isPending}
                          onClick={() => {
                            review.mutate({
                              documentId: doc.id,
                              accept: false,
                              rejectionReason: reason.trim(),
                            });
                            setRejecting(null);
                            setReason("");
                          }}
                        >
                          {t("providerDetailConfirmReject")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setRejecting(doc.id);
                          setReason("");
                        }}
                      >
                        {t("providerDetailRejectDocument")}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {review.error && (
        <p className="m-0 border-t border-[var(--color-line-2)] px-[22px] py-3 text-sm text-[var(--color-destructive)]">
          {t(`documentReviewError.${(review.error as Error).message}`, {
            defaultValue: t("providerActionFailed"),
          })}
        </p>
      )}
    </section>
  );
}
