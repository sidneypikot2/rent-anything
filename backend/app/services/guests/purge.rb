module Guests
  # Deletes unregistered guests' trips 60 days after they end (RAA-175), run daily by
  # Guests::PurgeJob. Unregistered is User.unregistered: no password and no Google or
  # Facebook sign-in. Trips::Cleanup already deletes trips with nothing booked a week after
  # they end, so what this deletes is mostly booked trips, which Cleanup keeps.
  #
  # - REMIND_DAYS before a trip's Trip#purge_on, a guest with an email gets one reminder
  #   (GuestMailer.trip_deletion_reminder), which offers to create an account to keep it.
  # - On purge_on the trip goes with its items, unless one of its bookings is still open
  #   (Booking::UNSETTLED): it waits until they all settle.
  # - A guest left with no trips goes too, with their trip link, codes, sessions and profile,
  #   once STALE_DAYS have passed since the account last changed (a new emailless guest has
  #   no trip until their first add) and none of their bookings is open.
  #
  # Partners' records stay: bookings (with their own copy of the guest's name, email and
  # phone), checkouts, payments and booking events, whose user_id the foreign keys nullify.
  # Returns how many trips it deleted.
  class Purge < ApplicationService
    REMIND_DAYS = 7
    STALE_DAYS = Trip::PURGE_DAYS

    def call
      today = Date.current
      remind(today)
      purged = Trip.of_unregistered_guests.due_for_purge(today).find_each.count { purge(_1, today) }
      delete_tripless_guests(today)
      purged
    end

    private

    def remind(today)
      trips = Trip.of_unregistered_guests.due_for_purge(today + REMIND_DAYS).where(purge_reminded_at: nil)
        .joins(:user).where.not(users: { email: nil })
      trips.find_each do |trip|
        # Claimed first, so a rerun of the job doesn't send it twice.
        next unless Trip.where(id: trip.id, purge_reminded_at: nil).update_all(purge_reminded_at: Time.current) == 1

        GuestMailer.trip_deletion_reminder(trip).deliver_later
      end
    end

    def purge(trip, today)
      Trip.transaction do
        # The guest may have deleted the trip since the query, edited it (an undated trip's
        # clock starts again) or created an account.
        trip = Trip.lock.find_by(id: trip.id)
        next false unless trip && trip.purge_on <= today && !trip.user.registered?
        next false if Booking.unsettled.joins(:checkout).where(checkouts: { trip_id: trip.id }).exists?

        trip.items.delete_all
        trip.destroy!
        delete_user(trip.user) if trip.user.trips.none?
        true
      end
    end

    def delete_tripless_guests(today)
      User.unregistered.where(updated_at: ...(today - STALE_DAYS).beginning_of_day)
        .where.not(Trip.where("trips.user_id = users.id").arel.exists).find_each do |user|
        User.transaction do
          user = User.lock.find_by(id: user.id)
          delete_user(user) if user && !user.registered? && user.trips.none?
        end
      end
    end

    def delete_user(user)
      return if Booking.unsettled.where(user:).exists?

      Users::Erase.call(user)
    end
  end
end
