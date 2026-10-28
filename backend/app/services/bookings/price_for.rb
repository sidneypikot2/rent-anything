module Bookings
  # What adding a listing to a trip would cost (GET /listings/:id/price, RAA-191), for the add
  # sheet: Price as checkout runs it, for any kind of listing, as lines a guest reads and a
  # total, with whether the dates can be had (Availability::Ledger). The query carries
  # everything as text: starts_on and ends_on (ISO 8601, both required), quantity (the people,
  # or gear's count; default 1), units (a rental vehicle's chosen vehicles), room_guests (a
  # stay's split, as JSON) and pets. A refused party or dates comes back as `unavailable`, not
  # an error, so the sheet can say why next to its total.
  class PriceFor < ApplicationService
    include Trips::Values

    def initialize(listing_id, params)
      @listing_id = listing_id
      @params = params.compact_blank
      @errors = []
    end

    def call
      listing = Listing.active.includes(*Checkouts::Create::ASSOCIATIONS).find(@listing_id)
      starts_on = required_date(:starts_on, "Start date")
      ends_on = required_date(:ends_on, "End date")
      error("The end date can't be before the start date") if starts_on && ends_on && ends_on < starts_on
      error("The start date can't be in the past") if starts_on && starts_on < Date.current
      guests = count_value(:quantity, "Quantity", max: TripItem::MAX_QUANTITY, digits: true) || 1
      error("Quantity must be at least 1") if guests.zero?
      chosen = integer_value(:units, "Units", digits: true)
      room_guests = room_guests_value(json: true)
      pets = count_value(:pets, "Pets", max: 20, digits: true) || 0
      raise_errors!(listing)

      guests = guests_for(room_guests, guests, sent: false)
      units = Booking.units_for(listing, guests, room_guests:, chosen:)
      stay = listing.category.accommodation?
      refusal = Availability::Ledger.new([ listing ], starts_on, ends_on).refusal(listing, Booking.days_for(stay, starts_on, ends_on), units)
      price = Price.call(listing, starts_on:, ends_on:, quantity: units, guests:, room_guests:, pets:)
      answer(listing, price, refusal)
    rescue ActiveRecord::RecordInvalid => e
      raise if e.record == listing || listing.nil?

      { total_cents: nil, deposit_cents: nil, lines: [], to_be_agreed: false, unavailable: e.record.errors.full_messages.join(". ") }
    end

    private

    def answer(listing, price, refusal)
      breakdown = price[:breakdown]
      {
        total_cents: price[:total_cents],
        deposit_cents: breakdown[:deposit_cents],
        lines: lines(listing, breakdown),
        to_be_agreed: breakdown[:to_be_agreed] == true,
        unavailable: refusal
      }
    end

    # What the total is made of, in the words the cart uses: "5 motorbikes × ₱500 × 2 days".
    def lines(listing, breakdown)
      unit = breakdown[:unit_price_cents]
      quantity = breakdown[:quantity]
      case breakdown[:kind]
      when "stay" then stay_lines(breakdown[:quote])
      when "tour"
        each = breakdown[:price_unit] == "group" ? "group" : "person"
        [ line("#{quantity} #{each.pluralize(quantity)} × #{peso(unit)}", unit * quantity) ]
      when "vehicle"
        noun = Trips::Values.vehicle_noun(listing)
        [ line("#{quantity} #{noun.pluralize(quantity)} × #{peso(unit)} × #{days(breakdown[:days])}", unit * quantity * breakdown[:days]) ]
      when "gear" then [ line("#{quantity} × #{peso(unit)} × #{days(breakdown[:days])}", unit * quantity * breakdown[:days]) ]
      when "transfer" then [ line("#{quantity} × #{peso(unit)} a trip", unit * quantity) ]
      else []
      end
    end

    def stay_lines(quote)
      nights = quote[:nights].size
      [
        line("#{nights} #{'night'.pluralize(nights)}", quote[:nightly_subtotal_cents]),
        (line("Extra guests", quote[:extra_guests_total_cents]) if quote[:extra_guests_total_cents].positive?),
        (line("Discount", -quote[:discount][:amount_cents]) if quote[:discount]),
        *quote[:fees].map { line(_1[:name], _1[:total_cents]) }
      ].compact
    end

    def line(label, amount_cents) = { label:, amount_cents: }
    def days(count) = "#{count} #{'day'.pluralize(count)}"

    def peso(cents)
      amount = cents % 100 == 0 ? cents / 100 : format("%.2f", cents / 100.0)
      "₱#{ActiveSupport::NumberHelper.number_to_delimited(amount)}"
    end
  end
end
