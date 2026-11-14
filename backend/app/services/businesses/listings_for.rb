module Businesses
  # A business's active listings as guests see them (GET /businesses/:id/listings, RAA-191):
  # the shop pop-up, where a group picks how many of each of a motorbike shop's models.
  # `category` (a slug) and `group` (Category::GUEST_GROUPS, so gear of every kind in one sheet)
  # narrow them; with both dates (ISO 8601, from today) each says how many
  # of its units are free on all of them (Availability::Ledger). A timed rental's are counted
  # from a pickup_time (RAA-195, "08:30"; the shop's default for the day when left out) to its
  # return, with the period it counted (starts_at, ends_at). With dates, a shop of timed
  # rentals also answers its `pickup_times` on the first day, still ahead, each available when
  # at least one of its models could start then (the pop-up's pickup time before a model is
  # picked); nil otherwise. A query string carries everything as text; a parameter sent empty
  # counts as not sent. The caller pages the listings: the block gets the ordered relation and
  # returns the page to show, and pickup_times are the page's.
  class ListingsFor < ApplicationService
    include Trips::Values

    ASSOCIATIONS = [ :area, :business, :cover_photo, :units, :stay_rate, { vehicle_rate: :delivery_zones }, :flat_rate, :tour_detail, *Listing::ACTIVITY_ASSOCIATIONS,
      { category: :parent } ].freeze

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
      pickup_time = read_pickup_time
      group = read_group
      raise_errors!(business)

      listings = business.listings.active.order(:title, :id)
      listings = listings.where(category_id: Category.where(slug: @params[:category]).select(:id)) if @params[:category].is_a?(String)
      listings = listings.in_guest_group(group) if group
      listings = yield(listings).includes(*ASSOCIATIONS).to_a
      ledger = Availability::Ledger.new(listings, starts_on, ends_on) if starts_on && listings.any?
      {
        business: { id: business.id, name: business.name },
        listings: listings.map { |listing| row(listing, ledger, starts_on, ends_on, pickup_time) },
        pickup_times: ledger && pickup_times(listings, ledger, starts_on, ends_on)
      }
    end

    private

    def read_pickup_time
      value = @params[:pickup_time]
      return if value.nil?
      return value if value.is_a?(String) && value.match?(Booking::PICKUP_TIME_FORMAT)

      error("Pickup time must be a time on the half hour, like 08:30")
    end

    def read_group
      value = @params[:group]
      return if value.nil?
      return value if Category::GUEST_GROUPS.include?(value)

      error("Group must be one of #{Category::GUEST_GROUPS.to_sentence(last_word_connector: ' or ')}")
    end

    def pickup_times(listings, ledger, starts_on, ends_on)
      rentals = listings.select { _1.category.timed_rental? && _1.vehicle_rate }
      return if rentals.empty?

      rentals.flat_map { _1.vehicle_rate.pickup_times_on(starts_on) }.uniq.sort.map do |time|
        period = Booking.rental_period(starts_on, ends_on, time)
        free = rentals.any? do |listing|
          listing.vehicle_rate.pickup_times_on(starts_on).include?(time) &&
            ledger.refusal(listing, Booking.days_for(listing, starts_on, ends_on), 1, period:).nil?
        end
        { time:, available: free }
      end
    end

    # None of a timed rental once the shop's last pickup on its start day has gone (RAA-315).
    def units_free(listing, ledger, days, period, starts_on)
      return 0 if listing.category.timed_rental? && listing.vehicle_rate && listing.vehicle_rate.pickup_times_on(starts_on).empty?

      ledger.units_free(listing, days, period:)
    end

    def row(listing, ledger, starts_on, ends_on, pickup_time)
      days = ledger && Booking.days_for(listing, starts_on, ends_on)
      period = ledger && listing.rental_period(starts_on, ends_on, pickup_time)
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
        unit_name: listing.category.unit_name,
        unit_name_plural: listing.category.unit_name_plural,
        approx_location: { lat: listing.location.y.round(2), lng: listing.location.x.round(2) },
        units_free: days&.any? ? units_free(listing, ledger, days, period, starts_on) : nil,
        starts_at: period&.begin,
        ends_at: period&.end
      }
    end
  end
end
