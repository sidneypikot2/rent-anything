module PayoutAccounts
  # A partner adds a payout account (RAA-145), read by PayoutAccountValues.
  class Create < ApplicationService
    include PayoutAccountValues

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      save_payout_account!(@partner.payout_accounts.build)
    end
  end
end
