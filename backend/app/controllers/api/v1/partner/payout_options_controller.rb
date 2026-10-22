module Api
  module V1
    module Partner
      # What the payout account form offers (RAA-145): the kinds of account and the banks.
      class PayoutOptionsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          render json: {
            kinds: PayoutAccount::KINDS.map { |value, label| { value:, label: } },
            banks: PayoutAccount::BANKS.map { |code, name| { code:, name: } }
          }
        end
      end
    end
  end
end
