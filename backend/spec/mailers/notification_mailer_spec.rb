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

  it "links a partner to a booking on their calendar" do
    booking = create(:booking, :checkout, status: "confirmed")
    notification = create(:notification, recipient: booking.listing.partner, subject: booking, kind: "booking.paid",
      params: Notifications::Copy.booking_params(booking))
    mail = described_class.event(notification)

    expect(mail.text_part.body.to_s).to include("Open in your calendar: http://example.com/partner/calendar?booking=#{booking.id}")
    expect(mail.text_part.body.to_s).not_to include("Reference:", "accept or decline")
    expect(mail.html_part.body.to_s).not_to include("Your payout")
  end

  %w[booking.requested booking.change_requested booking.request_reminder].each do |kind|
    it "gives the request's details for #{kind} and asks the partner to answer on the site" do
      booking = create(:booking, :checkout, status: "requested", guest_name: "Ana <b>Cruz</b>", total_cents: 450_000,
        commission_cents: 45_000, expires_at: 5.hours.from_now)
      notification = create(:notification, recipient: booking.listing.partner, subject: booking, kind:,
        params: Notifications::Copy.booking_params(booking))
      mail = described_class.event(notification)
      link = "http://example.com/partner/dashboard?booking=#{booking.id}"

      expect(mail.text_part.body.to_s).to include("Your payout if you accept: ₱4,050", "Reference: #{booking.reference}",
        "accept or decline", "Review this request: #{link}")
      expect(mail.html_part.body.to_s).to include("₱4,050", booking.reference, "accept or decline", "Review this request", link,
        "Ana &lt;b&gt;Cruz&lt;/b&gt;")
      [ mail.html_part, mail.text_part ].each { expect(_1.body.to_s).not_to include("₱4,500", "₱450", "ommission") }
    end
  end

  it "puts the payout in a new request's subject, or the listing when there is none to give" do
    booking = create(:booking, :checkout, status: "requested", total_cents: 450_000, commission_cents: 45_000,
      starts_on: Date.new(2030, 11, 14), ends_on: Date.new(2030, 11, 17), expires_at: 5.hours.from_now)
    partner = booking.listing.partner
    paid = create(:notification, recipient: partner, subject: booking, kind: "booking.requested",
      params: Notifications::Copy.booking_params(booking))
    older = create(:notification, recipient: partner, subject: booking, kind: "booking.requested",
      params: Notifications::Copy.booking_params(booking).except(:payout_cents))

    expect(described_class.event(paid).subject).to eq("New request: ₱4,050 payout, Nov 14–17")
    expect(described_class.event(older).subject).to eq("New request: #{booking.listing.title}")
  end
end
