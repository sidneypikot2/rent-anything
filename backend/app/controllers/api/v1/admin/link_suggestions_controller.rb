module Api
  module V1
    module Admin
      # Destination links suggested by search events (RAA-60).
      class LinkSuggestionsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def index
          render json: DestinationLinks::Suggestions.call
        end
      end
    end
  end
end
