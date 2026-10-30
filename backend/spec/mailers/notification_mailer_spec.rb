require "rails_helper"

RSpec.describe NotificationMailer do
  it "emails the notification's title, sentence and a link to its page in the web app" do
    notification = create(:notification, kind: "booking.declined")
    mail = described_class.event(notification)

    expect(mail.to).to eq([ notification.recipient.email ])
    expect(mail.subject).to eq("Request declined: #{notification.subject.listing.title}")
    [ mail.html_part, mail.text_part ].each do |part|
      expect(part.body.to_s).to include("The partner can", "http://example.com/cart")
    end
  end

  it "links a partner to the booking on their calendar" do
    booking = create(:booking, :checkout, status: "requested", expires_at: 5.hours.from_now)
    notification = create(:notification, recipient: booking.listing.partner, subject: booking, kind: "booking.requested")

    expect(described_class.event(notification).text_part.body.to_s)
      .to include("Open in your calendar: http://example.com/partner/calendar?booking=#{booking.id}")
  end
end
