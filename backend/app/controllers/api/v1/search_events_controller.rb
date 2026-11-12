module Api
  module V1
    # Guest search events (RAA-60): public, one per search the guest finishes.
    class SearchEventsController < ApplicationController
      RATE_LIMIT = { to: 60, within: 1.minute }.freeze

      limit_requests(RATE_LIMIT, only: :create)

      def create
        SearchEvents::Record.call(params.slice(:q, :result_count, :session_id, :target))
        head :no_content
      end
    end
  end
end
