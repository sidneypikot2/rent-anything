module Api
  module V1
    # A trip as its share link shows it to anyone (RAA-176): view-only, no sign-in. An unknown,
    # rotated or revoked token is a 404. Kept out of search engines.
    class SharedTripsController < ApplicationController
      before_action { response.set_header("X-Robots-Tag", "noindex") }

      def show
        render json: SharedTripSerializer.call(Trip.with_items.find_by!(share_token: params[:token]))
      end
    end
  end
end
