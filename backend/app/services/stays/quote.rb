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
  #   what it is charged per. One unit is quoted.
  #
  # A night that is blocked or fully booked on the calendar is refused, and so is a stay
  # shorter than the minimum nights set for its check-in day. A refusal is a RecordInvalid.
  class Quote < ApplicationService
    def initialize(listing, starts_on:, ends_on:, guests:, fee_ids: [])
      @listing = listing
      @rate = listing.stay_rate
      @starts_on = starts_on
      @ends_on = ends_on
      @guests = guests
      @fee_ids = fee_ids
      @errors = []
    end

    def call
      @ledger = Availability::Ledger.new([ @listing ], @starts_on, @ends_on) if @ends_on > @starts_on
      check!
      nights = (@starts_on...@ends_on).map { |date| night(date) }
      nightly_subtotal = nights.sum { _1[:price_cents] } * (@rate.per_guest? ? @guests : 1)
      extra_guests = @rate.per_guest? ? 0 : [ @guests - @rate.base_guests, 0 ].max
      extra_guests_total = extra_guests * @rate.extra_guest_fee_cents * nights.size
      discount = discount(nights.size, nightly_subtotal + extra_guests_total)
      fees = chosen_fees.map { |fee| fee_line(fee, nights.size) }

      {
        starts_on: @starts_on,
        ends_on: @ends_on,
        guests: @guests,
        nights:,
        nights_count: nights.size,
        per_guest: @rate.per_guest?,
        nightly_subtotal_cents: nightly_subtotal,
        extra_guests:,
        extra_guest_fee_cents: @rate.extra_guest_fee_cents,
        extra_guests_total_cents: extra_guests_total,
        discount:,
        fees:,
        total_cents: nightly_subtotal + extra_guests_total - (discount&.fetch(:amount_cents) || 0) +
          fees.sum { _1[:total_cents] }
      }
    end

    private

    def check!
      return refuse!("Only accommodation is priced by the night") unless @rate
      return refuse!("This place has no price yet") unless @rate.priced?

      check_dates
      check_guests
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
      refusal = @ledger.refusal(@listing, @starts_on...@ends_on, 1)
      @errors << "Those dates aren't available: #{refusal}" if refusal
    end

    def check_guests
      sleeps = @listing.attrs["guests"]
      if @guests < 1
        @errors << "Guests must be at least 1"
      elsif sleeps.is_a?(Integer) && @guests > sleeps
        @errors << "This place sleeps at most #{sleeps} #{'guest'.pluralize(sleeps)}"
      end
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

    def fee_line(fee, nights)
      quantity = { "booking" => 1, "night" => nights, "guest" => @guests, "guest_night" => @guests * nights, "unit" => 1 }
        .fetch(fee.charged_per)
      { id: fee.id, name: fee.name, charged_per: fee.charged_per, required: fee.required, quantity:,
        amount_cents: fee.amount_cents, total_cents: fee.amount_cents * quantity }
    end
  end
end
