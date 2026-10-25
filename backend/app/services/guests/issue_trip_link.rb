module Guests
  # After a guest's first checkout (RAA-175): an unregistered guest gets their trip link and
  # PIN, returned once in the checkout response and emailed with the trip's deletion date.
  # Returns { token:, pin: }, or nil when the guest already has a link or an account.
  class IssueTripLink < ApplicationService
    def initialize(user, trip)
      @user = user
      @trip = trip
    end

    def call
      return if @user.anonymous? || @user.registered? || @user.trip_access

      link = TripAccess.issue!(@user)
      GuestMailer.trip_link(@user, @trip, **link).deliver_later
      link
    rescue ActiveRecord::RecordNotUnique
      nil
    end
  end
end
