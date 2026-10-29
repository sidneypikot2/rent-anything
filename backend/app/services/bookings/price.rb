module Bookings
  # What a trip item costs at checkout (RAA-132), re-quoted from the listing as it is now, in
  # centavos, with the breakdown the booking keeps:
  #
  # - a stay: Stays::Quote for its rooms (RAA-182), the guest's own split (room_guests) or
  #   the guests spread evenly, and its pets (it refuses dates that are blocked, fully booked
  #   or too short a stay, and a party the rooms can't take);
  # - a tour: its base price per group (private) or per joiner, times quantity;
  # - a rental vehicle (RAA-191): its daily price for each of its units and day; the refundable
  #   deposit for each is in the breakdown, never in the total (VehicleRate); with `delivery`
  #   and `return_pickup` (RAA-195), the shop's fee for each, for each vehicle;
  # - gear: its flat price for each item and day; a transfer: its flat price for each vehicle;
  # - anything still without a price (a rate of 0): 0 and `to_be_agreed`, settled with the partner.
  #
  # A rental's days are its nights, at least one: Nov 3 to Nov 5 is 2 days, a single day 1.
  # `quantity` is the units (Booking.units_for), `guests` the people. Preload the listing's
  # category: :parent, units, stay_rate, vehicle_rate, flat_rate, tour_detail and fees. `except_booking` is
  # a booking being re-priced for new dates (Bookings::Change), whose own nights stay free to it.
  class Price < ApplicationService
    def initialize(listing, starts_on:, ends_on:, quantity:, guests:, room_guests: nil, pets: 0, except_booking: nil,
      delivery: false, return_pickup: false)
      @listing = listing
      @delivery = delivery
      @return_pickup = return_pickup
      @except_booking = except_booking
      @starts_on = starts_on
      @ends_on = ends_on
      @quantity = quantity
      @guests = guests
      @room_guests = room_guests
      @pets = pets
    end

    def call
      if @listing.category.accommodation?
        stay
      elsif (tour = @listing.tour_detail)&.priced?
        unit_price = tour.base_price_cents
        { total_cents: unit_price * @quantity,
          breakdown: { kind: "tour", price_unit: tour.price_unit, unit_price_cents: unit_price, quantity: @quantity } }
      elsif (rate = @listing.vehicle_rate)&.priced?
        vehicle(rate)
      elsif (flat = @listing.flat_rate)&.priced?
        gear = @listing.category.gear?
        { total_cents: flat.price_cents * @quantity * (gear ? days : 1),
          breakdown: { kind: gear ? "gear" : "transfer", unit_price_cents: flat.price_cents, quantity: @quantity,
                       days: gear ? days : nil } }
      else
        { total_cents: 0, breakdown: { kind: "to_be_agreed", quantity: @quantity, to_be_agreed: true } }
      end
    end

    private

    def vehicle(rate)
      extras = {
        delivery_cents: (rate.delivery_fee_cents * @quantity if @delivery && rate.delivers?),
        return_pickup_cents: (rate.return_pickup_fee_cents * @quantity if @return_pickup && rate.picks_up?)
      }.compact
      { total_cents: (rate.daily_price_cents * @quantity * days) + extras.values.sum,
        breakdown: { kind: "vehicle", unit_price_cents: rate.daily_price_cents, quantity: @quantity, days:,
                     deposit_cents: rate.security_deposit_cents * @quantity, **extras } }
    end

    def days
      return 1 unless @starts_on && @ends_on

      [ (@ends_on - @starts_on).to_i, 1 ].max
    end

    # Without a split, the guests are all adults, as a trip item counts them.
    def stay
      party = @room_guests ? Stays::Arrangement.party_of(@room_guests) : { adults: @guests }
      quote = Stays::Quote.call(@listing, starts_on: @starts_on, ends_on: @ends_on, **party, room_guests: @room_guests,
        pets: @pets, except_booking: @except_booking)
      { total_cents: quote[:total_cents],
        breakdown: { kind: "stay", quantity: @quantity, pets: @pets,
                     rooms: quote[:rooms].map { _1.slice(:adults, :children, :infants, :total_cents) },
                     quote: quote.except(:starts_on, :ends_on, :rooms_free)
                       .merge(nights: quote[:nights].map { _1.merge(date: _1[:date].iso8601) }) } }
    end
  end
end
