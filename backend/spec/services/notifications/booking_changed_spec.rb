require "rails_helper"

RSpec.describe Notifications::BookingChanged do
  include ActiveJob::TestHelper

  let(:listing) { create(:listing, :stay) }
  let(:partner) { listing.partner }
  let(:booking) { create(:booking, :checkout, listing:, status: "requested", expires_at: 5.hours.from_now) }
  let(:guest) { booking.user }

  def kinds_for(user)
    Notification.where(recipient: user).order(:id).pluck(:kind)
  end

  it "tells the partner about a new request, by email too" do
    new_booking = build(:booking, :checkout, listing:, status: "requested", expires_at: 5.hours.from_now)
    expect do
      new_booking.save!
      Bookings::Transition.record_start(new_booking, actor: "guest", user: new_booking.user)
    end.to have_enqueued_mail(NotificationMailer, :event)

    expect(kinds_for(partner)).to eq(%w[booking.requested])
    expect(kinds_for(new_booking.user)).to be_empty
    notification = Notification.last
    expect(notification.subject).to eq(new_booking)
    expect(Notifications::Copy.call(notification)).to include(
      title: "New request: #{listing.title}", path: "/partner/calendar?booking=#{new_booking.id}"
    )
  end

  it "tells the guest a request was accepted and when to pay by" do
    Bookings::Respond.call(booking, "accepted", user: partner)

    expect(kinds_for(guest)).to eq(%w[booking.accepted])
    expect(Notifications::Copy.call(Notification.last)[:body]).to start_with("Pay by ")
  end

  it "tells the guest a request was declined" do
    Bookings::Respond.call(booking, "declined", user: partner)

    expect(kinds_for(guest)).to eq(%w[booking.declined])
  end

  it "tells both once the guest pays: the guest it's confirmed, the partner it's paid" do
    Bookings::Respond.call(booking, "accepted", user: partner)
    Bookings::Transition.call(booking, "confirmed", actor: "system")

    expect(kinds_for(guest)).to eq(%w[booking.accepted booking.confirmed])
    expect(kinds_for(partner)).to eq(%w[booking.paid])
  end

  it "tells the partner when the guest asks for new dates, and when they cancel" do
    booking.update!(status: "confirmed")
    Bookings::Transition.call(booking, "requested", actor: "guest", user: guest)
    Bookings::Cancel.call(booking, by: "guest", user: guest)

    expect(kinds_for(partner)).to eq(%w[booking.change_requested booking.guest_cancelled])
  end

  it "tells the guest when the partner cancels" do
    booking.update!(status: "confirmed")
    Bookings::Cancel.call(booking, by: "partner", user: partner)

    expect(kinds_for(guest)).to eq(%w[booking.cancelled])
  end

  it "tells both when a request expires unanswered, in the app only" do
    expect { Bookings::Transition.call(booking, "expired", actor: "system") }.not_to have_enqueued_mail

    expect(kinds_for(partner)).to eq(%w[booking.request_expired])
    expect(kinds_for(guest)).to eq(%w[booking.request_unanswered])
  end

  it "says nothing about an instant hold, an offline booking, or a booking starting" do
    hold = create(:booking, :checkout, listing:, status: "awaiting_payment", expires_at: 15.minutes.from_now)
    Bookings::Transition.record_start(hold, actor: "guest", user: hold.user)
    offline = create(:booking, listing:, status: "confirmed")
    Bookings::Transition.record_start(offline, actor: "partner", user: partner)
    started = create(:booking, :checkout, listing:, status: "confirmed")
    Bookings::Transition.call(started, "in_progress", actor: "system")

    expect(Notification.count).to eq(0)
  end

  it "makes nothing when the change rolls back" do
    Booking.transaction do
      Bookings::Respond.call(booking, "accepted", user: partner)
      raise ActiveRecord::Rollback
    end

    expect(Notification.count).to eq(0)
  end

  it "tells the guest's open tabs" do
    expect { Bookings::Respond.call(booking, "declined", user: partner) }
      .to have_broadcasted_to(guest).from_channel(UserChannel).with(a_hash_including("type" => "notification.created"))
  end
end
