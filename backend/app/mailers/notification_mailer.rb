# The email for a notification whose kind is emailed (Notifications::Copy::CATALOGUE): its
# title as the subject, its sentence, and a button to the page it links to. A request a partner
# has to answer is a booking slip of its own instead, with its details and payout, asking them
# to open the site, as there is no partner app (RAA-260). Sent by Notifications::Notify once the
# notification is committed.
class NotificationMailer < ApplicationMailer
  layout -> { @slip ? false : "mailer" }

  def event(notification)
    copy = Notifications::Copy.call(notification)
    @name = notification.recipient.name
    @body = copy[:body]
    @link = web_url(copy[:path])
    @slip = Notifications::RequestDetails.call(notification.subject) if answer?(notification)
    @action = action(notification)
    mail(to: notification.recipient.email, subject: copy[:title], template_name: @slip ? "request" : "event")
  end

  private

  def answer?(notification)
    Notifications::Copy::ANSWER_KINDS.include?(notification.kind)
  end

  def action(notification)
    return "Review this request" if answer?(notification)

    notification.recipient.partner? ? "Open in your calendar" : "Open your trip"
  end
end
