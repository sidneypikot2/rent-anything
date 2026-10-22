module Api
  module V1
    module Partner
      # The signed-in partner's payout accounts (RAA-145): listing, adding, changing and deleting
      # one. One a business still uses can't be deleted; another partner's is a 404.
      class PayoutAccountsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def index
          accounts = current_user.payout_accounts.includes(:businesses).order(:created_at, :id)
          render json: accounts.map { |account| PayoutAccountSerializer.call(account) }
        end

        def create
          account = PayoutAccounts::Create.call(current_user, payout_account_params)
          render json: PayoutAccountSerializer.call(account), status: :created
        end

        def update
          account = PayoutAccounts::Update.call(current_user.payout_accounts.find(params[:id]), payout_account_params)
          render json: PayoutAccountSerializer.call(account)
        end

        def destroy
          account = current_user.payout_accounts.find(params[:id])
          raise ActiveRecord::RecordInvalid, account unless account.destroy
          head :no_content
        end

        private

        def payout_account_params
          params.slice(:kind, :bank_code, :account_name, :account_number)
        end
      end
    end
  end
end
