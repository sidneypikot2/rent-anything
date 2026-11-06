module Partners
  # A page of a partner's bookings (RAA-132, RAA-266), newest first: all of them or those with
  # one status, and those touching `from` to `to` when sent (either may be left out). With no
  # page or per_page it is the newest MAX_PER_PAGE, as the calendar's requests list expects.
  class BookingList < ApplicationService
    include Trips::Values

    MAX_PER_PAGE = 200
    MAX_PAGE = 100_000

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      page = bounded(:page, "Page", MAX_PAGE) || 1
      per_page = bounded(:per_page, "Per page", MAX_PER_PAGE) || MAX_PER_PAGE
      scope = filtered
      raise_errors!(Booking.new)

      { total: scope.count, bookings: scope.includes(listing: %i[category tour_detail]).order(created_at: :desc, id: :desc)
        .limit(per_page).offset((page - 1) * per_page) }
    end

    private

    def filtered
      scope = Booking.of_partner(@partner)
      status = @params[:status]
      if status.present?
        Booking::STATUSES.include?(status) ? scope = scope.where(status:) : error("Status must be one of #{Booking::STATUSES.join(', ')}")
      end
      from = @params[:from].presence && date_value(:from, "From")
      to = @params[:to].presence && date_value(:to, "To")
      error("To can't be before from") if from && to && to < from
      scope = scope.where(ends_on: from..) if from
      scope = scope.where(starts_on: ..to) if to
      scope
    end

    def bounded(key, label, max)
      value = @params[key].presence && integer_value(key, label, digits: true)
      return value if value.nil? || value.between?(1, max)

      error("#{label} must be from 1 to #{max}")
    end
  end
end
