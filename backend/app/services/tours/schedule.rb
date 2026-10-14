module Tours
  # When a tour runs (RAA-110): on its weekdays and its extra dates, unless a blocked date
  # covers the day. For a multi-day tour these are the days it starts. Bookings (M3) add the
  # per-day capacity (max_groups_per_day) here, so guests are never offered a full day.
  # Preload tour_detail, tour_dates and availability_blocks.
  class Schedule
    # How far ahead a guest is shown the days a tour runs.
    HORIZON_DAYS = 60

    def initialize(listing)
      @detail = listing.tour_detail
      @dates = listing.tour_dates.map(&:date).to_set
      @blocks = listing.availability_blocks.to_a
    end

    def open_on?(date)
      return false unless @detail
      return false unless @detail.weekdays.include?(date.wday) || @dates.include?(date)

      @blocks.none? { |block| block.covers?(date) }
    end

    def open_dates(from: Date.current, days: HORIZON_DAYS)
      (from...(from + days)).select { |date| open_on?(date) }
    end
  end
end
