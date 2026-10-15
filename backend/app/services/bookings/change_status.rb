module Bookings
  # What a partner can do to a booking (RAA-118): cancel it, which frees its days. Cancelling
  # a cancelled booking changes nothing; nothing brings one back. Refunds follow the
  # listing's cancellation policy once guests pay in the app (M4).
  class ChangeStatus < ApplicationService
    def initialize(booking, status)
      @booking = booking
      @status = status
    end

    def call
      unless @status == "cancelled"
        @booking.errors.add(:base, "A booking can only be cancelled")
        raise ActiveRecord::RecordInvalid, @booking
      end

      @booking.cancelled! unless @booking.cancelled?
      @booking
    end
  end
end
