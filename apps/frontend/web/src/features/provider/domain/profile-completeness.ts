import {
  IDENTITY_DOCUMENT_TYPES,
  ProviderDocumentStatus,
  requiredDocumentsFor,
  type ProviderType,
} from "@ntizo/shared";
import type { ProviderDetail } from "./types";

/** The settings sections a profile can be finished in, in the page's order. */
export type ProfileStep = "brand" | "identity" | "address" | "documents";

export interface ProfileStepState {
  step: ProfileStep;
  done: boolean;
}

export interface ProfileCompleteness {
  steps: ProfileStepState[];
  /** Documents that count towards verification, and how many are needed. */
  documents: { held: number; needed: number };
  /** 0–100, rounded. */
  percent: number;
}

/**
 * How finished the workspace's public profile is, from what is saved.
 *
 * Every step is a fact the settings page itself edits, so the ring beside it
 * cannot claim anything the reader cannot check by scrolling up:
 *
 * - **Marca e fotografia** — a logo and at least one portfolio photo.
 * - **Identidade** — a name and a description.
 * - **Onde trabalha** — a city and a street address.
 * - **Verificação** — one identity document plus every paper the business
 *   type requires (`requiredDocumentsFor`), counted as uploaded and not
 *   refused. A pending upload counts: the provider has done their part, and
 *   the review is ours.
 *
 * The percentage weighs the four equally, the documents step by the share of
 * papers held, so uploading one of four moves the ring a little rather than
 * not at all. The mockup's fifth step, "Preferências", is not here: the page
 * has no preferences to set.
 *
 * Read from the saved detail, never from the form's draft — an unsaved edit
 * has not made anything visible to a customer yet.
 */
export function profileCompleteness(
  detail: Pick<ProviderDetail, "name" | "description" | "address" | "logo" | "photos" | "documents"> & {
    type: ProviderType;
  },
): ProfileCompleteness {
  const counted = (detail.documents ?? []).filter(
    (d) => d.status !== ProviderDocumentStatus.Rejected,
  );
  const types = new Set(counted.map((d) => d.type));
  const required = requiredDocumentsFor(detail.type);
  const held =
    (IDENTITY_DOCUMENT_TYPES.some((t) => types.has(t)) ? 1 : 0) +
    required.filter((t) => types.has(t)).length;
  const needed = 1 + required.length;

  const filled = (value: string | null | undefined) => Boolean(value?.trim());
  const steps: ProfileStepState[] = [
    { step: "brand", done: Boolean(detail.logo?.key) && (detail.photos ?? []).length > 0 },
    { step: "identity", done: filled(detail.name) && filled(detail.description) },
    { step: "address", done: filled(detail.address?.city) && filled(detail.address?.street) },
    { step: "documents", done: held >= needed },
  ];

  const score =
    steps.filter((s) => s.step !== "documents" && s.done).length + held / needed;
  return {
    steps,
    documents: { held, needed },
    percent: Math.round((score / steps.length) * 100),
  };
}
