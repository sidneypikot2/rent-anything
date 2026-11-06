module Notifications
  # A request's details for the email a partner answers it from (RAA-260), as the booking is
  # now: { payout:, reference:, answer_by:, rows: }, rows being [label, value] pairs. The partner
  # sees their payout, never the total or the commission. The guest's contact details, notes and
  # delivery address stay on the site, behind their sign-in.
  class RequestDetails < ApplicationService
    def initialize(booking)
      @booking = booking
      @listing = booking.listing
    end

    def call
      { payout:, reference: @booking.reference, answer_by:, rows: }
    end

    private

    def payout
      @booking.to_be_agreed? ? "To be agreed with the guest" : Copy.peso(@booking.payout_cents)
    end

    def answer_by
      @booking.expires_at && Copy.moment(@booking.expires_at)
    end

    def rows
      [
        [ "Listing", @listing.title ],
        [ "Business", @listing.business.name ],
        [ "Guest", @booking.guest_name ],
        *dates,
        *party,
        *delivery
      ]
    end

    def dates
      if @booking.starts_at
        [ [ "Pickup", moment(@booking.starts_at) ], [ "Return", moment(@booking.ends_at) ] ]
      elsif @listing.category.accommodation?
        [ [ "Check-in", day(@booking.starts_on) ], [ "Check-out", day(@booking.ends_on) ],
          [ "Nights", (@booking.ends_on - @booking.starts_on).to_i.to_s ] ]
      else
        [ [ "Dates", [ @booking.starts_on, @booking.ends_on ].uniq.map { day(_1) }.join(" – ") ] ]
      end
    end

    # "3 guests, 2 rooms, 1 pet". A joiner tour's quantity is its guests, so it isn't said twice.
    def party
      parts = [ count(@booking.guests.to_i, "guest"), rooms_or_units, count(@booking.pets, "pet") ].compact
      parts.empty? ? [] : [ [ "Party", parts.join(", ") ] ]
    end

    def rooms_or_units
      return count(@booking.room_guests.size, "room") if @booking.room_guests.present?

      unit = Availability::Ledger.capacity_unit(@listing)
      count(@booking.quantity, unit == "groups" ? "group" : "unit") unless unit == "seats"
    end

    def delivery
      how = [ ("delivery" if @booking.delivery), ("return pick-up" if @booking.return_pickup) ].compact.join(" and ").upcase_first
      how.empty? ? [] : [ [ "Delivery", how ] ]
    end

    def count(number, noun)
      "#{number} #{noun.pluralize(number)}" if number.positive?
    end

    def day(date)
      date.strftime("%b %-d, %Y")
    end

    def moment(time)
      time.in_time_zone(Copy::TIME_ZONE).strftime("%b %-d, %Y, %-l:%M %p")
    end
  end
end
