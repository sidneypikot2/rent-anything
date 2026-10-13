module Api
  module V1
    module Partner
      # The businesses the signed-in partner runs (RAA-100): listing, adding and changing one.
      # Another partner's business is a 404.
      class BusinessesController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def index
          businesses = with_counts.order(Arel.sql("lower(businesses.name)"))
          render json: businesses.map { |business| PartnerBusinessSerializer.call(business) }
        end

        def show
          render json: PartnerBusinessSerializer.call(with_counts.find(params[:id]))
        end

        def create
          business = Businesses::Create.call(current_user, business_params)
          render json: PartnerBusinessSerializer.call(with_counts.find(business.id)), status: :created
        end

        def update
          business = Businesses::Update.call(current_user.businesses.find(params[:id]), business_params)
          render json: PartnerBusinessSerializer.call(with_counts.find(business.id))
        end

        private

        def with_counts
          current_user.businesses.left_joins(:listings).group(:id)
            .select("businesses.*, count(listings.id) AS listings_count")
        end

        def business_params
          params.slice(:name, :description, :address, :location)
        end
      end
    end
  end
end
