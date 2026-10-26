module Payments
  # A guest pays for some of their bookings held for payment (POST /bookings/pay, RAA-143):
  # those accepted by their partner, or instant holds. All or nothing: every booking must be the
  # guest's (otherwise a 404) and awaiting payment before its pay-by time; one past it is expired
  # and the payment refused.
  #
  # Without PayMongo each checkout the bookings came from is paid at once (Payments::Stub). With
  # it, bookings paid already (a changed one accepted again) and those priced at nothing are
  # confirmed straight away, with no charge, and the rest go to one PayMongo checkout
  # (Payments::StartCheckout), confirmed once paid (Payments::Sync). Returns the bookings and the
  # payment to finish on PayMongo's page, if any.
  class Pay < ApplicationService
    MAX_BOOKINGS = 50
    Result = Data.define(:bookings, :payment)

    def initialize(user, booking_ids)
      @user = user
      @booking_ids = booking_ids
    end

    def call
      ids = read_ids
      bookings = @user.bookings.where(id: ids).order(:id).to_a
      raise ActiveRecord::RecordNotFound, "Couldn't find Booking" if bookings.size != ids.size

      to_charge = Booking.transaction do
        bookings.each(&:lock!)
        bookings.reject(&:awaiting_payment?).each { refuse!("A booking that is #{_1.status.humanize(capitalize: false)} can't be paid for") }
        late = bookings.select { _1.expires_at&.past? }
        next expire!(late) if late.any?

        confirm, charge = Payments.paymongo? ? bookings.partition { _1.payment_id || _1.total_cents.zero? } : [ bookings, [] ]
        confirm.group_by(&:checkout).each { |checkout, group| Stub.call(checkout, group) }
        charge
      end
      refuse!("This booking wasn't paid for in time") if to_charge == :expired

      # Outside the transaction: PayMongo is called, and its outcome recorded, in their own.
      payment = StartCheckout.call(@user, to_charge) if to_charge.any?
      Result.new(bookings: Booking.where(id: ids).includes(*BookingSerializer::ASSOCIATIONS).order(:starts_on, :id).to_a,
        payment:)
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
      :expired
    end

    def refuse!(message)
      booking = Booking.new
      booking.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, booking
    end
  end
end
