module Bookings
  # A guest changes a booking's dates or guests (PATCH /bookings/:id, RAA-134): starts_on,
  # ends_on and guests, each optional, a key left out keeping what the booking has. A stay's
  # split into rooms (room_guests) and pets (RAA-182) change the same way; a split sets the
  # guests, and new guests without one split them evenly again. The change
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
      guests = @params.key?(:guests) ? integer_value(:guests, "Guests", required: true) : @booking.guests
      room_guests = read_room_guests
      guests = guests_for(room_guests, guests, sent: @params.key?(:guests)) if @params.key?(:room_guests)
      pets = @booking.pets
      pets = @params[:pets].nil? ? error("Pets is required") : count_value(:pets, "Pets", max: 20) if @params.key?(:pets)
      error("Guests must be from 1 to #{MAX_GUESTS}") if guests.is_a?(Integer) && !guests.between?(1, MAX_GUESTS)
      error("A booking needs dates") if @errors.empty? && starts_on.nil?
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
        line = price(listing, starts_on, ends_on, party)
        raise_errors!(@booking)

        update_item(item, trip, starts_on, ends_on, party) if item
        update_booking(listing, line, starts_on, ends_on, party)
      end
    end

    private

    # A split sent (null drops it); otherwise the booking's, unless new guests are sent.
    def read_room_guests
      return room_guests_value if @params.key?(:room_guests)

      @params.key?(:guests) ? nil : @booking.room_guests
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
    def price(listing, starts_on, ends_on, party)
      return error("#{listing.title} isn't available to book any more") unless listing.active?

      guests, room_guests, pets = party.values_at(:guests, :room_guests, :pets)
      units = Booking.units_for(listing, guests, room_guests:)
      line = Bookings::Price.call(listing, starts_on:, ends_on:, quantity: units, guests:, room_guests:, pets:,
        except_booking: @booking)
      ledger = Availability::Ledger.new([ listing ], starts_on, ends_on, except: @booking)
      refusal = ledger.refusal(listing, Booking.days_for(listing.category.accommodation?, starts_on, ends_on), units)
      return error("#{listing.title}: #{refusal}") if refusal

      line.merge(units:)
    rescue ActiveRecord::RecordInvalid => e
      e.record.errors.full_messages.each { error("#{listing.title}: #{_1}") }
      nil
    end

    def update_item(item, trip, starts_on, ends_on, party)
      item.assign_attributes(starts_on:, ends_on:, quantity: party[:guests], room_guests: party[:room_guests], pets: party[:pets])
      trip.cover(starts_on, ends_on)
      trip.save!
      item.save!
    end

    def update_booking(listing, line, starts_on, ends_on, party)
      total = line[:total_cents]
      changes = {
        starts_on:, ends_on:, **party, quantity: line[:units],
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
      else
        Transition.call(@booking, "requested", actor: "guest", user: @user, reason:, attributes: changes)
      end
      @booking
    end
  end
end
