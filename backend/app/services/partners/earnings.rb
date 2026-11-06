module Partners
  # An estimate of a partner's month (RAA-266): the bookings starting in `month` ("2026-11") and
  # what each pays out. Nothing has been paid yet, so it stays an estimate. Bookings still holding
  # their days count, requests included; those priced with the guest (to_be_agreed) have no amount
  # and are left out rather than counted as nothing. Offline bookings are apart: the guest paid
  # the partner directly.
  class Earnings < ApplicationService
    include Trips::Values

    MONTH_FORMAT = /\A\d{4}-(0[1-9]|1[0-2])\z/

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      first_day = read_month
      raise_errors!(Booking.new)

      offline, bookings = month_bookings(first_day).reject(&:to_be_agreed?).partition(&:source_offline?)
      { month: @params[:month], estimate_cents: bookings.sum(&:payout_cents), offline_cents: offline.sum(&:payout_cents),
        bookings:, offline_bookings: offline }
    end

    private

    def read_month
      month = @params[:month]
      return error("Month is required") if month.blank?
      return error("Month must be a month like 2026-11") unless month.is_a?(String) && month.match?(MONTH_FORMAT)

      Date.iso8601("#{month}-01")
    end

    def month_bookings(first_day)
      Booking.of_partner(@partner).holding.where(starts_on: first_day..first_day.end_of_month)
        .includes(listing: %i[category tour_detail]).order(:starts_on, :id)
    end
  end
end
