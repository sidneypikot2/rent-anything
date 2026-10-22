module PayoutAccounts
  # A partner changes one of their payout accounts (RAA-145), by the same rules as adding one
  # (PayoutAccountValues).
  class Update < ApplicationService
    include PayoutAccountValues

    def initialize(account, params)
      @account = account
      @params = params
      @errors = []
    end

    def call
      save_payout_account!(@account)
    end
  end
end
