module PayoutAccounts
  # Reading a payout account from a request (RAA-145), shared by adding one and changing one.
  # The kind, account name and number are required on a new account and kept when left out
  # of a change; a change of kind needs a new number, and a bank account needs its bank.
  # An e-wallet has no bank. Spaces and dashes in a number are ignored, and an e-wallet's +63
  # is read as 0.
  module PayoutAccountValues
    include RequestValues

    private

    def payout_account_attributes(account)
      given = ->(key) { account.new_record? || @params.key?(key) }
      attributes = {}
      attributes[:kind] = kind_from(@params[:kind]) if given.(:kind)
      attributes[:account_name] = required_string(@params, :account_name, "Account name") if given.(:account_name)

      kind = attributes.fetch(:kind, account.kind)
      kind_changed = kind != account.kind
      if kind != "bank"
        attributes[:bank_code] = nil
      elsif given.(:bank_code) || kind_changed
        attributes[:bank_code] = required_string(@params, :bank_code, "Bank")
      end
      if given.(:account_number) || kind_changed
        number = required_string(@params, :account_number, "Account number")
        attributes[:account_number] = normalise_number(number, kind) if number
      end
      attributes
    end

    def kind_from(value)
      return value if PayoutAccount::KINDS.key?(value)

      @errors << "Kind must be one of #{PayoutAccount::KINDS.keys.join(', ')}"
      nil
    end

    def normalise_number(number, kind)
      digits = number.delete(" -")
      kind == "bank" ? digits : digits.sub(/\A\+?63(?=9)/, "0")
    end

    def save_payout_account!(account)
      attributes = payout_account_attributes(account)
      if @errors.any?
        @errors.each { |message| account.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, account
      end

      account.update!(attributes)
      account
    end
  end
end
