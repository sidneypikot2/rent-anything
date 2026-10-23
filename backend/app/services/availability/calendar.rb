module Availability
  # A partner's calendar (RAA-118): every one of their listings, by business, category and
  # title, with each day from `from` to `to` (ISO dates, at most MAX_DAYS) and the blocks and
  # bookings holding days in that window (requests and unpaid holds too, RAA-132). The web app asks for it a window at a time as the
  # partner scrolls.
  class Calendar < ApplicationService
    include Trips::Values

    MAX_DAYS = 92
    ASSOCIATIONS = %i[business category units stay_rate vehicle_rate tour_detail].freeze

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      from = required_date(:from, "From")
      to = required_date(:to, "To")
      if from && to
        error("To can't be before from") if to < from
        error("Ask for at most #{MAX_DAYS} days at a time") if (to - from).to_i >= MAX_DAYS
      end
      raise_errors!(Listing.new)

      listings = @partner.listings.includes(*ASSOCIATIONS).order("businesses.name", "categories.name", :title).to_a
      { from:, to:, listings:, ledger: Ledger.new(listings, from, to) }
    end
  end
end
