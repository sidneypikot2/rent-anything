module Businesses
  # A business's active listings as guests see them (GET /businesses/:id/listings, RAA-191):
  # the shop pop-up, where a group picks how many of each of a motorbike shop's models. Only
  # `category` (a slug) narrows them; with both dates (ISO 8601, from today) each says how many
  # of its units are free on all of them (Availability::Ledger). A query string carries
  # everything as text; a parameter sent empty counts as not sent.
  class ListingsFor < ApplicationService
    include Trips::Values

    ASSOCIATIONS = [ :area, :business, :cover_photo, :units, :stay_rate, :vehicle_rate, :flat_rate, :tour_detail, { category: :parent } ].freeze

    def initialize(business_id, params)
      @business_id = business_id
      @params = params.compact_blank
      @errors = []
    end

    def call
      business = Business.find(@business_id)
      starts_on, ends_on = read_dates("The listings")
      error("The end date can't be before the start date") if starts_on && ends_on && ends_on < starts_on
      error("The start date can't be in the past") if starts_on && starts_on < Date.current
      raise_errors!(business)

      listings = business.listings.active.includes(*ASSOCIATIONS).order(:title, :id).to_a
      listings.select! { _1.category.slug == @params[:category] } if @params[:category].is_a?(String)
      ledger = Availability::Ledger.new(listings, starts_on, ends_on) if starts_on && listings.any?
      {
        business: { id: business.id, name: business.name },
        listings: listings.map { |listing| row(listing, ledger, starts_on, ends_on) }
      }
    end

    private

    def row(listing, ledger, starts_on, ends_on)
      days = ledger && Booking.days_for(listing, starts_on, ends_on)
      {
        id: listing.id,
        title: listing.title,
        category: { slug: listing.category.slug, name: listing.category.name },
        area: { slug: listing.area.slug, name: listing.area.name },
        cover_photo_url: ListingPhotoSerializer.cover_url(listing),
        price_from_cents: PricingSerializer.price_from_cents(listing),
        price_unit: PricingSerializer.price_unit(listing),
        vehicle_rate: listing.vehicle_rate&.priced? ? PricingSerializer.vehicle_rate(listing.vehicle_rate) : nil,
        details: ListingDetailSerializer.details(listing),
        units_count: listing.units.size,
        units_free: days&.any? ? ledger.units_free(listing, days) : nil
      }
    end
  end
end
