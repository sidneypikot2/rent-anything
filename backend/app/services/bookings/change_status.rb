module Bookings
  # What a partner can do to one of their bookings (RAA-118, RAA-132): accept or decline a
  # request (Bookings::Respond), or cancel one that hasn't started (Bookings::Cancel, refunding
  # the guest in full), with an optional reason. Moving it to the status it has changes nothing.
  class ChangeStatus < ApplicationService
    STATUSES = %w[accepted declined cancelled].freeze

    def initialize(booking, partner, params)
      @booking = booking
      @partner = partner
      @params = params
    end

    def call
      status = @params[:status]
      case status
      when "accepted", "declined"
        return @booking if @booking.status == status

        Respond.call(@booking, status, user: @partner)
      when "cancelled"
        Cancel.call(@booking, by: "partner", user: @partner, reason: @params[:reason])
      else
        @booking.errors.add(:base, "Status must be one of #{STATUSES.join(', ')}")
        raise ActiveRecord::RecordInvalid, @booking
      end
    end
  end
end
