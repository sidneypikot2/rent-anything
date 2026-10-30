module Notifications
  # Reminders before a deadline, once each (`dedupe_key`), run every 15 minutes by
  # Notifications::RemindJob:
  # - a partner, when a request they haven't answered expires within REMINDER_WINDOW;
  # - a guest, when an accepted request they haven't paid for is let go within it (not an
  #   instant hold's 15 minutes, which the guest is paying right then);
  # - a guest, from 6 pm the evening before a confirmed booking starts, in the area's time.
  # Someone told about the booking within the last hour (the request itself, say, for one
  # that starts soon) isn't reminded of it as well.
  class Remind < ApplicationService
    REMINDER_WINDOW = 4.hours
    QUIET_AFTER_NOTICE = 1.hour
    EVENING_HOUR = 18

    def initialize(now = Time.current)
      @now = now
    end

    def call
      due = @now..(@now + REMINDER_WINDOW)
      bookings.requested.where(expires_at: due).find_each do |booking|
        remind(booking, booking.listing.partner, "booking.request_reminder", booking.expires_at.iso8601)
      end
      bookings.awaiting_payment.where(expires_at: due).where.not(responded_at: nil).find_each do |booking|
        remind(booking, booking.user, "booking.payment_reminder", booking.expires_at.iso8601)
      end
      local = @now.in_time_zone(Copy::TIME_ZONE)
      return if local.hour < EVENING_HOUR

      bookings.confirmed.where(starts_on: local.to_date + 1).find_each do |booking|
        remind(booking, booking.user, "booking.starts_tomorrow", booking.starts_on.iso8601)
      end
    end

    private

    def bookings
      Booking.source_checkout.includes(:user, :checkout, listing: :partner)
    end

    def remind(booking, recipient, kind, key)
      return if recipient.nil?
      return if Notification.where(recipient:, subject: booking, created_at: (@now - QUIET_AFTER_NOTICE)..).exists?

      Notify.call(kind, recipient, booking, params: Copy.booking_params(booking), dedupe_key: key)
    rescue ActiveRecord::RecordNotUnique
      nil # sent by a run at the same moment
    end
  end
end
