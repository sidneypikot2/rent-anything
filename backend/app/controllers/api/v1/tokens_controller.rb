module Api
  module V1
    class TokensController < ApplicationController
      include RefreshCookie

      limit_requests REFRESH_RATE_LIMIT, only: :refresh

      def refresh
        render_tokens Auth::Refresh.call(refresh_token_from_request)
      end
    end
  end
end
