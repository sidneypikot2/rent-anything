module Availability
  # Blocks a run of a listing's days, or changes a block (RAA-118): starts_on and ends_on
  # (both ends included, at most MAX_DAYS, ending today or later) and an optional reason of up
  # to AvailabilityBlock::REASON_LENGTH characters. Bookings already on those days stay. A
  # block can't overlap another of the listing's: the partner changes that one instead.
  class SaveBlock < ApplicationService
    include Trips::Values

    MAX_DAYS = 366

    def initialize(listing, params, block = nil)
      @listing = listing
      @params = params
      @block = block || listing.availability_blocks.build
      @errors = []
    end

    def call
      from = required_date(:starts_on, "Start date")
      to = required_date(:ends_on, "End date")
      reason = optional_reason
      check_range(from, to) if from && to
      raise_errors!(@block)

      Listing.transaction do
        @listing.lock!
        check_overlap!(from, to)
        @block.update!(starts_on: from, ends_on: to, reason:)
      end
      @block
    end

    private

    def check_range(from, to)
      error("End date can't be before the start date") if to < from
      error("Block at most #{MAX_DAYS} days at a time") if (to - from).to_i >= MAX_DAYS
      # A past block keeps its end date when its reason changes.
      error("A block must end today or later") if to < Date.current && to != @block.ends_on
    end

    def optional_reason
      value = @params[:reason]
      return nil if value.nil?
      return error("Reason must be text") unless value.is_a?(String)

      reason = value.strip.presence
      if reason && reason.length > AvailabilityBlock::REASON_LENGTH
        error("Reason can be at most #{AvailabilityBlock::REASON_LENGTH} characters")
      end
      reason
    end

    def check_overlap!(from, to)
      other = @listing.availability_blocks.where.not(id: @block.id).overlapping(from, to).first
      return unless other

      error("Those dates overlap the block from #{other.starts_on.strftime('%b %-d')} to " \
        "#{other.ends_on.strftime('%b %-d')}: change that one instead")
      raise_errors!(@block)
    end
  end
end
