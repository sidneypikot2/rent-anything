module Guests
  # A new trip link and PIN for the signed-in guest (POST /trip_access/rotate, RAA-175): the
  # old ones stop working, a locked link is unlocked, and the new pair is returned once. Only
  # for a guest who has given their email (their first checkout makes the first link).
  class RotateTripLink < ApplicationService
    def initialize(user)
      @user = user
    end

    def call
      if @user.anonymous?
        @user.errors.add(:base, "Book a trip first: your trip link comes with your first booking")
        raise ActiveRecord::RecordInvalid, @user
      end

      TripAccess.issue!(@user)
    end
  end
end
