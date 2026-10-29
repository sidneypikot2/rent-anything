"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Dialog, useChanged } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import {
  useCreatePayoutAccount,
  usePayoutOptions,
  useUpdatePayoutAccount,
  type PayoutAccount,
  type PayoutAccountBody,
  type PayoutKind,
} from "./use-payout-accounts";

const KIND_NOTES: Record<PayoutKind, string> = {
  bank: "Paid into an account at a Philippine bank.",
  gcash: "Paid to the mobile number of your GCash account.",
  maya: "Paid to the mobile number of your Maya account.",
};

// Adding or changing a payout account (RAA-146) in a sheet. The API checks the bank and the
// number. A saved number is never sent back, so on a change it is left blank and kept unless
// the partner types a new one — or switches between a bank and an e-wallet, which needs one.
export function PayoutAccountSheet({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account?: PayoutAccount;
  onClose: () => void;
  onSaved: (account: PayoutAccount) => void;
}) {
  // The form's changes, so closing asks first (the form lives below the dialog).
  const [dirty, setDirty] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      dirty={open && dirty}
      title={account ? "Edit payout account" : "Add a payout account"}
      placement="sheet"
      data-testid="payout-account-sheet"
    >
      {/* Remounted per opening, so a closed sheet starts again from the account. */}
      {open && <PayoutAccountForm key={account?.id ?? "new"} account={account} onCancel={onClose} onSaved={onSaved} onDirty={setDirty} />}
    </Dialog>
  );
}

function PayoutAccountForm({
  account,
  onCancel,
  onSaved,
  onDirty,
}: {
  account?: PayoutAccount;
  onCancel: () => void;
  onSaved: (account: PayoutAccount) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const options = usePayoutOptions();
  const create = useCreatePayoutAccount();
  const update = useUpdatePayoutAccount(account?.id ?? 0);
  const save = account ? update : create;

  const [kind, setKind] = useState<PayoutKind>(account?.kind ?? "bank");
  const [bankCode, setBankCode] = useState(account?.bank_code ?? "");
  const [accountName, setAccountName] = useState(account?.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const dirty = useChanged({ kind, bankCode, accountName, accountNumber });
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const bank = kind === "bank";
  const numberRequired = !account || kind !== account.kind;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: PayoutAccountBody = { kind, account_name: accountName.trim() };
    if (bank) body.bank_code = bankCode as PayoutAccountBody["bank_code"];
    if (accountNumber.trim()) body.account_number = accountNumber.trim();
    save.mutate(body, { onSuccess: onSaved });
  }

  return (
    <form data-testid="payout-account-form" onSubmit={onSubmit} className="flex flex-col gap-5">
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      )}
      <ChoiceCards
        legend="Pay out to"
        name="kind"
        columns={1}
        required
        value={kind}
        onChange={(value) => setKind(value as PayoutKind)}
        choices={(options.data?.kinds ?? []).map(({ value, label }) => ({
          value,
          label,
          description: KIND_NOTES[value],
        }))}
        data-testid="payout-kind"
      />
      {bank && (
        <SelectField
          label="Bank"
          name="bank_code"
          required
          value={bankCode}
          onChange={(event) => setBankCode(event.target.value)}
          options={[
            { value: "", label: "Choose a bank" },
            ...(options.data?.banks ?? []).map(({ code, name }) => ({ value: code, label: name })),
          ]}
        />
      )}
      <Field
        label="Account name"
        name="account_name"
        required
        maxLength={100}
        autoComplete="name"
        value={accountName}
        onChange={(event) => setAccountName(event.target.value)}
        hint={bank ? "As it appears on the bank account." : "The name registered to the e-wallet."}
      />
      <Field
        label={bank ? "Account number" : "Mobile number"}
        name="account_number"
        required={numberRequired}
        type={bank ? "text" : "tel"}
        inputMode="numeric"
        autoComplete="off"
        value={accountNumber}
        onChange={(event) => setAccountNumber(event.target.value)}
        placeholder={bank ? "e.g. 0012 3456 7890" : "e.g. 0917 123 4567"}
        hint={
          numberRequired
            ? "Only its last four digits are shown again."
            : `Saved as •••• ${account?.account_number_last4}. Leave blank to keep it.`
        }
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="soft" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" data-testid="payout-account-save" disabled={save.isPending || !options.data}>
          {save.isPending ? "Saving…" : account ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}
