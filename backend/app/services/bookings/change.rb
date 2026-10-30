module Bookings
  # A guest changes a booking's dates or guests (PATCH /bookings/:id, RAA-134): starts_on,
  # ends_on and guests, each optional, a key left out keeping what the booking has. A stay's
  # split into rooms (room_guests) and pets (RAA-182) change the same way; a split sets the
  # guests, and new guests without one split them evenly again. A vehicle rental's pickup_time
  # (RAA-195) too: left out, it keeps the booking's. So do a vehicle's units (RAA-200), as on
  # its trip item: sent ones are checked against the guests, and new guests without them keep
  # the item's chosen units only while they still fit. Gear's guests are how many, and its
  # booking keeps no guests, as at checkout. The change
  # goes back to the partner as a request: the booking returns to requested, holding its new
  # days until the partner answers (Booking::REQUEST_TTL or its start), and is never accepted
  # automatically.
  #
  # Only a booking that holds its days and hasn't started can change (requested, accepted,
  # awaiting_payment, confirmed). Like checkout, it locks the trip, then the listing, re-prices
  # with Bookings::Price and checks a fresh Availability::Ledger, both leaving out the booking's
  # own days. Its trip item takes the same dates and guests, and the trip grows to cover them.
  # A paid booking keeps its payment; Payments::Stub confirms it again on that payment once the
  # partner accepts. Returns the booking.
  class Change < ApplicationService
    include Trips::Values

    CHANGEABLE = %w[requested accepted awaiting_payment confirmed].freeze
    # A trip item's quantity, which takes the same guests, goes up to 99.
    MAX_GUESTS = 99
    ASSOCIATIONS = Checkouts::Create::ASSOCIATIONS

    def initialize(booking, user:, params:)
      @booking = booking
      @user = user
      @params = params
      @errors = []
    end

    def call
      starts_on, ends_on = read_dates("A booking", [ @booking.starts_on, @booking.ends_on ])
      # Gear keeps no guests: its count is its quantity.
      guests = @params.key?(:guests) ? integer_value(:guests, "Guests", required: true) : @booking.guests || @booking.quantity
      room_guests = read_room_guests
      guests = guests_for(room_guests, guests, sent: @params.key?(:guests)) if @params.key?(:room_guests)
      pets = @booking.pets
      pets = @params[:pets].nil? ? error("Pets is required") : count_value(:pets, "Pets", max: 20) if @params.key?(:pets)
      error("Guests must be from 1 to #{MAX_GUESTS}") if guests.is_a?(Integer) && !guests.between?(1, MAX_GUESTS)
      error("A booking needs dates") if @errors.empty? && starts_on.nil?
      pickup_time = @params.key?(:pickup_time) ? pickup_time_value(@booking.listing) : @booking.pickup_time
      units = read_units(guests) if @errors.empty?
      raise_errors!(@booking)

      Booking.transaction do
        item = @booking.trip_item
        trip = item&.trip
        trip&.lock!
        listing = Listing.includes(*ASSOCIATIONS).lock.find(@booking.listing_id)
        @booking.lock!
        check_booking(starts_on)
        raise_errors!(@booking)

        party = { guests:, room_guests:, pets: }
        period = listing.rental_period(starts_on, ends_on, pickup_time)
        line = price(listing, starts_on, ends_on, party, period, units)
        raise_errors!(@booking)

        update_item(item, trip, starts_on, ends_on, party, period && pickup_time, units) if item
        update_booking(listing, line, starts_on, ends_on, party, period)
      end
    end

    private

    # A split sent (null drops it); otherwise the booking's, unless new guests are sent.
    def read_room_guests
      return room_guests_value if @params.key?(:room_guests)

      @params.key?(:guests) ? nil : @booking.room_guests
    end

    # A vehicle's chosen units: sent, or the trip item's while they still fit the guests.
    def read_units(guests)
      listing = @booking.listing
      chosen = @booking.trip_item&.units
      if @params.key?(:units)
        chosen = units_value
        check_vehicle_units(listing, guests, chosen) if @errors.empty?
      elsif @params.key?(:guests)
        check_vehicle_units(listing, guests, nil)
        seats = listing.vehicle_seats
        chosen = nil if chosen && seats && !chosen.between?(guests.fdiv(seats).ceil, guests)
      end
      chosen
    end

    def check_booking(starts_on)
      if !CHANGEABLE.include?(@booking.status)
        error("A booking that is #{@booking.status.humanize(capitalize: false)} can't be changed")
      elsif @booking.starts_on <= Date.current
        error("A booking that has started can't be changed")
      elsif starts_on < Date.current
        error("Start date can't be in the past")
      end
    end

    # Priced and checked as at checkout, with the booking's own days left free to it.
    def price(listing, starts_on, ends_on, party, period, chosen)
      return error("#{listing.title} isn't available to book any more") unless listing.active?

      guests, room_guests, pets = party.values_at(:guests, :room_guests, :pets)
      units = Booking.units_for(listing, guests, room_guests:, chosen:)
      line = Bookings::Price.call(listing, starts_on:, ends_on:, quantity: units, guests:, room_guests:, pets:,
        except_booking: @booking, delivery: @booking.delivery, return_pickup: @booking.return_pickup,
        child_helmets: @booking.child_helmets)
      ledger = Availability::Ledger.new([ listing ], starts_on, ends_on, except: @booking)
      refusal = ledger.refusal(listing, Booking.days_for(listing, starts_on, ends_on), units, period:)
      return error("#{listing.title}: #{refusal}") if refusal

      line.merge(units:)
    rescue ActiveRecord::RecordInvalid => e
      e.record.errors.full_messages.each { error("#{listing.title}: #{_1}") }
      nil
    end

    def update_item(item, trip, starts_on, ends_on, party, pickup_time, units)
      item.assign_attributes(starts_on:, ends_on:, quantity: party[:guests], room_guests: party[:room_guests], pets: party[:pets],
        pickup_time:, units:)
      trip.cover(starts_on, ends_on)
      trip.save!
      item.save!
    end

    def update_booking(listing, line, starts_on, ends_on, party, period)
      total = line[:total_cents]
      changes = {
        starts_on:, ends_on:, starts_at: period&.begin, ends_at: period&.end, **party, quantity: line[:units],
        guests: listing.category.gear? ? nil : party[:guests],
        total_cents: total, price_breakdown: line[:breakdown],
        commission_cents: (total * @booking.commission_bps + 5_000) / 10_000,
        expires_at: [ Time.current + Booking::REQUEST_TTL, starts_on.in_time_zone("UTC").beginning_of_day ].min
      }
      reason = "Changed by the guest"
      if @booking.requested?
        # Already waiting for the partner: the request carries the new details, and its clock
        # starts again. Recorded as an event, since its status doesn't change.
        @booking.update!(changes)
        @booking.events.create!(from_status: "requested", to_status: "requested", actor: "guest", user: @user, reason:)
        UserChannel.booking_updated(@booking)
      else
        Transition.call(@booking, "requested", actor: "guest", user: @user, reason:, attributes: changes)
      end
      @booking
    end
  end
end
