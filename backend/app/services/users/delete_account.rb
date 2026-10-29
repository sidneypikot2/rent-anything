module Users
  # A guest deletes their own account (DELETE /me): what Users::Erase deletes goes at once,
  # and every device is signed out. Partners' records of past bookings stay. Refused while a
  # booking is still open (Booking::UNSETTLED), so no partner is left with a booking whose
  # guest is gone. Partners and admins can't delete themselves: a partner's listings and
  # payouts are closed by the team, on request by email.
  #
  # The guest gets a confirmation email, sent after the delete commits.
  class DeleteAccount < ApplicationService
    def initialize(user)
      @user = user
    end

    def call
      raise NotAuthorizedError, "Email us to close a partner account." unless @user.guest?

      email, name = nil
      User.transaction do
        user = User.lock.find(@user.id)
        open = Booking.unsettled.where(user:).count
        raise OpenBookingsError.new(open) if open.positive?

        email, name = user.email, user.name
        Erase.call(user)
      end
      GuestMailer.account_deleted(email, name).deliver_later if email
      nil
    end
  end
end
