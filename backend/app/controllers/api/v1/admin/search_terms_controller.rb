module Api
  module V1
    module Admin
      # Adding a search term (alias) to a place (RAA-60).
      class SearchTermsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("admin") }

        def create
          render json: SearchTerms::Add.call(params.slice(:query, :target)), status: :created
        end
      end
    end
  end
end
