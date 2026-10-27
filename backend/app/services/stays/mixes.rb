module Stays
  # Ways to sleep a party in a mix of one business's room types (RAA-187), each room type a
  # stay listing: GET /stay_mixes, read by MixesFor. Pricing stays here, through Quote.
  #
  # - Each listing takes 0 up to its fewest rooms left over the nights (one Ledger for them
  #   all); a shared room counts beds instead. The candidates go smallest counts first, at
  #   most MAX_CANDIDATES of them.
  # - A candidate is filled as Arrangement's even fill does: an adult in each room, then the
  #   other adults and the children round the rooms with beds left (one who doesn't take a
  #   bed there goes in anyway), the infants round the private rooms. A shared room's beds
  #   must all be taken: one part-filled is a smaller candidate. Infants never go in a shared
  #   room, which is booked by the bed (Booking.units_for counts every guest there).
  # - The pets go to the first room type in it that allows them; without one it is dropped,
  #   and so is one that doesn't fit, has too few adults or that Quote refuses.
  # - The labels go cheapest first: cheapest, private (no shared room), one_type (one room
  #   type). A label whose mix is already picked is skipped, and the rest of MAX_MIXES are the
  #   next cheapest, as `other`. Ties go to fewer rooms, then to the earlier candidate.
  class Mixes < ApplicationService
    MAX_CANDIDATES = 2_000
    MAX_MIXES = 3
    KINDS = Arrangement::KINDS

    def initialize(listings, starts_on:, ends_on:, adults:, children: 0, infants: 0, pets: 0)
      @listings = listings
      @starts_on = starts_on
      @ends_on = ends_on
      @party = { adults:, children:, infants: }
      @pets = pets
      @quotes = {}
    end

    def call
      @ledger = Availability::Ledger.new(@listings, @starts_on, @ends_on)
      mixes = candidates.filter_map { |counts| (rooms = fill(counts)) && price(rooms) }
      pick(mixes.sort_by.with_index { |mix, i| [ mix[:total_cents], i ] })
    end

    private

    def shared?(listing) = listing.stay_rate.per_guest?

    # The most rooms (a shared room's beds) of each listing worth trying.
    def limits
      heads = @party.values.sum
      @listings.map do |listing|
        next 0 unless listing.stay_rate&.priced?

        free = (@starts_on...@ends_on).map { @ledger.day(listing, _1)[:units_left] }.min
        sleeps = listing.attrs["guests"]
        cap = shared?(listing) ? [ heads, (sleeps if sleeps.is_a?(Integer)) ].compact.min : @party[:adults]
        [ free, cap ].min
      end
    end

    # Room counts per listing, fewest rooms first.
    def candidates
      maxes = limits
      found = []
      (1..maxes.sum).each do |total|
        compositions(total, maxes) do |counts|
          found << counts
          return found if found.size >= MAX_CANDIDATES
        end
      end
      found
    end

    def compositions(total, maxes, prefix = [], &block)
      return yield(prefix + [ total ]) if maxes.size == 1 && total <= maxes.first
      return if maxes.size == 1

      rest = maxes.drop(1).sum
      ([ total - rest, 0 ].max..[ total, maxes.first ].min).each do |count|
        compositions(total - count, maxes.drop(1), prefix + [ count ], &block)
      end
    end

    # The candidate's rooms with their guests, or nil when the party doesn't fit.
    def fill(counts)
      rooms = @listings.zip(counts).flat_map do |listing, count|
        next [] if count.zero?

        sleeps = listing.attrs["guests"]
        beds = shared?(listing) ? count : (sleeps.is_a?(Integer) && sleeps.positive? ? sleeps : Float::INFINITY)
        Array.new(shared?(listing) ? 1 : count) { { listing:, beds: beds - 1, guests: { adults: 1, children: 0, infants: 0 } } }
      end
      return if @party[:adults] < rooms.size

      at = place(rooms, :adults, @party[:adults] - rooms.size)
      at &&= place(rooms, :children, @party[:children], at:)
      at && place(rooms.reject { shared?(_1[:listing]) }, :infants, @party[:infants]) &&
        rooms.none? { shared?(_1[:listing]) && _1[:beds].positive? } &&
        rooms
    end

    # Round the rooms from `at`, each guest in the next one that has a bed for them; where the
    # round got to, or nil when one doesn't fit.
    def place(rooms, kind, count, at: 0)
      count.times do
        index = rooms.size.times.map { (at + _1) % rooms.size }.find { |i| fits?(rooms[i], kind) }
        return unless index

        room = rooms[index]
        room[:guests][kind] += 1
        room[:beds] -= 1 if Arrangement.counts?(room[:listing], kind)
        at = index + 1
      end
      at
    end

    def fits?(room, kind)
      !Arrangement.counts?(room[:listing], kind) || room[:beds].positive?
    end

    def price(rooms)
      by_listing = rooms.group_by { _1[:listing] }
      pets_at = by_listing.keys.find { Arrangement.pets_refusal(_1, @pets).nil? }
      return unless pets_at

      items = by_listing.map do |listing, its_rooms|
        item(listing, its_rooms.map { _1[:guests] }, listing == pets_at ? @pets : 0) || (return nil)
      end
      { total_cents: items.sum { _1[:total_cents] }, items: }
    end

    # One listing's part of a mix, priced as its stay would be; nil when Quote refuses it.
    def item(listing, room_guests, pets)
      key = [ listing.id, room_guests, pets ]
      return @quotes[key] if @quotes.key?(key)

      @quotes[key] = begin
        shared = shared?(listing)
        party = Arrangement.party_of(room_guests)
        quote = Quote.call(listing, starts_on: @starts_on, ends_on: @ends_on, **party,
          room_guests: (room_guests unless shared), pets:, ledger: @ledger)
        { listing_id: listing.id, title: listing.title,
          rooms: shared ? Arrangement.counted(listing, party) : room_guests.size,
          quantity: party.values.sum, room_guests: (room_guests unless shared), pets:, total_cents: quote[:total_cents] }
      rescue ActiveRecord::RecordInvalid
        nil
      end
    end

    def pick(sorted)
      labelled = {
        "cheapest" => sorted.first,
        "private" => sorted.find { |mix| mix[:items].none? { _1[:room_guests].nil? } },
        "one_type" => sorted.find { _1[:items].one? }
      }
      picks = labelled.filter_map { |label, mix| [ mix, label ] if mix }.uniq(&:first)
      sorted.each do |mix|
        break if picks.size >= MAX_MIXES

        picks << [ mix, "other" ] unless picks.any? { _1.first.equal?(mix) }
      end
      picks.first(MAX_MIXES).map { |mix, label| { label: }.merge(mix) }
    end
  end
end
