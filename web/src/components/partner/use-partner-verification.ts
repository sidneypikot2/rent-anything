"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type PartnerVerification = components["schemas"]["partner_verification"];

// Still waiting on the partner or on Didit: each GET asks Didit for news.
const POLLED = ["in_progress", "in_review"];
const POLL_MS = 5000;

// One cache entry per signed-in partner: the banner, the listing gate and the verify page
// share it.
function partnerVerificationKey(userId: number | undefined) {
  return ["partner-verification", userId] as const;
}

export function isVerified(verification: PartnerVerification | undefined) {
  return verification?.status === "approved";
}

// Where the partner's Didit ID check stands (RAA-44). With `poll`, it keeps asking while
// the check is unfinished, so the verify page moves on by itself once Didit decides.
export function usePartnerVerification({ poll = false }: { poll?: boolean } = {}) {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: partnerVerificationKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/verification");
      if (!data) throw new Error(`verification request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
    refetchInterval: (query) => (poll && POLLED.includes(query.state.data?.status ?? "") ? POLL_MS : false),
  });
}

// Starts the check, or resumes the unfinished one, and sends the partner to Didit's page.
export function useStartVerification() {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient().POST("/api/v1/partner/verification");
      if (!data) {
        const message =
          (error && "errors" in error && error.errors?.join(". ")) ||
          (error && "error" in error && error.error) ||
          "Couldn't start the ID check.";
        throw new Error(message);
      }
      return data;
    },
    onSuccess: (data) => window.location.assign(data.url),
    // A refused start (under review, cooling down) means the status we show is stale.
    onError: () => queryClient.invalidateQueries({ queryKey: partnerVerificationKey(userId) }),
  });
}
