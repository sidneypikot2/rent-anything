module Notifications
  # Makes one notification (RAA notifications) in the caller's transaction and, once that
  # commits, tells the recipient's open tabs (UserChannel) and emails it when its kind is
  # emailed (Copy::CATALOGUE). Nothing is said about a change that rolls back. Nobody to tell
  # (an offline booking has no guest) makes nothing.
  #
  # `dedupe_key` makes it once per recipient, kind, subject and key (a reminder for one
  # deadline): a second call with the same returns nil.
  class Notify < ApplicationService
    def initialize(kind, recipient, subject, params: {}, dedupe_key: nil)
      @kind = kind
      @recipient = recipient
      @subject = subject
      @params = params
      @dedupe_key = dedupe_key
    end

    def call
      return if @recipient.nil?
      return if @dedupe_key && duplicate?

      notification = Notification.create!(recipient: @recipient, kind: @kind, subject: @subject, params: @params,
        dedupe_key: @dedupe_key)
      ActiveRecord.after_all_transactions_commit do
        UserChannel.notification_created(notification)
        email(notification) if Copy.email?(@kind) && @recipient.email.present?
      end
      notification
    end

    private

    # After the booking change has committed, so a failed enqueue is reported, not raised to
    # the request that made the change.
    def email(notification)
      NotificationMailer.event(notification).deliver_later
    rescue StandardError => e
      Rails.error.report(e, handled: true)
    end

    def duplicate?
      Notification.exists?(recipient: @recipient, kind: @kind, subject: @subject, dedupe_key: @dedupe_key)
    end
  end
end
