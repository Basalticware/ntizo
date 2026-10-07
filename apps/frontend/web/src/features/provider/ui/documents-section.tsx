import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  FileText,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { cn } from "@ntizo/frontend-ui";
import {
  DOCUMENT_MIME_TYPES,
  IDENTITY_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  ProviderDocumentStatus,
  ProviderType,
  isAcceptedDocumentMime,
  requiredDocumentsFor,
  type ProviderDocumentType,
} from "@ntizo/shared";
import { useDocumentUpload } from "../viewmodel/use-document-upload";
import type { ProviderDocument } from "../domain/types";

/** The tile's glyph and its ground, by where the document stands. */
const STATE: Record<string, { icon: typeof Clock; ground: string; ink: string }> = {
  [ProviderDocumentStatus.Accepted]: {
    icon: ShieldCheck,
    ground: "bg-[var(--color-ok-bg)] text-[var(--color-ok-fg)]",
    ink: "text-[var(--color-ok-fg)]",
  },
  [ProviderDocumentStatus.Pending]: {
    icon: Clock,
    ground: "bg-[var(--color-warn-bg)] text-[var(--color-warn-fg)]",
    ink: "text-[var(--color-warn-fg)]",
  },
  [ProviderDocumentStatus.Rejected]: {
    icon: XCircle,
    ground: "bg-[var(--color-bad-bg)] text-[var(--color-bad-fg)]",
    ink: "text-[var(--color-bad-fg)]",
  },
};
const MISSING = {
  icon: FileText,
  ground: "bg-[color-mix(in_srgb,var(--color-ink-2)_7%,var(--color-background))] text-[var(--color-ink-2)]",
  ink: "text-[var(--color-muted-foreground)]",
};

const TILE = "relative grid min-w-0 content-start gap-2.5 rounded-lg border border-[var(--color-border)] p-3 pb-3.5";

/**
 * Compliance documents, in settings as well as in the wizard — one tile per
 * paper, as the mockup lays them out: a glyph for where it stands, the name,
 * the state in words, and the way to send it.
 *
 * The wizard's documents step is skippable — deliberately, because a
 * photograph of an ID card is the highest friction in the whole flow and
 * someone signing up on a phone in the street does not have their papers to
 * hand. Skippable only works if there is somewhere to finish, and this is it.
 *
 * It also carries what the wizard never can: a rejection. A document refused
 * two weeks after signup has no other screen to appear on, and "rejected, and
 * here is why" is the only version of that news anyone can act on.
 *
 * Replacing an accepted document is allowed and is not silent. The upload
 * arrives `pending` like any other, the accepted row is kept rather than
 * overwritten, and the provider is flagged for re-verification — so a real
 * document cannot earn the badge and then be swapped for a forgery that
 * inherits it. The warning in the tile says so before the file dialog opens,
 * which is the honest place to say it.
 *
 * The mockup's "Válido até 12/2028" is not drawn: the server stores no expiry.
 */
