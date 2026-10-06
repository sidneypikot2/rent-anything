module Api
  module V1
    module Partner
      # What the add-listing form offers (RAA-41): bookable categories, each with the JSON
      # Schema its attrs must match. The area isn't chosen: it follows from the map pin.
      class ListingOptionsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          categories = Category.where.not(booking_type: nil).includes(:parent).order(:name)

          render json: {
            categories: categories.map do |category|
              { id: category.id, slug: category.slug, name: category.name, booking_type: category.booking_type,
                parent_name: category.parent&.name, attribute_schema: category.attribute_schema }
            end
          }
        end
      end
    end
  end
end
