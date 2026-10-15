module Bookings
  # A booking the partner took outside the app (RAA-118), so the calendar counts it: the
  # guest's name, starts_on and ends_on (a stay's check-in and check-out), quantity (units, or
  # a tour's groups; 1 to Booking::MAX_QUANTITY), total_cents (what the guest pays the
  # partner, 0 or more) and optional notes. Refused on any day it would take that is blocked
  # or hasn't `quantity` left, and for a stay shorter than the check-in day's minimum nights
  # or longer than the listing's maximum. Checkout (M4) will make bookings itself.
  class CreateOffline < ApplicationService
    include Trips::Values

    MAX_DAYS = 366

    def initialize(listing, params)
      @listing = listing
      @params = params
      @errors = []
      @stay = listing.category.accommodation?
    end

    def call
      guest_name = read_guest_name
      from = required_date(:starts_on, @stay ? "Check-in" : "Start date")
      to = required_date(:ends_on, @stay ? "Check-out" : "End date")
      check_range(from, to) if from && to
      quantity = read_quantity
      total_cents = read_total
      notes = read_notes
      raise_errors!(Booking.new)

      Listing.transaction do
        @listing.lock!
        check_available!(from, to, quantity)
        @listing.bookings.create!(guest_name:, starts_on: from, ends_on: to, quantity:, total_cents:, notes:,
          source: "offline", status: "confirmed")
      end
    end

    private

    def read_guest_name
      name = required_string(@params, :guest_name, "Guest name")
      if name && name.length > Booking::GUEST_NAME_LENGTH
        error("Guest name can be at most #{Booking::GUEST_NAME_LENGTH} characters")
      end
      name
    end

    def check_range(from, to)
      error(@stay ? "Check-in can't be in the past" : "A booking can't start in the past") if from < Date.current
      if @stay && to <= from
        error("Check-out must be after check-in")
      elsif to < from
        error("End date can't be before the start date")
      end
      error("A booking can be at most #{MAX_DAYS} days long") if (to - from).to_i >= MAX_DAYS
    end

    def read_quantity
      value = @params[:quantity]
      return value if value.is_a?(Integer) && value.between?(1, Booking::MAX_QUANTITY)

      error("Quantity must be a whole number from 1 to #{Booking::MAX_QUANTITY}")
    end

    def read_total
      value = @params[:total_cents]
      return value if value.is_a?(Integer) && value >= 0

      error("Total must be a whole number of centavos, 0 or more")
    end

    def read_notes
      notes = optional_string(@params, :notes, "Notes") || ""
      error("Notes can be at most #{Booking::NOTES_LENGTH} characters") if notes.length > Booking::NOTES_LENGTH
      notes
    end

    def check_available!(from, to, quantity)
      ledger = Availability::Ledger.new([ @listing ], from, to)
      days = Booking.days_for(@stay, from, to)
      error(ledger.refusal(@listing, days, quantity))
      check_nights(ledger.day(@listing, from)[:min_nights], days.count) if @stay
      raise_errors!(Booking.new)
    end

    def check_nights(min_nights, nights)
      max_nights = @listing.stay_rate&.max_nights
      if min_nights && nights < min_nights
        error("Stays checking in that day are at least #{min_nights} nights")
      elsif max_nights && nights > max_nights
        error("This place takes stays of at most #{max_nights} nights")
      end
    end
  end
end