export function DocumentsSection({
  providerId,
  providerType,
  documents,
  reverificationRequestedAt,
  onUploaded,
}: {
  providerId: string;
  providerType: ProviderType;
  documents: readonly ProviderDocument[];
  reverificationRequestedAt: string | null;
  onUploaded: () => void;
}) {
  const { t } = useTranslation("provider");
  const { t: to } = useTranslation("onboarding");
  const upload = useDocumentUpload(providerId);

  const held = new Map(documents.map((d) => [d.type, d]));
  const identity = IDENTITY_DOCUMENT_TYPES.map((type) => held.get(type)).find(
    Boolean,
  );

  async function send(type: ProviderDocumentType, file: File) {
    const result = await upload.send(type, file);
    if (result) onUploaded();
  }

  return (
    <div className="grid gap-4">
      {reverificationRequestedAt && (
        <p className="flex items-start gap-2.5 rounded-[10px] bg-[var(--color-warn-bg)] px-4 py-3 text-sm text-[var(--color-warn-chip)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("documentsReverification")}
        </p>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
        {identity ? (
          <DocumentTile
            document={identity}
            label={to(`documents.type.${identity.type}.label`)}
            onReplace={(file) =>
              void send(identity.type as ProviderDocumentType, file)
            }
            busy={upload.busy}
          />
        ) : (
          <EmptyTile
            label={to("documents.identity.label")}
            hint={to("documents.identity.hint")}
            choices={IDENTITY_DOCUMENT_TYPES.map((type) => ({
              type,
              label: to(`documents.type.${type}.label`),
            }))}
            onPick={(type, file) => void send(type, file)}
            busy={upload.busy}
          />
        )}

        {requiredDocumentsFor(providerType).map((type) => {
          const document = held.get(type);
          return document ? (
            <DocumentTile
              key={type}
              document={document}
              label={to(`documents.type.${type}.label`)}
              onReplace={(file) => void send(type, file)}
              busy={upload.busy}
            />
          ) : (
            <EmptyTile
              key={type}
              label={to(`documents.type.${type}.label`)}
              hint={to(`documents.type.${type}.hint`)}
              choices={[{ type, label: to(`documents.type.${type}.label`) }]}
              onPick={(t2, file) => void send(t2, file)}
              busy={upload.busy}
            />
          );
        })}
      </div>

      {upload.errorKey && (
        <p className="type-caption text-[var(--color-destructive)]">
          {t(upload.errorKey)}
        </p>
      )}

      <p className="text-[13px] text-[var(--color-muted-foreground)]">
        {to("documents.privacy")}
      </p>
    </div>
  );
}

/** The glyph tile and the chevron the mockup puts on the tile's top line. */
function TileHead({ state, chevron }: { state: typeof MISSING; chevron: boolean }) {
  const Icon = state.icon;
  return (
    <div className="flex items-center justify-between">
      <span className={cn("grid h-[34px] w-[34px] place-items-center rounded-lg", state.ground)}>
        <Icon className="h-[19px] w-[19px]" />
      </span>
      {chevron && <ChevronRight aria-hidden className="h-3.5 w-3.5 text-[var(--color-ink-2)]" strokeWidth={2.4} />}
    </div>
  );
}

/** One document that exists, with where it stands and what to do about it. */
function DocumentTile({
  document,
  label,
  onReplace,
  busy,
}: {
  document: ProviderDocument;
  label: string;
  onReplace: (file: File) => void;
  busy: boolean;
}) {
  const { t } = useTranslation("provider");
  const [confirming, setConfirming] = useState(false);
  const state = STATE[document.status] ?? MISSING;
  const accepted = document.status === ProviderDocumentStatus.Accepted;

  return (
    <div className={TILE}>
      <TileHead state={state} chevron={false} />
      <div className="min-w-0">
        <p className="text-[13px] leading-[1.35] font-bold text-[var(--color-headline)]">{label}</p>
        <p className={cn("mt-0.5 text-[13px] leading-[1.4]", state.ink)}>
          {t(`settingsPage.doc.${document.status}`)}
        </p>
        {document.fileName && (
          <p className="mt-0.5 truncate text-[13px] leading-[1.4] text-[var(--color-muted-foreground)]">
            {document.fileName}
          </p>
        )}
        {/* The reason, not just the verdict. "Rejected" alone leaves someone
            re-uploading the same unreadable photograph forever. */}
        {document.rejectionReason && (
          <p className="mt-1 text-[13px] leading-[1.4] text-[var(--color-destructive)]">
            {document.rejectionReason}
          </p>
        )}
      </div>

      {/* Said before the file dialog opens, not after the upload. Someone
          renewing an expired ID should know their standing changes; someone
          hoping the swap goes unnoticed should know it does not. */}
      {accepted && confirming && (
        <p className="flex items-start gap-2 rounded-md bg-[var(--color-muted)] px-2.5 py-2 text-[12.5px] leading-[1.45]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t("documentsReplaceWarning")}
        </p>
      )}

      {accepted && !confirming ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
          className="justify-self-start text-[13px] font-semibold text-[var(--color-primary)] hover:underline disabled:opacity-50"
        >
          {t("documentsReplace")}
        </button>
      ) : (
        <FilePicker
          id={`doc-${document.type}`}
          label={t("documentsReplace")}
          disabled={busy}
          onPick={onReplace}
        />
      )}
    </div>
  );
}

/**
 * A paper not sent yet. One kind is the whole tile as the file input's label,
 * chevron and all; the identity slot accepts any of three, so it offers each.
 */
function EmptyTile({
  label,
  hint,
  choices,
  onPick,
  busy,
}: {
  label: string;
  /** What the paper is; some have none, and the tile then says to send it. */
  hint: string;
  choices: readonly { type: ProviderDocumentType; label: string }[];
  onPick: (type: ProviderDocumentType, file: File) => void;
  busy: boolean;
}) {
  const { t } = useTranslation("provider");
  const single = choices.length === 1 ? choices[0] : null;
  const body = (
    <>
      <TileHead state={MISSING} chevron={single !== null} />
      <div className="min-w-0">
        <p className="text-[13px] leading-[1.35] font-bold text-[var(--color-headline)]">{label}</p>
        <p className="mt-0.5 text-[13px] leading-[1.4] text-[var(--color-muted-foreground)]">
          {t("settingsPage.doc.missing")}
        </p>
        <p className="mt-0.5 text-[13px] leading-[1.4] text-[var(--color-muted-foreground)]">
          {hint || t("settingsPage.doc.upload")}
        </p>
      </div>
    </>
  );

  if (single) {
    return (
      <label
        htmlFor={`doc-${single.type}`}
        className={cn(
          TILE,
          "cursor-pointer transition-colors",
          busy ? "cursor-not-allowed opacity-50" : "hover:border-[var(--color-blue-line)] hover:bg-[color-mix(in_srgb,var(--color-blue-soft)_45%,transparent)]",
        )}
      >
        {body}
        <FileInput id={`doc-${single.type}`} disabled={busy} onPick={(file) => onPick(single.type, file)} />
      </label>
    );
  }

  return (
    <div className={TILE}>
      {body}
      <div className="grid gap-1.5">
        {choices.map((choice) => (
          <FilePicker
            key={choice.type}
            id={`doc-${choice.type}`}
            label={choice.label}
            disabled={busy}
            onPick={(file) => onPick(choice.type, file)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The file input, dressed as a small outlined button.
 *
 * Same checks as the wizard's, and both duplicate the server's. The pair only
 * spares the user an upload that was going to be refused; `accept` is a
 * suggestion to the file dialog and nothing more.
 */
function FilePicker({
  id,
  label,
  disabled,
  onPick,
}: {
  id: string;
  label: string;
  disabled?: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[var(--color-blue-line)] px-2.5 text-[13px] font-semibold text-[var(--color-primary)] transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-[var(--color-blue-soft)]",
      )}
    >
      <Upload className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
      <FileInput id={id} disabled={disabled} onPick={onPick} />
    </label>
  );
}

function FileInput({
  id,
  disabled,
  onPick,
}: {
  id: string;
  disabled?: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <input
      id={id}
      type="file"
      className="sr-only"
      disabled={disabled}
      accept={DOCUMENT_MIME_TYPES.join(",")}
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Reset first: picking the same file twice in a row fires no change
        // event otherwise, which reads as the second attempt being ignored.
        e.target.value = "";
        if (!file) return;
        if (
          !isAcceptedDocumentMime(file.type) ||
          file.size > MAX_DOCUMENT_BYTES
        )
          return;
        onPick(file);
      }}
    />
  );
}
