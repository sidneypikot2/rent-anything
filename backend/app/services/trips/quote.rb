module Trips
  # What a trip's items would cost if booked now (GET /trips/:id/quote, RAA-139), so the cart
  # can show prices and problems before checkout. Each unbooked item is checked against one
  # Availability::Ledger for the trip's listings, then priced with Bookings::Price, as
  # Checkouts::Create does; nothing is held. A booked item gives its booking's total. An item
  # that can't be booked as it is has a `problem` and no price. Items of one listing are each
  # checked alone, so two that would take its last unit together both pass here; checkout
  # catches that.
  class Quote < ApplicationService
    def initialize(trip)
      @trip = trip
    end

    def call
      items = @trip.items.includes(:booking).to_a
      listing_ids = items.map(&:listing_id).uniq
      @listings = Listing.where(id: listing_ids).includes(*Checkouts::Create::ASSOCIATIONS).index_by(&:id)
      @ledger = ledger(items)
      lines = items.map { line(_1) }
      priced = lines.select { _1[:problem].nil? }
      { trip_id: @trip.id, total_cents: priced.sum { _1[:total_cents] }, to_be_agreed_count: priced.count { _1[:to_be_agreed] },
        items: lines }
    end

    private

    def ledger(items)
      dated = items.reject { _1.booking || _1.starts_on.nil? || _1.starts_on < Date.current }
      return if dated.empty?

      Availability::Ledger.new(@listings.values_at(*dated.map(&:listing_id).uniq), dated.map(&:starts_on).min,
        dated.map(&:ends_on).max)
    end

    def line(item)
      return booked(item) if item.booking

      listing = @listings.fetch(item.listing_id)
      problem = problem(item, listing)
      return { trip_item_id: item.id, total_cents: nil, to_be_agreed: false, problem: } if problem

      units = Booking.units_for(listing, item.quantity, room_guests: item.room_guests)
      price = Bookings::Price.call(listing, starts_on: item.starts_on, ends_on: item.ends_on, quantity: units,
        guests: item.quantity, room_guests: item.room_guests, pets: item.pets)
      { trip_item_id: item.id, total_cents: price[:total_cents], to_be_agreed: price.dig(:breakdown, :to_be_agreed) == true,
        problem: nil }
    rescue ActiveRecord::RecordInvalid => e
      { trip_item_id: item.id, total_cents: nil, to_be_agreed: false, problem: e.record.errors.full_messages.join(". ") }
    end

    def booked(item)
      booking = item.booking
      { trip_item_id: item.id, total_cents: booking.total_cents,
        to_be_agreed: booking.price_breakdown["to_be_agreed"] == true, problem: nil }
    end

    def problem(item, listing)
      return "Isn't available to book any more" unless listing.active?
      return "Pick a date to book it" if item.starts_on.nil?
      return "Its dates have passed" if item.starts_on < Date.current

      days = Booking.days_for(listing.category.accommodation?, item.starts_on, item.ends_on)
      @ledger.refusal(listing, days, Booking.units_for(listing, item.quantity, room_guests: item.room_guests))
    end
  end
end
