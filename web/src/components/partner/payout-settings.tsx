"use client";

import { useState } from "react";
import { BankGlyph, PlusGlyph, WalletGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FieldLook } from "@/components/ui/field-look";
import { Section } from "@/components/ui/section";
import { SelectField } from "@/components/ui/select-field";
import { PayoutAccountSheet } from "./payout-account-sheet";
import { usePartnerBusinesses, useUpdateBusiness, type PartnerBusiness } from "./use-partner-businesses";
import {
  useDeletePayoutAccount,
  usePayoutAccounts,
  useRefetchPayoutAccounts,
  type PayoutAccount,
} from "./use-payout-accounts";

// Settings → Payouts (RAA-146): the partner's payout accounts — banks, GCash and Maya — and
// which one each business is paid out to. Two businesses can share an account. The API keeps
// the full account numbers; the browser only ever has their last four digits.
export function PayoutSettings() {
  const accounts = usePayoutAccounts();
  const businesses = usePartnerBusinesses();
  const [editing, setEditing] = useState<PayoutAccount | "new" | null>(null);
  const [deleting, setDeleting] = useState<PayoutAccount | null>(null);

  return (
    <Section
      testId="partner-payouts"
      title="Payouts"
      intro="Where your earnings are sent. Save the accounts you use, then pick one for each business."
    >
      <div className="flex flex-col gap-section">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Payout accounts</h3>
            {accounts.data && accounts.data.length > 0 && (
              <Button size="sm" variant="tint" onClick={() => setEditing("new")} data-testid="payout-account-add">
                <PlusGlyph className="size-4" />
                Add account
              </Button>
            )}
          </div>
          {accounts.isPending ? (
            <div className="h-24 animate-pulse rounded-card bg-mist" />
          ) : accounts.isError ? (
            <p role="alert" className="text-sm text-danger">
              Couldn&apos;t load your payout accounts. Refresh to try again.
            </p>
          ) : accounts.data.length === 0 ? (
            <Card edge="line" className="border-dashed">
              <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">No payout accounts yet</p>
                  <p className="text-sm text-muted">Add a bank account, GCash or Maya to get paid for your bookings.</p>
                </div>
                <Button size="sm" variant="tint" onClick={() => setEditing("new")} data-testid="payout-account-add">
                  <PlusGlyph className="size-4" />
                  Add account
                </Button>
              </CardBody>
            </Card>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="payout-accounts">
              {accounts.data.map((account) => (
                <li key={account.id}>
                  <PayoutAccountCard account={account} onEdit={() => setEditing(account)} onDelete={() => setDeleting(account)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <BusinessPayouts accounts={accounts.data ?? []} businesses={businesses.data} loading={businesses.isPending} />
      </div>

      <PayoutAccountSheet
        open={editing !== null}
        account={editing === "new" || editing === null ? undefined : editing}
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
      <DeletePayoutAccount account={deleting} onClose={() => setDeleting(null)} />
    </Section>
  );
}

function PayoutAccountCard({
  account,
  onEdit,
  onDelete,
}: {
  account: PayoutAccount;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const inUse = account.businesses.length > 0;
  const Icon = account.kind === "bank" ? BankGlyph : WalletGlyph;

  return (
    <Card edge="line" data-testid="payout-account">
      <CardBody pad="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{account.bank_name ?? (account.kind === "gcash" ? "GCash" : "Maya")}</p>
            <p className="text-sm break-words text-muted">
              {account.account_name} · <span className="tabular-nums">•••• {account.account_number_last4}</span>
            </p>
            <p className="mt-1 text-sm">
              {inUse ? (
                <>Pays out {account.businesses.map((business) => business.name).join(", ")}</>
              ) : (
                <span className="text-muted">Not used by a business yet</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:justify-end">
          <Button size="sm" variant="soft" onClick={onEdit} data-testid="payout-account-edit">
            Edit
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={onDelete}
            disabled={inUse}
            title={inUse ? "Pick another account for its businesses first" : undefined}
            data-testid="payout-account-delete"
          >
            Delete
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function DeletePayoutAccount({ account, onClose }: { account: PayoutAccount | null; onClose: () => void }) {
  const remove = useDeletePayoutAccount();

  function close() {
    remove.reset();
    onClose();
  }

  return (
    <Dialog
      open={account !== null}
      onClose={close}
      title="Delete payout account?"
      data-testid="payout-account-delete-dialog"
      actions={
        <>
          <Button variant="soft" onClick={close}>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => account && remove.mutate(account.id, { onSuccess: close })}
            data-testid="payout-account-delete-confirm"
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      <p className="text-muted">{account?.label} will be removed from your payout accounts.</p>
      {remove.error && (
        <p role="alert" className="text-sm text-danger">
          {remove.error.message}
        </p>
      )}
    </Dialog>
  );
}

function BusinessPayouts({
  accounts,
  businesses,
  loading,
}: {
  accounts: PayoutAccount[];
  businesses?: PartnerBusiness[];
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-lg font-semibold">Payout per business</h3>
        <p className="text-sm text-muted">Bookings of each business&apos;s listings are paid out to the account picked here.</p>
      </div>
      {loading ? (
        <div className="h-24 animate-pulse rounded-card bg-mist" />
      ) : !businesses || businesses.length === 0 ? (
        <Card edge="line" className="border-dashed">
          <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Add a business first; then pick where its payouts go.</p>
            <ButtonLink href="/partner/businesses/new" size="sm" variant="soft">
              Add business
            </ButtonLink>
          </CardBody>
        </Card>
      ) : (
        <Card edge="line" clip={false}>
          <ul className="divide-y divide-line" data-testid="business-payouts">
            {businesses.map((business) => (
              <li key={business.id}>
                <BusinessPayoutRow business={business} accounts={accounts} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function BusinessPayoutRow({ business, accounts }: { business: PartnerBusiness; accounts: PayoutAccount[] }) {
  const update = useUpdateBusiness(business.id);
  const refetchAccounts = useRefetchPayoutAccounts();
  const current = business.payout_account?.id;

  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-6" data-testid="business-payout">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <p className="font-semibold break-words">{business.name}</p>
        {!business.payout_account && <Badge tone="warning">Not set</Badge>}
      </div>
      <div className="sm:w-80">
        <FieldLook look="floating">
          <SelectField
            label="Pays out to"
            aria-label={`${business.name} pays out to`}
            value={current ?? ""}
            disabled={update.isPending || accounts.length === 0}
            onChange={(event) =>
              update.mutate(
                { name: business.name, payout_account_id: event.target.value ? Number(event.target.value) : null },
                { onSuccess: refetchAccounts },
              )
            }
            hint={accounts.length === 0 ? "Add a payout account first." : update.isPending ? "Saving…" : undefined}
            error={update.error?.message}
            options={[
              { value: "", label: "Not set" },
              ...accounts.map((account) => ({ value: String(account.id), label: account.label })),
            ]}
            data-testid="business-payout-select"
          />
        </FieldLook>
      </div>
    </div>
  );
}
