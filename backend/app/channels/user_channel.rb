# Each signed-in user's own stream (RAA-201): booking changes and new notifications now, chat
# messages later (M6).
# A message only says what changed; the client refetches it through the API, so who may see
# what stays in the controllers.
class UserChannel < ApplicationCable::Channel
  def subscribed
    current_user ? stream_for(current_user) : reject
  end

  # Tells a booking's guest and partner that it changed, once the change is committed: nothing
  # is said about a change that rolls back. Called by Bookings::Transition, where every status
  # changes, and by Bookings::Change for a request that stays a request.
  #
  # broadcast_to only queues the message: AnyCable's HTTP broadcaster sends it from a background
  # thread and logs a failed delivery there (it never reaches the booking change, nor Sentry).
  def self.booking_updated(booking)
    return unless live?

    message = { type: "booking.updated", booking_id: booking.id, status: booking.status }
    recipients = [ booking.user, booking.listing.partner ].compact.uniq
    ActiveRecord.after_all_transactions_commit do
      recipients.each do |user|
        broadcast_to(user, message)
      rescue StandardError => e
        Rails.error.report(e, handled: true)
      end
    end
  end

  # Tells a user's open tabs they have a new notification (Notifications::Notify, which calls
  # it once the notification is committed), so the bell refetches.
  def self.notification_created(notification)
    return unless live?

    broadcast_to(notification.recipient, { type: "notification.created", notification_id: notification.id })
  rescue StandardError => e
    Rails.error.report(e, handled: true)
  end

  # Closes a user's open connections, as when their account is deleted: a connection is only
  # checked when it opens.
  def self.disconnect(user)
    ActionCable.server.remote_connections.where(current_user: user).disconnect(reconnect: false) if live?
  rescue StandardError => e
    Rails.error.report(e, handled: true)
  end

  # Whether there is a server to broadcast to: a deployed stack without ANYCABLE_SECRET has no
  # anycable-go (config/anycable.yml), and its broadcaster would only retry into nothing.
  def self.live?
    !AnyCable::Rails.enabled? || AnyCable.config.secret.present?
  end
end
