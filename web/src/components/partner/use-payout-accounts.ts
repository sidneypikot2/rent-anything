"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";
import { partnerBusinessesKey } from "./use-partner-businesses";

// Where the partner's payouts can go (RAA-145): a bank account, GCash or Maya, with the
// businesses paid out to it. Only the last four digits of a number ever reach the browser.
export type PayoutAccount = components["schemas"]["payout_account"];
// What the form sends to add or change one.
export type PayoutAccountBody = components["schemas"]["payout_account_body"];
export type PayoutKind = PayoutAccount["kind"];

function payoutAccountsKey(userId: number | undefined) {
  return ["payout-accounts", userId] as const;
}

// Each account lists the businesses paid out to it, so picking a business's account refetches
// them.
export function useRefetchPayoutAccounts() {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: payoutAccountsKey(userId) });
}

function saveError(error: unknown, fallback: string) {
  const errors = error && typeof error === "object" && "errors" in error ? error.errors : undefined;
  return new Error((Array.isArray(errors) && errors.join(". ")) || fallback);
}

// The partner's payout accounts, oldest first.
export function usePayoutAccounts() {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: payoutAccountsKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/payout_accounts");
      if (!data) throw new Error(`payout accounts request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}

// The kinds of account and the banks the form offers; they only change with a deploy.
export function usePayoutOptions() {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: ["payout-options"],
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/payout_options");
      if (!data) throw new Error(`payout options request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
    staleTime: Infinity,
  });
}

// An account's label shows on the businesses that use it, so a change refetches those too.
function useRefetchAfterSave() {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: payoutAccountsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: partnerBusinessesKey(userId) }),
    ]);
}

export function useCreatePayoutAccount() {
  const refetch = useRefetchAfterSave();

  return useMutation({
    mutationFn: async (body: PayoutAccountBody) => {
      const { data, error } = await apiClient().POST("/api/v1/partner/payout_accounts", { body });
      if (!data) throw saveError(error, "Couldn't save the payout account.");
      return data;
    },
    onSuccess: refetch,
  });
}

export function useUpdatePayoutAccount(id: number) {
  const refetch = useRefetchAfterSave();

  return useMutation({
    mutationFn: async (body: PayoutAccountBody) => {
      const { data, error } = await apiClient().PATCH("/api/v1/partner/payout_accounts/{id}", {
        params: { path: { id } },
        body,
      });
      if (!data) throw saveError(error, "Couldn't save the changes.");
      return data;
    },
    onSuccess: refetch,
  });
}

// Refused while a business still gets payouts there; the API's message names them.
export function useDeletePayoutAccount() {
  const refetch = useRefetchAfterSave();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error, response } = await apiClient().DELETE("/api/v1/partner/payout_accounts/{id}", {
        params: { path: { id } },
      });
      if (!response.ok) throw saveError(error, "Couldn't delete the payout account.");
    },
    onSuccess: refetch,
  });
}
