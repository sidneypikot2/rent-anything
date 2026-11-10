module Visits
  # Counts a browser once per Manila day (RAA-290). The web app sends a random UUID it keeps;
  # only SHA-256 of it with the day is stored, so a visitor can't be followed from day to day,
  # and a second visit the same day changes nothing (the unique index; no read first, so two
  # tabs at once can't count twice).
  class Record < ApplicationService
    UUID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def initialize(visitor_id)
      @visitor_id = visitor_id
    end

    def call
      validate!
      day = ActiveSupport::TimeZone[Booking::RENTAL_TIME_ZONE].today
      digest = Digest::SHA256.hexdigest("#{@visitor_id.downcase}:#{day.iso8601}")
      SiteVisit.insert_all([ { visited_on: day, visitor_digest: digest, created_at: Time.current } ],
        unique_by: %i[visited_on visitor_digest])
    end

    private

    def validate!
      return if @visitor_id.is_a?(String) && UUID.match?(@visitor_id)

      visit = SiteVisit.new
      visit.errors.add(:base, "Visitor id must be a UUID")
      raise ActiveRecord::RecordInvalid, visit
    end
  end
end
