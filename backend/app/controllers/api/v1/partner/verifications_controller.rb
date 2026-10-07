module Api
  module V1
    module Partner
      # The signed-in partner's ID check through Didit (RAA-44). A partner must pass it
      # before adding listings.
      class VerificationsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        rescue_from Verifications::CoolingDownError do |exception|
          render json: { error: exception.message, retry_at: exception.retry_at }, status: :too_many_requests
        end

        def show
          render json: PartnerVerificationSerializer.call(Verifications::Current.call(current_user))
        end

        def create
          result = Verifications::Start.call(current_user)
          render json: { url: result.url, verification: PartnerVerificationSerializer.call(result.verification) },
            status: :created
        end
      end
    end
  end
end
