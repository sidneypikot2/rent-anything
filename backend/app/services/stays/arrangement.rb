module Stays
  # How a party fits a stay's rooms (RAA-182): one { adults:, children:, infants: } per room
  # booked, the one source of truth for Quote, Bookings::Price and Booking.units_for.
  #
  # - The guest's own split (room_guests): each room has an adult and no more guests than it
  #   sleeps, the rooms add up to the party, and the listing has that many rooms.
  # - Otherwise the fewest rooms that sleep the party, its guests spread evenly, an adult in
  #   each, as Booking.units_for has always counted them.
  # - A shared room is priced per bed, so it takes no split: one entry for the whole party.
  #
  # Adults always take a bed; children do unless the stay says not (attrs children_count),
  # infants only if it says so (infants_count). Pets never count as guests: a stay takes them
  # only with pets_allowed, up to max_pets. A refusal is a RecordInvalid; `new(...).errors`
  # gives the reasons without raising, for a caller that adds its own.
  class Arrangement < ApplicationService
    KINDS = %i[adults children infants].freeze

    # The party a split adds up to.
    def self.party_of(room_guests)
      KINDS.index_with { |kind| room_guests.sum { _1[kind] || _1[kind.to_s] || 0 } }
    end

    # The guests of `room` who take a bed in `listing`.
    def self.counted(listing, room)
      KINDS.sum { |kind| counts?(listing, kind) ? room[kind] : 0 }
    end

    def self.counts?(listing, kind)
      case kind
      when :adults then true
      when :children then listing.attrs["children_count"] != false
      when :infants then listing.attrs["infants_count"] == true
      end
    end

    # Why `listing` can't take `pets`, or nil.
    def self.pets_refusal(listing, pets)
      return if pets.zero?

      max = listing.attrs["max_pets"]
      if listing.attrs["pets_allowed"] != true
        "This place doesn't allow pets"
      elsif max.is_a?(Integer) && pets > max
        "This place allows at most #{max} #{'pet'.pluralize(max)}"
      end
    end

    attr_reader :errors

    def initialize(listing, adults:, children: 0, infants: 0, room_guests: nil, pets: 0)
      @listing = listing
      @party = { adults:, children:, infants: }
      @room_guests = room_guests&.map { |room| KINDS.index_with { room[_1] || room[_1.to_s] || 0 } }
      @pets = pets
      @sleeps = listing.attrs["guests"] if listing.attrs["guests"].is_a?(Integer) && listing.attrs["guests"].positive?
      @errors = []
      @rooms = arrange
    end

    def call
      return rooms if errors.empty?

      record = StayRate.new
      errors.each { record.errors.add(:base, _1) }
      raise ActiveRecord::RecordInvalid, record
    end

    # The rooms, or nil when refused.
    def rooms
      @rooms if errors.empty?
    end

    private

    def arrange
      check_pets
      return @errors << "Guests must be at least 1" if @party.values.sum < 1
      return @errors << "A stay needs an adult" if @party[:adults] < 1 && @room_guests.nil?

      if @listing.stay_rate&.per_guest?
        shared_room
      elsif @room_guests
        given_rooms
      else
        even_rooms
      end
    end

    def check_pets
      refusal = self.class.pets_refusal(@listing, @pets)
      @errors << refusal if refusal
    end

    def shared_room
      return @errors << "A shared room is booked by the bed, not by the room" if @room_guests
      return @errors << sleeps_at_most(@sleeps) if @sleeps && counted(@party) > @sleeps

      [ @party ]
    end

    def given_rooms
      rooms = @room_guests
      @errors << "Each room needs an adult" if rooms.any? { _1[:adults] < 1 }
      if @sleeps && rooms.any? { counted(_1) > @sleeps }
        @errors << "A room here sleeps at most #{@sleeps} #{'guest'.pluralize(@sleeps)}"
      end
      @errors << "The rooms must add up to the party" if self.class.party_of(rooms) != @party
      available = @listing.units.size
      @errors << "This place has #{available} #{'room'.pluralize(available)}" if rooms.size > available
      rooms
    end

    # The fewest rooms that sleep the party: each room's beds filled to an even share,
    # an adult first in each, then the other adults and the children who take a bed, round
    # the rooms; those who don't take one are spread evenly.
    def even_rooms
      heads = counted(@party)
      count = @sleeps ? [ heads.fdiv(@sleeps).ceil, 1 ].max : 1
      max = @listing.max_guests
      return @errors << sleeps_at_most(max) if max && heads > max
      return @errors << "Each room needs an adult: #{count} rooms for #{@party[:adults]}" if @party[:adults] < count

      rooms = Array.new(count) { { adults: 1, children: 0, infants: 0 } }
      space = Array.new(count) { |i| heads / count + (i < heads % count ? 1 : 0) - 1 }
      left = @party.merge(adults: @party[:adults] - count)
      at = 0
      KINDS.each do |kind|
        left[kind].times do |n|
          if counts?(kind)
            at = (at + 1) % count until space[at].positive?
            space[at] -= 1
            rooms[at][kind] += 1
            at = (at + 1) % count
          else
            rooms[n % count][kind] += 1
          end
        end
      end
      rooms
    end

    def sleeps_at_most(max)
      rooms = @listing.stay_rate&.per_guest? ? 1 : @listing.units.size
      in_rooms = rooms > 1 ? " in #{rooms} rooms" : ""
      "This place sleeps at most #{max} #{'guest'.pluralize(max)}#{in_rooms}"
    end

    def counted(room) = self.class.counted(@listing, room)
    def counts?(kind) = self.class.counts?(@listing, kind)
  end
end
