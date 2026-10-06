module Api
  module V1
    module Partner
      # What the add-listing form offers (RAA-41): bookable categories, each with the JSON
      # Schema its attrs must match, and the places a listing can be in.
      class ListingOptionsController < ApplicationController
        LISTABLE_AREA_KINDS = %w[city town island].freeze

        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          categories = Category.where.not(booking_type: nil).includes(:parent).order(:name)
          areas = Area.where(kind: LISTABLE_AREA_KINDS).includes(:parent).order(:name)

          render json: {
            categories: categories.map do |category|
              { id: category.id, slug: category.slug, name: category.name, booking_type: category.booking_type,
                parent_name: category.parent&.name, attribute_schema: category.attribute_schema }
            end,
            areas: areas.map do |area|
              AreaSerializer.call(area).merge(center: { lat: area.center.y, lng: area.center.x })
            end
          }
        end
      end
    end
  end
end
