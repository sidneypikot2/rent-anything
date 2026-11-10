module Admin
  # How the app is doing (RAA-290), for the admin overview: per Manila day over the last `days`
  # (7, 30 or 90, today included), every day present. Online bookings only: offline ones are a
  # partner's own records of guests who paid them directly.
  # - visitors: browsers counted by Visits::Record
  # - bookings: bookings made that day (requests sent), whatever became of them
  # - booking_amount_cents / revenue_cents: the total and our commission of bookings paid that
  #   day (confirmed_at), still standing (confirmed, under way or completed)
  # Grouped in SQL, never booking by booking in Ruby.
  class Overview < ApplicationService
    DAYS = [ 7, 30, 90 ].freeze
    DEFAULT_DAYS = 30
    PAID = %w[confirmed in_progress completed].freeze
    METRICS = %i[visitors bookings booking_amount_cents revenue_cents].freeze

    def initialize(params)
      @params = params
      @zone = ActiveSupport::TimeZone[Booking::RENTAL_TIME_ZONE]
    end

    def call
      days = read_days
      to = @zone.today
      from = to - (days - 1)
      window = from.in_time_zone(@zone).beginning_of_day..to.in_time_zone(@zone).end_of_day

      visitors = SiteVisit.where(visited_on: from..to).group(:visited_on).count
      bookings = online.where(created_at: window).group(Arel.sql(local_day("bookings.created_at"))).count
      paid = online.where(status: PAID, confirmed_at: window).group(Arel.sql(local_day("bookings.confirmed_at")))
        .pluck(Arel.sql(local_day("bookings.confirmed_at")), Arel.sql("SUM(bookings.total_cents)"),
          Arel.sql("SUM(bookings.commission_cents)"))
        .to_h { |day, total, commission| [ day, [ total.to_i, commission.to_i ] ] }

      series = (from..to).map do |day|
        amount, revenue = paid.fetch(day, [ 0, 0 ])
        { date: day, visitors: visitors.fetch(day, 0), bookings: bookings.fetch(day, 0),
          booking_amount_cents: amount, revenue_cents: revenue }
      end
      { days:, from:, to:, totals: METRICS.index_with { |metric| series.sum { _1[metric] } }, series: }
    end

    private

    def online
      Booking.source_checkout
    end

    # Timestamps are stored in UTC; the day is Manila's.
    def local_day(column)
      "(#{column} AT TIME ZONE 'UTC' AT TIME ZONE '#{Booking::RENTAL_TIME_ZONE}')::date"
    end

    def read_days
      days = @params[:days]
      return DEFAULT_DAYS if days.blank?
      return days.to_i if days.is_a?(String) && DAYS.map(&:to_s).include?(days)

      record = Booking.new
      record.errors.add(:base, "Days must be one of #{DAYS.join(', ')}")
      raise ActiveRecord::RecordInvalid, record
    end
  end
end
