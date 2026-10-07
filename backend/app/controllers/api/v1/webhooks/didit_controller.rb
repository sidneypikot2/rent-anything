module Api
  module V1
    module Webhooks
      # Didit reports that an ID check changed (RAA-44). The signature is checked over the
      # raw body; the status itself is read back from Didit by Verifications::Sync, so the
      # body only says which session to look at. A session we don't know (one a partner
      # replaced) is acknowledged and ignored, so Didit stops retrying it.
      class DiditController < ApplicationController
        def create
          unless Didit.valid_signature?(request.raw_post, request.headers["X-Signature"], request.headers["X-Timestamp"])
            raise NotAuthenticatedError, "Invalid signature"
          end

          session_id = params[:session_id]
          verification = session_id.is_a?(String) && PartnerVerification.find_by(didit_session_id: session_id)
          Verifications::Sync.call(verification) if verification
          head :ok
        end
      end
    end
  end
end
