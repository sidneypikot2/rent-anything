module Payments
  # A guest pays for some of their bookings held for payment (POST /bookings/pay, RAA-143):
  # those accepted by their partner, or instant holds. All or nothing: every booking must be the
  # guest's (otherwise a 404) and awaiting payment before its pay-by time; one past it is expired
  # and the payment refused. Each checkout the bookings came from is paid once (Payments::Stub,
  # until Xendit). Returns the bookings, confirmed.
  class Pay < ApplicationService
    MAX_BOOKINGS = 50

    def initialize(user, booking_ids)
      @user = user
      @booking_ids = booking_ids
    end

    def call
      ids = read_ids
      bookings = @user.bookings.where(id: ids).order(:id).to_a
      raise ActiveRecord::RecordNotFound, "Couldn't find Booking" if bookings.size != ids.size

      expired = Booking.transaction do
        bookings.each(&:lock!)
        bookings.reject(&:awaiting_payment?).each { refuse!("A booking that is #{_1.status.humanize(capitalize: false)} can't be paid for") }
        late = bookings.select { _1.expires_at&.past? }
        next expire!(late) if late.any?

        bookings.group_by(&:checkout).each { |checkout, group| Stub.call(checkout, group) }
        false
      end
      refuse!("This booking wasn't paid for in time") if expired

      Booking.where(id: ids).includes(*BookingSerializer::ASSOCIATIONS).order(:starts_on, :id).to_a
    end

    private

    def read_ids
      ids = @booking_ids
      refuse!("Booking ids must be a list of your bookings' ids") if !ids.is_a?(Array) || ids.empty? || !ids.all?(Integer)
      refuse!("At most #{MAX_BOOKINGS} bookings can be paid for at once") if ids.size > MAX_BOOKINGS
      ids.uniq
    end

    def expire!(bookings)
      bookings.each { Bookings::Transition.call(_1, "expired", actor: "system", reason: "Not paid in time") }
      true
    end

    def refuse!(message)
      booking = Booking.new
      booking.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, booking
    end
  end
end
