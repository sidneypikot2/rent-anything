module Api
  module V1
    module Admin
      # Queries that need a search term (RAA-60).
      class SearchTermQueuesController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def show
          render json: SearchTerms::Queue.call
        end
      end
    end
  end
end
