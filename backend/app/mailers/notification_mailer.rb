# The email for a notification whose kind is emailed (Notifications::Copy::CATALOGUE): its
# title as the subject, its sentence, and a button to the page it links to. Sent by
# Notifications::Notify once the notification is committed.
class NotificationMailer < ApplicationMailer
  def event(notification)
    copy = Notifications::Copy.call(notification)
    @name = notification.recipient.name
    @body = copy[:body]
    @link = web_url(copy[:path])
    @action = notification.recipient.partner? ? "Open in your calendar" : "Open your trip"
    mail(to: notification.recipient.email, subject: copy[:title])
  end
end
