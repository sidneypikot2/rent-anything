module Api
  module V1
    module Webhooks
      # PayMongo reports a payment on a checkout session (checkout_session.payment.paid). The
      # signature is checked over the raw body, test mode only (Paymongo.valid_signature?); the
      # outcome itself is read back from PayMongo by Payments::Sync, so the body only says which
      # session to look at. Live events, other events and sessions we don't know are
      # acknowledged and ignored, so PayMongo stops retrying them.
      class PaymongoController < ApplicationController
        PAID = "checkout_session.payment.paid".freeze

        def create
          unless Paymongo.valid_signature?(request.raw_post, request.headers["Paymongo-Signature"])
            raise NotAuthenticatedError, "Invalid signature"
          end

          event = params.dig(:data, :attributes) if params[:data].is_a?(ActionController::Parameters)
          event = nil unless event.is_a?(ActionController::Parameters)
          if event && event[:livemode] == true
            Rails.logger.warn("PayMongo live event #{params.dig(:data, :id)} ignored: payments are in test mode")
          elsif event && event[:type] == PAID
            session_id = event.dig(:data, :id) if event[:data].is_a?(ActionController::Parameters)
            payment = session_id.is_a?(String) && Payment.find_by(provider: "paymongo", provider_ref: session_id)
            Payments::Sync.call(payment) if payment
          end
          head :ok
        end
      end
    end
  end
end
