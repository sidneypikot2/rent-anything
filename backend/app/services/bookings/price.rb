module Bookings
  # What a trip item costs at checkout (RAA-132), re-quoted from the listing as it is now, in
  # centavos, with the breakdown the booking keeps:
  #
  # - a stay: Stays::Quote for each of `quantity` units, the guests spread across them
  #   (it refuses dates that are blocked, fully booked or too short a stay);
  # - a tour: its base price per group (private) or per joiner, times quantity;
  # - a rental or transfer: not priced yet, so 0 and `to_be_agreed`, settled with the partner.
  #
  # Preload the listing's category, units, stay_rate, tour_detail and fees. `except_booking` is
  # a booking being re-priced for new dates (Bookings::Change), whose own nights stay free to it.
  class Price < ApplicationService
    def initialize(listing, starts_on:, ends_on:, quantity:, guests:, except_booking: nil)
      @listing = listing
      @except_booking = except_booking
      @starts_on = starts_on
      @ends_on = ends_on
      @quantity = quantity
      @guests = guests
    end

    def call
      if @listing.category.accommodation?
        stay
      elsif (tour = @listing.tour_detail)&.priced?
        unit_price = tour.base_price_cents
        { total_cents: unit_price * @quantity,
          breakdown: { kind: "tour", price_unit: tour.price_unit, unit_price_cents: unit_price, quantity: @quantity } }
      else
        { total_cents: 0, breakdown: { kind: "to_be_agreed", quantity: @quantity, to_be_agreed: true } }
      end
    end

    private

    def stay
      guests_per_unit = (@guests + @quantity - 1) / @quantity
      quote = Stays::Quote.call(@listing, starts_on: @starts_on, ends_on: @ends_on, guests: guests_per_unit,
        except_booking: @except_booking)
      { total_cents: quote[:total_cents] * @quantity,
        breakdown: { kind: "stay", quantity: @quantity, unit_total_cents: quote[:total_cents],
                     quote: quote.except(:starts_on, :ends_on).merge(nights: quote[:nights].map { _1.merge(date: _1[:date].iso8601) }) } }
    end
  end
end
