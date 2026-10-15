module Listings
  # A partner changes one of their listings' status (RAA-115): Go live from a draft or a
  # delisted listing, Pause and Resume, Delist. Going live (or resuming) needs everything in
  # Listing#live_blockers; there is no admin review. Asking for the status it already has
  # changes nothing. The listing's row is locked, so a photo deleted meanwhile is seen.
  class ChangeStatus < ApplicationService
    # Each status and the ones it can be reached from.
    MOVES = {
      "active" => %w[draft paused delisted],
      "paused" => %w[active],
      "delisted" => %w[active paused]
    }.freeze

    def initialize(listing, status)
      @listing = listing
      @status = status
    end

    def call
      @listing.with_lock do
        next if @status == @listing.status

        refuse("Status must be one of #{MOVES.keys.join(', ')}") unless MOVES.key?(@status)
        refuse("A #{@listing.status} listing can't be made #{@status}") unless MOVES[@status].include?(@listing.status)
        blockers = @status == "active" ? @listing.live_blockers : []
        refuse("To go live it needs #{blockers.map { Listing::LIVE_BLOCKERS[_1] }.to_sentence}") if blockers.any?

        @listing.update!(status: @status)
      end
      @listing
    end

    private

    def refuse(message)
      @listing.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, @listing
    end
  end
end
