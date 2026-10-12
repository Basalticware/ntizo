import { useQuery } from "@tanstack/react-query";
import { providerQueries } from "../data/provider.repository";
import type { ProviderSummary } from "../domain/types";
import { queryClient } from "@/lib/query-client";

/**
 * `enabled` defaults to `true` — every existing caller wants this query to
 * run unconditionally and keeps working unchanged. The parameter exists for
 * `useActiveProvider`'s own `enabled`, which the Help Center (mounted at the
 * root, on every page) passes `false` on any page that is not the provider
 * zone — see that hook's own doc comment for why an authenticated query
 * firing for every signed-out visitor on the landing page is a real cost,
 * not a hypothetical one.
 */
export function useMyProviders(enabled = true) {
  return useQuery({ ...providerQueries.mine(), enabled });
}

export function useProviderDetail(id: string | undefined) {
  return useQuery({
    ...providerQueries.byId(id ?? ""),
    enabled: !!id,
  });
}

/**
 * Imperative count for use outside React context (route `beforeLoad` guards,
 * post-login redirect resolution), which can't call hooks. queryOptions()
 * types queryFn against TanStack Query's QueryFunctionContext parameter,
 * which these call sites never supply — same cast the repository's own test
 * uses. A failing lookup degrades to zero rather than throwing.
 */
export async function countMyProviders(): Promise<number> {
  try {
    const queryFn = providerQueries.mine().queryFn as () => Promise<
      ProviderSummary[]
    >;
    return (await queryFn()).length;
  } catch {
    return 0;
  }
}

export async function hasAnyProvider(): Promise<boolean> {
  return (await countMyProviders()) > 0;
}

/** Where `localStorage` remembers the last workspace. Shared with the hook. */
export const ACTIVE_PROVIDER_KEY = "ntizo.activeProviderId";

/**
 * Which workspace `/provider` should land on.
 *
 * Storage is consulted, but only as a hint: it names an id, and a stored id
 * that no longer belongs to this account — a workspace left, a device shared —
 * falls back to the first rather than to a 404. The URL that results is
 * canonical from then on.
 */
export async function preferredProviderSlug(): Promise<string | null> {
  try {
    // Through the cache, not around it. This list is exactly what the console
    // shell asks for a moment later; calling the bare queryFn threw the answer
    // away and made the panel wait on the same request twice. `staleTime: 0`
    // keeps the guard deciding on a fresh list, as it did before. Browser
    // only: on the server the client is one module shared by every request,
    // and one account's workspaces must never sit in it for the next.
    const providers =
      typeof window === "undefined"
        ? await (providerQueries.mine().queryFn as () => Promise<ProviderSummary[]>)()
        : await queryClient.fetchQuery({ ...providerQueries.mine(), staleTime: 0 });
    if (providers.length === 0) return null;
    const stored =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem(ACTIVE_PROVIDER_KEY);
    return (providers.find((p) => p.id === stored) ?? providers[0])!.slug;
  } catch {
    return null;
  }
}
