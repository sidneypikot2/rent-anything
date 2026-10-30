module Bookings
  # What adding a listing to a trip would cost (GET /listings/:id/price, RAA-191), for the add
  # sheet: Price as checkout runs it, for any kind of listing, as lines a guest reads and a
  # total, with whether the dates can be had (Availability::Ledger). The query carries
  # everything as text: starts_on and ends_on (ISO 8601, both required), quantity (the people,
  # or gear's count; default 1), units (a rental vehicle's chosen vehicles), room_guests (a
  # stay's split, as JSON), pets and a vehicle rental's pickup_time (RAA-195, "08:30"), delivery
  # and return_pickup ("true" adds the shop's fee for each vehicle, a line each) and the guest's
  # pin, delivery_lat and delivery_lng (RAA-205: the fee of its zone, or `unavailable` beyond
  # the farthest; without one, the nearest zone's). A refused
  # party or dates comes back as `unavailable`, not an error, so the sheet can say why next to
  # its total. A vehicle rental also answers its `pickup_times`, each of the shop's with whether
  # the rental could start then, and when it `returns_at` from the pickup time asked for (or the
  # shop's default); both nil for anything else.
  class PriceFor < ApplicationService
    include Trips::Values

    def initialize(listing_id, params)
      @listing_id = listing_id
      @params = params.compact_blank
      @errors = []
      return unless @params.key?(:delivery_lat) || @params.key?(:delivery_lng)

      @params[:delivery_location] = { lat: @params.delete(:delivery_lat), lng: @params.delete(:delivery_lng) }
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
      pickup_time = pickup_time_value(listing)
      delivery = delivery_values(listing, address: false)
      child_helmets = child_helmets_value(listing, digits: true) || 0
      raise_errors!(listing)

      guests = guests_for(room_guests, guests, sent: false)
      units = Booking.units_for(listing, guests, room_guests:, chosen:)
      check_child_helmets(child_helmets, units)
      raise_errors!(listing)
      ledger = Availability::Ledger.new([ listing ], starts_on, ends_on)
      days = Booking.days_for(listing, starts_on, ends_on)
      rental = rental(listing, ledger, days, units, starts_on, ends_on, pickup_time)
      refusal = rental[:none_left] || ledger.refusal(listing, days, units, period: rental[:period])
      price = Price.call(listing, starts_on:, ends_on:, quantity: units, guests:, room_guests:, pets:,
        child_helmets:, **delivery.slice(:delivery, :return_pickup, :delivery_distance_m))
      answer(listing, price, refusal, rental)
    rescue ActiveRecord::RecordInvalid => e
      raise if e.record == listing || listing.nil?

      { total_cents: nil, deposit_cents: nil, lines: [], to_be_agreed: false, unavailable: e.record.errors.full_messages.join(". "),
        pickup_times: nil, returns_at: nil }
    end

    private

    def answer(listing, price, refusal, rental)
      breakdown = price[:breakdown]
      {
        total_cents: price[:total_cents],
        deposit_cents: breakdown[:deposit_cents],
        lines: lines(listing, breakdown),
        to_be_agreed: breakdown[:to_be_agreed] == true,
        unavailable: refusal,
        pickup_times: rental[:pickup_times],
        returns_at: rental[:period]&.end
      }
    end

    # A vehicle rental's period from the pickup time asked for, and each of the shop's pickup
    # times with whether `units` of it could start then.
    def rental(listing, ledger, days, units, starts_on, ends_on, pickup_time)
      rate = listing.vehicle_rate
      return {} unless listing.category.vehicle? && rate

      # Only times still ahead: today's past ones aren't taken, just gone.
      times = rate.pickup_times_on(starts_on).map do |time|
        period = Booking.rental_period(starts_on, ends_on, time)
        { time:, available: ledger.refusal(listing, days, units, period:).nil? }
      end
      none_left = "No pickups left on #{starts_on.strftime('%b %-d')}: pick a later date" if times.empty?
      { period: listing.rental_period(starts_on, ends_on, pickup_time), pickup_times: times, none_left: }
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
        [
          line("#{quantity} #{noun.pluralize(quantity)} × #{peso(unit)} × #{days(breakdown[:days])}", unit * quantity * breakdown[:days]),
          (line("Delivery · #{quantity} × #{peso(breakdown[:delivery_cents] / quantity)}", breakdown[:delivery_cents]) if breakdown[:delivery_cents]),
          (line("Pick-up at the end · #{quantity} × #{peso(breakdown[:return_pickup_cents] / quantity)}", breakdown[:return_pickup_cents]) if breakdown[:return_pickup_cents]),
          child_helmets_line(breakdown)
        ].compact
      when "gear" then [ line("#{quantity} × #{peso(unit)} × #{days(breakdown[:days])}", unit * quantity * breakdown[:days]) ]
      when "transfer" then [ line("#{quantity} × #{peso(unit)} a trip", unit * quantity) ]
      else []
      end
    end

    # "Child helmets · 2 × ₱50 × 3 days", or "Child helmets · 2, included" when the shop gives them free.
    def child_helmets_line(breakdown)
      helmets = breakdown[:child_helmets].to_i
      return if helmets.zero?

      cents = breakdown[:child_helmets_cents].to_i
      return line("Child helmets · #{helmets}, included", 0) if cents.zero?

      line("Child helmets · #{helmets} × #{peso(cents / helmets / breakdown[:days])} × #{days(breakdown[:days])}", cents)
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
