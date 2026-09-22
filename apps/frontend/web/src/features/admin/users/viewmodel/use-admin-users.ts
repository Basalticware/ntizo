import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUserQueries, setPlatformRole } from "../data/admin-user.repository";

export function useAdminUsers(input: { role?: string; search?: string }) {
  // Server-side, like the provider queue: this is the largest list on the
  // platform by definition — every provider is also a user — so deciding
  // which fifty of ten thousand to draw is not the browser's decision.
  return useQuery(adminUserQueries.all(input));
}

export function useAdminUserDetail(userId: string) {
  return useQuery(adminUserQueries.detail(userId));
}

/**
 * Invalidates this person's file and the list together. The list shows the
 * role too, and leaving it stale would make a promotion look undone the
 * moment an admin went back.
 */
export function useSetPlatformRole(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: "admin" | "customer") => setPlatformRole(userId, role),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "user", userId] }),
        qc.invalidateQueries({ queryKey: ["admin", "users"] }),
      ]);
    },
  });
}
