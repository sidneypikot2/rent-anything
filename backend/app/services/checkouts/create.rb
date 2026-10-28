module Checkouts
  # A guest books some of a trip's items (POST /checkouts, RAA-132): trip_id, item_ids (1 to
  # MAX_ITEMS of that trip's items) and an idempotency_key (8 to 80 characters, made by the
  # client for this checkout). Sending a key again returns the checkout it made.
  #
  # Every item is re-priced (Bookings::Price) and checked against the calendar as it is now,
  # and the checkout is all or nothing: one refusal, named after its listing, refuses it all.
  # Inside one transaction the trip is locked, then the listings in id order (so two checkouts
  # can't deadlock), and each item checks a fresh Availability::Ledger, which counts the
  # bookings this checkout has made already. Each item becomes one booking that snapshots its
  # price breakdown, the category's commission, the cancellation policy and the booking mode:
  #
  # - an instant-book listing's is held for payment (awaiting_payment, Booking::PAYMENT_TTL);
  # - a request-to-book listing's is a request (requested, Booking::REQUEST_TTL or its start).
  #
  # Both hold their days from the moment they are made. Afterwards requests are accepted at
  # once while Bookings.auto_accept? is on; the guest pays for what is held for payment
  # afterwards (Payments::Pay, RAA-143). A guest with no email yet (RAA-175) also sends
  # `contact` (Guests::ClaimContact), and each booking keeps its own copy of the guest's
  # name, email and phone, which partners keep after an unregistered guest is purged.
  # Returns the checkout.
  class Create < ApplicationService
    include Trips::Values

    MAX_ITEMS = 20
    KEY_LENGTH = 8..80
    ASSOCIATIONS = %i[category units stay_rate tour_detail fees].freeze

    def initialize(user, params)
      @user = user
      @params = params
      @errors = []
    end

    def call
      trip_id = integer_value(:trip_id, "Trip", required: true)
      item_ids = read_item_ids
      key = read_key
      raise_errors!(Checkout.new)

      existing = @user.checkouts.find_by(idempotency_key: key)
      return replay(existing, trip_id) if existing

      trip = @user.trips.find(trip_id)
      Guests::ClaimContact.call(@user, @params[:contact]) if @user.anonymous?
      checkout = book(trip, item_ids, key)
      settle(checkout)
    rescue ActiveRecord::RecordNotUnique
      # The same key sent twice at once: the other request made the checkout. Otherwise an
      # item was booked by another checkout meanwhile (one booking holds an item).
      existing = @user.checkouts.find_by(idempotency_key: key)
      return replay(existing, trip_id) if existing

      error("Some of those items were booked meanwhile")
      raise_errors!(Checkout.new)
    end

    private

    def read_item_ids
      ids = @params[:item_ids]
      if !ids.is_a?(Array) || ids.empty? || !ids.all?(Integer)
        error("Items must be a list of the trip's item ids")
      elsif ids.size > MAX_ITEMS
        error("A checkout can book at most #{MAX_ITEMS} items")
      else
        ids.uniq
      end
    end

    def read_key
      key = @params[:idempotency_key]
      return key if key.is_a?(String) && KEY_LENGTH.cover?(key.length)

      error("Idempotency key must be text of #{KEY_LENGTH.min} to #{KEY_LENGTH.max} characters")
    end

    def replay(checkout, trip_id)
      return checkout if checkout.trip_id == trip_id

      error("That idempotency key was used for another checkout")
      raise_errors!(Checkout.new)
    end

    def book(trip, item_ids, key)
      Trip.transaction do
        trip.lock!
        items = trip.items.where(id: item_ids).includes(:listing, :booking).to_a
        error("Some of those items aren't in this trip") if items.size != item_ids.size
        items.each { check_item(_1) }
        raise_errors!(Checkout.new)

        listings = Listing.where(id: items.map(&:listing_id)).includes(*ASSOCIATIONS).order(:id).lock.index_by(&:id)
        priced = items.sort_by { [ _1.starts_on, _1.id ] }.map { |item| price(item, listings.fetch(item.listing_id)) }
        raise_errors!(Checkout.new)

        checkout = @user.checkouts.create!(trip:, idempotency_key: key, total_cents: priced.sum { _1[:total_cents] })
        priced.each { |line| create_booking(checkout, line) }
        raise_errors!(Checkout.new)
        checkout
      end
    end

    def check_item(item)
      title = item.listing.title
      if item.starts_on.nil?
        error("#{title}: pick dates before booking it")
      elsif item.starts_on < Date.current
        error("#{title}: its dates have passed")
      elsif item.booking
        error("#{title} is already booked")
      end
    end

    # A trip item's quantity is its guests, or for gear how many; the units they take come from
    # the listing (Booking.units_for), or a stay's split into rooms (RAA-182).
    def price(item, listing)
      return error("#{listing.title} isn't available to book any more") || { total_cents: 0 } unless listing.active?

      units = Booking.units_for(listing, item.quantity, room_guests: item.room_guests, chosen: item.units)
      price = Bookings::Price.call(listing, starts_on: item.starts_on, ends_on: item.ends_on, quantity: units,
        guests: item.quantity, room_guests: item.room_guests, pets: item.pets)
      price.merge(item:, listing:, units:)
    rescue ActiveRecord::RecordInvalid => e
      e.record.errors.full_messages.each { error("#{listing.title}: #{_1}") }
      { total_cents: 0, item:, listing: }
    end

    # Checked against the calendar again here, after the bookings made before it in this
    # checkout, so two items of one listing can't take its last unit twice.
    def create_booking(checkout, line)
      item = line[:item]
      listing = line[:listing]
      stay = listing.category.accommodation?
      ledger = Availability::Ledger.new([ listing ], item.starts_on, item.ends_on)
      refusal = ledger.refusal(listing, Booking.days_for(stay, item.starts_on, item.ends_on), line[:units])
      return error("#{listing.title}: #{refusal}") if refusal

      instant = listing.booking_mode == "instant"
      booking = listing.bookings.create!(
        source: "checkout", checkout:, user: @user, trip_item: item, guest_name: guest_name,
        guest_email: @user.email, guest_phone: @user.phone,
        starts_on: item.starts_on, ends_on: item.ends_on, quantity: line[:units], guests: guests_of(item, listing),
        room_guests: item.room_guests, pets: item.pets,
        status: instant ? "awaiting_payment" : "requested", expires_at: expires_at(instant, item),
        total_cents: line[:total_cents], price_breakdown: line[:breakdown],
        commission_bps: listing.category.commission_bps,
        commission_cents: (line[:total_cents] * listing.category.commission_bps + 5_000) / 10_000,
        cancellation_policy: listing.cancellation_policy, booking_mode: listing.booking_mode
      )
      Bookings::Transition.record_start(booking, actor: "guest", user: @user)
    end

    # Gear isn't sized by people: its booking has a count (quantity) and no guests.
    def guests_of(item, listing)
      listing.category.gear? ? nil : item.quantity.clamp(1, Booking::MAX_QUANTITY)
    end

    def expires_at(instant, item)
      now = Time.current
      instant ? now + Booking::PAYMENT_TTL : [ now + Booking::REQUEST_TTL, item.starts_on.in_time_zone("UTC").beginning_of_day ].min
    end

    def guest_name
      (@user.name.presence || @user.email).first(Booking::GUEST_NAME_LENGTH)
    end

    # Outside the booking transaction: accept the requests while auto-accept is on. Nothing is
    # paid here; the guest pays for what is held for payment from the cart (Payments::Pay).
    def settle(checkout)
      if Bookings.auto_accept?
        checkout.bookings.requested.each do |booking|
          Bookings::Transition.call(booking, "accepted", actor: "system", reason: "Accepted automatically")
          Bookings::Transition.call(booking, "awaiting_payment", actor: "system")
        end
      end
      checkout.reload
    end
  end
end
