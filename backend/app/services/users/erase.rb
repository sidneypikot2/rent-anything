module Users
  # Deletes a guest and everything that is only theirs: trips with their items, Google and
  # Facebook sign-ins, sessions, profile; trip_accesses and sign_in_codes cascade. Partners'
  # records stay: bookings (with their own copy of the guest's name, email and phone),
  # checkouts, payments and booking events, whose user_id the foreign keys nullify.
  #
  # The one list of what goes with a user, shared by Guests::Purge and Users::DeleteAccount.
  # Callers lock the user and check that no booking is still open first.
  class Erase < ApplicationService
    def initialize(user)
      @user = user
    end

    def call
      @user.trips.find_each do |trip|
        trip.items.delete_all
        trip.destroy!
      end
      @user.oauth_identities.delete_all
      @user.refresh_tokens.delete_all
      @user.guest_profile&.destroy!
      @user.delete
    end
  end
end
