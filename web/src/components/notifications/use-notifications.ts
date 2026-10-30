"use client";

import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type Notification = components["schemas"]["notification"];
type Page = components["schemas"]["notification_page"];

export function notificationsKey(userId: number | undefined) {
  return ["notifications", userId] as const;
}

// The signed-in user's notifications, newest first, a page at a time (GET /notifications), with
// how many are unread. LiveUpdates refetches them when one comes in.
export function useNotifications(enabled: boolean) {
  const userId = useSession()?.user.id;
  const query = useInfiniteQuery({
    queryKey: notificationsKey(userId),
    queryFn: async ({ pageParam }: { pageParam: number | null }) => {
      const { data, response } = await apiClient().GET("/api/v1/notifications", {
        params: { query: pageParam === null ? {} : { before: pageParam } },
      });
      if (!data) throw new Error(`notifications request failed (${response.status})`);
      return data;
    },
    initialPageParam: null as number | null,
    getNextPageParam: (last: Page) => last.next_before,
    enabled: enabled && userId !== undefined,
  });
  const pages = query.data?.pages ?? [];
  return {
    ...query,
    notifications: pages.flatMap((page) => page.notifications),
    // The newest page's count is the current one.
    unreadCount: pages[0]?.unread_count ?? 0,
  };
}

// Marks one read, or all of them, showing it at once and refetching after.
export function useMarkRead() {
  const queryClient = useQueryClient();
  const key = notificationsKey(useSession()?.user.id);

  const markLocally = (id: number | "all") =>
    queryClient.setQueryData<InfiniteData<Page>>(key, (data) => {
      if (!data) return data;
      let marked = 0;
      const pages = data.pages.map((page) => ({
        ...page,
        notifications: page.notifications.map((item) => {
          if (item.read || (id !== "all" && item.id !== id)) return item;
          marked += 1;
          return { ...item, read: true };
        }),
      }));
      const unread = id === "all" ? 0 : Math.max(0, (data.pages[0]?.unread_count ?? 0) - marked);
      return { ...data, pages: pages.map((page) => ({ ...page, unread_count: unread })) };
    });

  return useMutation({
    mutationFn: async (id: number | "all") => {
      // A refetch already on its way would land after this and show them unread again.
      await queryClient.cancelQueries({ queryKey: key });
      markLocally(id);
      const { response } =
        id === "all"
          ? await apiClient().POST("/api/v1/notifications/read_all")
          : await apiClient().POST("/api/v1/notifications/{id}/read", { params: { path: { id } } });
      if (!response.ok) throw new Error(`mark read failed (${response.status})`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
