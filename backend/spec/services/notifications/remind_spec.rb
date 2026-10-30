require "rails_helper"

RSpec.describe Notifications::Remind do
  include ActiveSupport::Testing::TimeHelpers

  let(:listing) { create(:listing, :stay) }

  it "reminds a partner once of a request that expires within 4 hours" do
    booking = create(:booking, :checkout, listing:, status: "requested", expires_at: 3.hours.from_now)
    create(:booking, :checkout, listing:, status: "requested", expires_at: 10.hours.from_now)

    2.times { described_class.call }

    expect(Notification.pluck(:kind, :recipient_id, :subject_id))
      .to eq([ [ "booking.request_reminder", listing.partner.id, booking.id ] ])
  end

  it "reminds a guest of an accepted request still to be paid, but not of an instant hold" do
    accepted = create(:booking, :checkout, listing:, status: "awaiting_payment", expires_at: 2.hours.from_now,
      responded_at: 20.hours.ago)
    create(:booking, :checkout, listing:, status: "awaiting_payment", expires_at: 10.minutes.from_now)

    described_class.call

    expect(Notification.pluck(:kind, :recipient_id)).to eq([ [ "booking.payment_reminder", accepted.user.id ] ])
  end

  it "leaves out someone told about the booking within the last hour" do
    booking = create(:booking, :checkout, listing:, status: "requested", expires_at: 2.hours.from_now)
    create(:notification, recipient: listing.partner, subject: booking, kind: "booking.requested")

    described_class.call

    expect(Notification.where(kind: "booking.request_reminder")).to be_empty
  end

  it "tells a guest from 6 pm the day before a confirmed booking starts" do
    evening = Time.find_zone("Asia/Manila").local(2026, 11, 11, 18, 5)
    booking = create(:booking, :checkout, listing:, status: "confirmed", starts_on: Date.new(2026, 11, 12),
      ends_on: Date.new(2026, 11, 14))

    travel_to(evening - 1.hour) { described_class.call }
    expect(Notification.count).to eq(0)

    travel_to(evening) { 2.times { described_class.call } }
    expect(Notification.pluck(:kind, :recipient_id)).to eq([ [ "booking.starts_tomorrow", booking.user.id ] ])
  end
end
