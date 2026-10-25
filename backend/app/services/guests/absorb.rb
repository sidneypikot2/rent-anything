module Guests
  # Moves a guest with no email yet into the account that owns the email they gave at
  # checkout (RAA-175, after Guests::ClaimContact's 409 and a sign-in code): their trips go
  # to that account as they are, and the emailless guest is deleted. Such a guest has no
  # checkouts or bookings, since checking out needs an email. Returns the account.
  class Absorb < ApplicationService
    def initialize(from:, into:)
      @from = from
      @into = into
    end

    def call
      return @into unless @from.guest? && @from.anonymous? && @into.guest? && @from.id != @into.id

      User.transaction do
        @from.lock!
        @from.trips.update_all(user_id: @into.id, updated_at: Time.current)
        @from.trips.reset
        @from.destroy!
      end
      @into
    end
  end
end
