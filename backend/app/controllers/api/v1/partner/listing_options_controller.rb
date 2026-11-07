module Api
  module V1
    module Partner
      # What the add-listing form offers (RAA-41): bookable categories, each with the JSON
      # Schema its attrs must match, and what it means (RAA-82), and the cancellation policies a
      # listing can have (RAA-88), how guests book it (RAA-132; request only since RAA-134), and what a tour can include (RAA-110). A water activity comes with what pre-fills its builder (RAA-270). The area isn't chosen: it follows from the map pin.
      class ListingOptionsController < ApplicationController
        before_action :authenticate_user!
        before_action -> { require_role!("partner") }

        def show
          categories = Category.where.not(booking_type: nil).includes(:parent).order(:name)

          render json: {
            categories: categories.map do |category|
              { id: category.id, slug: category.slug, name: category.name, booking_type: category.booking_type,
                parent_name: category.parent&.name, description: category.description,
                attribute_schema: category.attribute_schema, activity_defaults: category.activity_defaults }
            end,
            cancellation_policies: Listing::CANCELLATION_POLICIES.map { |value, policy| { value:, **policy } },
            booking_modes: Listing::OFFERED_BOOKING_MODES.map { |value, mode| { value:, **mode } },
            tour_inclusions: TourInclusion::KINDS.map { |kind, options| { kind:, options: } },
            # What a water activity can include and add, from fixed lists (RAA-271).
            activity_inclusions: ActivityDetail::INCLUSIONS.map { |kind, name| { kind:, name: } },
            activity_add_ons: ActivityAddOn::KINDS.map { |kind, name| { kind:, name: } },
            activity_add_on_charged_per: ActivityAddOn::CHARGED_PER.map { |value, name| { value:, name: } }
          }
        end
      end
    end
  end
end
