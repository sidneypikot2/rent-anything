module Stays
  # What a stay at an accommodation listing costs (RAA-104), in centavos, the way Airbnb and
  # Booking.com work it out from its StayRate:
  #
  # - each night at the partner's price for that day on the calendar (RAA-118), else the
  #   nightly price, or the weekend price on Friday and Saturday nights;
  #   a shared room's price is per guest, so the nights are multiplied by the guests;
  # - each guest above base_guests pays extra_guest_fee per night;
  # - the monthly discount from 28 nights, otherwise the weekly one from 7, comes off the
  #   nights and extra guests (rounded half up), never off fees;
  # - the listing's required fees and the optional ones picked (fee_ids), each multiplied by
  #   what it is charged per.
  #
  # Several rooms (RAA-182): the party (adults, `guests` alone meaning adults, children and
  # infants) is split across rooms by Arrangement, from the guest's own split (room_guests)
  # or evenly, and each room is priced as above for the guests who take a bed in it (adults,
  # and children and infants as the place counts them; Arrangement.counted). A fee charged per pet is charged once for the stay. The top-level amounts
  # are the rooms' together, each room's own are in `rooms`, and rooms_free is the fewest
  # rooms left on any of the nights.
  #
  # A night that is blocked or without enough rooms left is refused, and so is a stay
  # shorter than the minimum nights set for its check-in day. A refusal is a RecordInvalid.
  # `except_booking` is a booking being changed, whose own nights don't count against it.
  class Quote < ApplicationService
    PET_FEES = %w[pet pet_night].freeze

    def initialize(listing, starts_on:, ends_on:, guests: nil, adults: nil, children: 0, infants: 0, room_guests: nil,
      pets: 0, fee_ids: [], except_booking: nil)
      @listing = listing
      @except_booking = except_booking
      @rate = listing.stay_rate
      @starts_on = starts_on
      @ends_on = ends_on
      @party = { adults: adults || guests, children:, infants: }
      @room_guests = room_guests
      @pets = pets
      @fee_ids = fee_ids
      @errors = []
    end

    def call
      @ledger = Availability::Ledger.new([ @listing ], @starts_on, @ends_on, except: @except_booking) if @ends_on > @starts_on
      check!
      nights = (@starts_on...@ends_on).map { |date| night(date) }
      rooms = @rooms.map { room(_1, nights) }
      pet_fees = chosen_fees.select { @pets.positive? && PET_FEES.include?(_1.charged_per) }.map { fee_line(_1, nights.size, 0) }
      fees = merge_fees(rooms.flat_map { _1[:fees] }) + pet_fees

      {
        starts_on: @starts_on,
        ends_on: @ends_on,
        guests: @party.values.sum,
        nights:,
        nights_count: nights.size,
        per_guest: @rate.per_guest?,
        nightly_subtotal_cents: rooms.sum { _1[:nightly_subtotal_cents] },
        extra_guests: rooms.sum { _1[:extra_guests] },
        extra_guest_fee_cents: @rate.extra_guest_fee_cents,
        extra_guests_total_cents: rooms.sum { _1[:extra_guests_total_cents] },
        discount: rooms.first[:discount]&.merge(amount_cents: rooms.sum { _1[:discount][:amount_cents] }),
        fees:,
        total_cents: rooms.sum { _1[:total_cents] } + pet_fees.sum { _1[:total_cents] },
        rooms:,
        rooms_free: (@starts_on...@ends_on).map { @ledger.day(@listing, _1)[:units_left] }.min,
        pets: @pets
      }
    end

    private

    def check!
      return refuse!("Only accommodation is priced by the night") unless @rate
      return refuse!("This place has no price yet") unless @rate.priced?

      arrangement = Arrangement.new(@listing, **@party, room_guests: @room_guests, pets: @pets)
      @rooms = arrangement.rooms
      check_dates
      @errors.concat(arrangement.errors)
      check_fee_ids
      refuse! if @errors.any?
    end

    def check_dates
      return @errors << "Check-out must be after check-in" unless @ends_on > @starts_on
      return @errors << "Check-in can't be in the past" if @starts_on < Date.current

      nights = (@ends_on - @starts_on).to_i
      min_nights = @ledger.day(@listing, @starts_on)[:min_nights]
      if nights < min_nights
        @errors << "This place needs a stay of at least #{min_nights} nights"
      elsif @rate.max_nights && nights > @rate.max_nights
        @errors << "This place takes stays of at most #{@rate.max_nights} nights"
      end
      refusal = @ledger.refusal(@listing, @starts_on...@ends_on, units)
      @errors << "Those dates aren't available: #{refusal}" if refusal
    end

    # What the stay takes on the calendar: a shared room's beds, otherwise its rooms.
    def units
      return 1 unless @rooms

      @rate.per_guest? ? [ Arrangement.counted(@listing, @rooms.first), 1 ].max : @rooms.size
    end

    def check_fee_ids
      optional = @listing.fees.reject(&:required).map(&:id)
      @errors << "Add-ons must be this place's optional fees" unless (@fee_ids - optional).empty?
    end

    def refuse!(message = nil)
      @errors << message if message
      record = StayRate.new
      @errors.each { |error| record.errors.add(:base, error) }
      raise ActiveRecord::RecordInvalid, record
    end

    def night(date)
      { date:, price_cents: @ledger.day(@listing, date)[:price_cents], weekend: StayRate::WEEKEND_DAYS.include?(date.wday) }
    end

    # One room for the guests who take a bed in it.
    def room(party, nights)
      guests = Arrangement.counted(@listing, party)
      nightly_subtotal = nights.sum { _1[:price_cents] } * (@rate.per_guest? ? guests : 1)
      extra_guests = @rate.per_guest? ? 0 : [ guests - @rate.base_guests, 0 ].max
      extra_guests_total = extra_guests * @rate.extra_guest_fee_cents * nights.size
      discount = discount(nights.size, nightly_subtotal + extra_guests_total)
      fees = chosen_fees.reject { PET_FEES.include?(_1.charged_per) }.map { fee_line(_1, nights.size, guests) }

      party.merge(
        nightly_subtotal_cents: nightly_subtotal,
        extra_guests:,
        extra_guests_total_cents: extra_guests_total,
        discount:,
        fees:,
        total_cents: nightly_subtotal + extra_guests_total - (discount&.fetch(:amount_cents) || 0) +
          fees.sum { _1[:total_cents] }
      )
    end

    def discount(nights, amount)
      kind, percent =
        if nights >= StayRate::MONTHLY_NIGHTS && @rate.monthly_discount_percent.positive?
          [ "monthly", @rate.monthly_discount_percent ]
        elsif nights >= StayRate::WEEKLY_NIGHTS && @rate.weekly_discount_percent.positive?
          [ "weekly", @rate.weekly_discount_percent ]
        end
      kind && { kind:, percent:, amount_cents: (amount * percent + 50) / 100 }
    end

    def chosen_fees
      @listing.fees.select { |fee| fee.required || @fee_ids.include?(fee.id) }
    end

    def fee_line(fee, nights, guests)
      quantity = { "booking" => 1, "night" => nights, "guest" => guests, "guest_night" => guests * nights, "unit" => 1,
                   "pet" => @pets, "pet_night" => @pets * nights }
        .fetch(fee.charged_per)
      { id: fee.id, name: fee.name, charged_per: fee.charged_per, required: fee.required, quantity:,
        amount_cents: fee.amount_cents, total_cents: fee.amount_cents * quantity }
    end

    # The rooms' lines of one fee as one line, in the partner's order.
    def merge_fees(lines)
      lines.group_by { _1[:id] }.values.map do |same|
        same.first.merge(quantity: same.sum { _1[:quantity] }, total_cents: same.sum { _1[:total_cents] })
      end
    end
  end
end
