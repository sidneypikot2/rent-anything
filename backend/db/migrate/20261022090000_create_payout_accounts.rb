# Payout accounts (RAA-145): where a partner's money goes — a bank account, GCash or Maya.
# A partner saves one or more, and each business picks one (two businesses can share one).
# The account number is encrypted by Active Record Encryption, so the column holds
# ciphertext; its last four digits are kept apart for display. A bank account names its bank
# by code (PayoutAccount::BANKS), an e-wallet has none. The composite foreign key keeps a
# business on an account of its own partner.
class CreatePayoutAccounts < ActiveRecord::Migration[8.1]
  def change
    create_enum :payout_account_kind, %w[bank gcash maya]

    create_table :payout_accounts do |t|
      t.references :partner, null: false, foreign_key: { to_table: :users }
      t.enum :kind, enum_type: :payout_account_kind, null: false
      t.string :bank_code
      t.string :account_name, null: false
      t.text :account_number, null: false
      t.string :account_number_last4, limit: 4, null: false
      t.timestamps
    end
    add_index :payout_accounts, %i[id partner_id], unique: true
    add_check_constraint :payout_accounts, "(kind = 'bank') = (bank_code IS NOT NULL)",
      name: "payout_accounts_bank_code_check"
    add_check_constraint :payout_accounts, "char_length(account_name) BETWEEN 1 AND 100",
      name: "payout_accounts_account_name_length_check"
    add_check_constraint :payout_accounts, "account_number_last4 ~ '^[0-9]{4}$'",
      name: "payout_accounts_last4_check"

    add_reference :businesses, :payout_account, foreign_key: true
    add_foreign_key :businesses, :payout_accounts, column: %i[payout_account_id partner_id],
      primary_key: %i[id partner_id], name: "fk_businesses_payout_account_partner"
  end
end
