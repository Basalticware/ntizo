import { Paperclip, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@ntizo/frontend-ui";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
} from "@/features/messaging/domain/types";
import type { PendingAttachment } from "@/features/messaging/viewmodel/use-attachments";

const ACCEPT_ATTR = ACCEPTED_ATTACHMENT_TYPES.join(",");

/**
 * The two values `attachmentError.*` copy interpolates rather than spells
 * out — `MAX_ATTACHMENT_BYTES` and `ACCEPTED_ATTACHMENT_TYPES` are already
 * the single source of truth (`@ntizo/shared/attachments`); a string that
 * spells "10 MB" or "JPEG, PNG, WEBP, PDF" itself drifts silently the day
 * either constant changes, exactly the failure mode `attachmentsLimitReached`
 * already avoided by interpolating `{{max}}`.
 */
const MAX_ATTACHMENT_MB = MAX_ATTACHMENT_BYTES / (1024 * 1024);
const ACCEPTED_FORMATS_LABEL = ACCEPTED_ATTACHMENT_TYPES.map((type) =>
  type.split("/")[1]!.toUpperCase(),
).join(", ");

/**
 * Picking files for the message being composed, and the preview strip of
 * what has been picked so far.
 *
 * A `<label htmlFor>` wrapping a visually-hidden `<input type="file">`, the
 * same construction `documents-section.tsx`'s own `FilePicker` uses: the
 * label IS the clickable control (a paperclip, styled as a button), and its
 * text — visually hidden, not absent — is what gives the hidden input an
 * accessible name. `accept={ACCEPT_ATTR}` is a hint to the file dialog only;
 * `useAttachments`' own `validate` (via `add`) makes the real check, the
 * same "every check made again" split the upload route documents.
 *
 * Drawn as two pieces the composer places apart — the paperclip at the head
 * of its one row (`part="button"`), the strip of picked files above that row
 * (`part="list"`) — or both together, which is what it used to be.
 */
export function AttachmentPicker({
  files,
  onAdd,
  onRemove,
  disabled = false,
  part = "all",
}: {
  files: readonly PendingAttachment[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  part?: "all" | "button" | "list";
}) {
  const { t } = useTranslation("messaging");
  const atLimit = files.length >= MAX_ATTACHMENTS;

  return (
    <div className={cn("grid gap-2", part === "list" && files.length === 0 && !atLimit && "hidden")}>
      {part !== "list" && (
      <div className="flex items-center gap-2">
        <label
          htmlFor="message-attachment-input"
          className={cn(
            "flex h-[50px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-primary)] transition-colors",
            disabled || atLimit
              ? "cursor-not-allowed opacity-50"
              : "hover:border-[var(--color-primary)]",
          )}
        >
          <Paperclip className="h-[22px] w-[22px]" />
          <span className="sr-only">{t("attachmentPickerLabel")}</span>
        </label>
        <input
          id="message-attachment-input"
          type="file"
          multiple
          className="sr-only"
          accept={ACCEPT_ATTR}
          disabled={disabled || atLimit}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            // Reset first: picking the exact same file twice in a row fires
            // no change event otherwise, which reads as the second attempt
            // being silently ignored — same reasoning `FilePicker` documents.
            event.target.value = "";
            picked.forEach(onAdd);
          }}
        />
        {atLimit && part === "all" && (
          <p className="type-caption text-[var(--color-muted-foreground)]">
            {t("attachmentsLimitReached", { max: MAX_ATTACHMENTS })}
          </p>
        )}
      </div>
      )}

      {/* With the paperclip drawn apart, the limit is said over the list. */}
      {part === "list" && atLimit && (
        <p className="type-caption text-[var(--color-muted-foreground)]">
          {t("attachmentsLimitReached", { max: MAX_ATTACHMENTS })}
        </p>
      )}

      {part !== "button" && files.length > 0 && (
        <ul className="grid list-none gap-1.5 p-0">
          {files.map((pending) => (
            <li
              key={pending.id}
              className="type-caption flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] border border-[var(--color-border)] px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate">{pending.file.name}</span>
              <button
                type="button"
                onClick={() => onRemove(pending.id)}
                aria-label={t("removeAttachment", { fileName: pending.file.name })}
                className="shrink-0 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {pending.errorKey && (
                <p role="alert" className="type-caption w-full text-[var(--color-destructive)]">
                  {t(pending.errorKey, {
                    maxMB: MAX_ATTACHMENT_MB,
                    formats: ACCEPTED_FORMATS_LABEL,
                  })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
