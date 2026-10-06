import { queryOptions } from "@tanstack/react-query";
import type { ProviderStatusCountsDTO } from "@ntizo/shared/read-models";
import { sessionGraphql } from "@/shared/lib/graphql/session-graphql";
import type { AdminProvider, AdminProviderDetail } from "../domain/types";

const ALL = `
  query ProviderAllForAdmin($input: ProviderAllForAdminInput!) {
    providerAllForAdmin(input: $input) {
      id name slug type status description city country
      commissionBps ownerEmail createdAt
    }
  }`;

const DETAIL = `
  query ProviderDetailForAdmin($input: ProviderDetailForAdminInput!) {
    providerDetailForAdmin(input: $input) {
      id name slug type status description city country
      commissionBps payoutType payoutIdentifier
      ownerUserId ownerName ownerEmail ownerPhone
      memberCount logoUrl photoUrls
      addressStreet addressDistrict addressPostalCode
      reverificationRequestedAt allowedTransitions createdAt updatedAt
      members { userId email name role joinedAt }
      invites { id email role status expiresAt createdAt }
      documents {
        id type status fileName contentType uploadedAt reviewedAt
        rejectionReason supersedesId
      }
    }
  }`;

const COUNTS = `
  query ProviderCountByStatusForAdmin {
    providerCountByStatusForAdmin(input: {}) { pending active rejected suspended archived }
  }`;

const DECIDE = `
  mutation ProviderAdminDecideStatus($input: ProviderAdminDecideStatusInput!) {
    providerAdminDecideStatus(input: $input) { providerId }
  }`;

const SET_COMMISSION = `
  mutation ProviderAdminSetCommission($input: ProviderAdminSetCommissionInput!) {
    providerAdminSetCommission(input: $input) { providerId }
  }`;

/** Rows a page of the admin queue draws. The field's own default. */
export const ADMIN_PROVIDERS_PAGE_SIZE = 25;

export interface AdminProvidersPage {
  items: AdminProvider[];
  hasMore: boolean;
}

export const adminProviderQueries = {
  detail: (providerId: string) =>
    queryOptions({
      queryKey: ["admin", "provider", providerId],
      queryFn: async (): Promise<AdminProviderDetail> => {
        const d = await sessionGraphql<{
          providerDetailForAdmin: AdminProviderDetail;
        }>(DETAIL, { input: { providerId } });
        return d.providerDetailForAdmin;
      },
      // Without this the page fires a query with an empty id on first render,
      // which comes back FORBIDDEN and reads as a permissions problem.
      enabled: providerId.length > 0,
    }),

  all: (input: { status?: string; search?: string; limit?: number; offset?: number }) =>
    queryOptions({
      queryKey: ["admin", "providers", input],
      queryFn: async (): Promise<AdminProvider[]> => {
        const d = await sessionGraphql<{ providerAllForAdmin: AdminProvider[] }>(ALL, {
          input,
        });
        return d.providerAllForAdmin;
      },
    }),

  /**
   * One page of the queue, and whether there is another after it.
   *
   * Asks for one row more than it draws: the list read returns no total, and
   * the extra row is the only honest way to know a next page exists without
   * offering one that turns out empty.
   */
  page: (input: { status?: string; search?: string; offset: number }) =>
    queryOptions({
      queryKey: ["admin", "providers", "page", input],
      queryFn: async (): Promise<AdminProvidersPage> => {
        const d = await sessionGraphql<{ providerAllForAdmin: AdminProvider[] }>(ALL, {
          input: { ...input, limit: ADMIN_PROVIDERS_PAGE_SIZE + 1 },
        });
        const rows = d.providerAllForAdmin;
        return {
          items: rows.slice(0, ADMIN_PROVIDERS_PAGE_SIZE),
          hasMore: rows.length > ADMIN_PROVIDERS_PAGE_SIZE,
        };
      },
    }),

  /**
   * One count per status — the sidebar's badge and the dashboard read
   * `pending` from here, instead of measuring a page of twenty-five. Under
   * the list's prefix, so a decision on a provider refreshes both.
   */
  counts: () =>
    queryOptions({
      queryKey: ["admin", "providers", "counts"] as const,
      queryFn: async (): Promise<ProviderStatusCountsDTO> => {
        const d = await sessionGraphql<{ providerCountByStatusForAdmin: ProviderStatusCountsDTO }>(COUNTS, {});
        return d.providerCountByStatusForAdmin;
      },
      staleTime: 30_000,
    }),
};

export async function decideProviderStatus(
  providerId: string,
  status: string,
): Promise<void> {
  await sessionGraphql(DECIDE, { input: { providerId, status } });
}

export async function setProviderCommission(
  providerId: string,
  commissionBps: number,
): Promise<void> {
  await sessionGraphql(SET_COMMISSION, { input: { providerId, commissionBps } });
}

/** Where the API serves this document's bytes. Never the bucket key. */
export function documentUrl(documentId: string): string {
  const base = import.meta.env["VITE_API_URL"] ?? "http://localhost:8788";
  return `${base}/api/documents/${documentId}`;
}

export interface ReviewDocumentInput {
  documentId: string;
  accept: boolean;
  rejectionReason?: string;
}

export async function reviewDocument(input: ReviewDocumentInput): Promise<void> {
  const base = import.meta.env["VITE_API_URL"] ?? "http://localhost:8788";
  const res = await fetch(`${base}/api/documents/${input.documentId}/review`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accept: input.accept,
      ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
    }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: "REVIEW_FAILED" }))) as {
      error?: string;
    };
    // The server's code as the message, so the screen can translate it. A
    // status number would tell the reviewer nothing about what to do next.
    throw new Error(error ?? "REVIEW_FAILED");
  }
}
