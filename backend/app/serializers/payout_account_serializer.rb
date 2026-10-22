# A payout account as its partner sees it (the `payout_account` schema in
# spec/swagger_helper.rb, RAA-145), with the businesses paid out to it. Never the full account
# number: only its last four digits.
module PayoutAccountSerializer
  def self.call(account)
    {
      id: account.id,
      kind: account.kind,
      bank_code: account.bank_code,
      bank_name: account.bank_name,
      account_name: account.account_name,
      account_number_last4: account.account_number_last4,
      label: account.label,
      businesses: account.businesses.sort_by(&:name).map { |business| { id: business.id, name: business.name } },
      created_at: account.created_at,
      updated_at: account.updated_at
    }
  end
end
