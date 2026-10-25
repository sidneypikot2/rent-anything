require "rails_helper"

RSpec.describe Guests::Purge do
  include ActiveJob::TestHelper

  # A guest who booked without an account: an email from checkout, no password.
  let(:guest) { create(:user, :profile_complete, password: nil, email: "ana@example.com") }

  # A trip that ended `days_ago` with one booked item, as checkout leaves it.
  def booked_trip(user, days_ago, status: "completed")
    trip = create(:trip, user:)
    item = create(:trip_item, trip:)
    trip.update_columns(starts_on: (days_ago + 2).days.ago.to_date, ends_on: days_ago.days.ago.to_date)
    item.update_columns(starts_on: trip.starts_on, ends_on: trip.starts_on)
    checkout = create(:checkout, user:, trip:)
    booking = create(:booking, :checkout, user:, checkout:, trip_item: item, listing: item.listing, status:, guest_name: user.name,
      starts_on: trip.starts_on, ends_on: trip.starts_on)
    BookingEvent.create!(booking:, user:, actor: "guest", to_status: status)
    trip
  end

  it "deletes an unregistered guest's trip 60 days after it ends, not a day before" do
    gone = booked_trip(guest, Trip::PURGE_DAYS)
    kept = booked_trip(guest, Trip::PURGE_DAYS - 1)

    expect(described_class.call).to eq(1)

    expect(Trip.exists?(gone.id)).to be(false)
    expect(Trip.all).to contain_exactly(kept)
    expect(User.exists?(guest.id)).to be(true)
  end

  it "keeps the partner's records, with the guest's contact details, and deletes the guest with their last trip" do
    trip = booked_trip(guest, 61)
    TripAccess.issue!(guest)
    SignInCode.issue!(guest)
    Auth::IssueTokens.call(guest)
    booking = Booking.last

    described_class.call

    expect(Trip.exists?(trip.id)).to be(false)
    expect(User.exists?(guest.id)).to be(false)
    expect(TripAccess.count + SignInCode.count + RefreshToken.count).to eq(0)
    expect(booking.reload).to have_attributes(user_id: nil, trip_item_id: nil, guest_name: "Ana Reyes",
      guest_email: "ana@example.com", guest_phone: "+639171234567", status: "completed")
    expect(booking.checkout).to have_attributes(user_id: nil, trip_id: nil)
    expect(booking.events.pluck(:user_id)).to eq([ nil ])
    expect(booking.payment).to be_present
  end

  it "never deletes a registered guest's trips" do
    with_password = booked_trip(create(:user), 90)
    google = create(:user, password: nil)
    OauthIdentity.create!(user: google, provider: "google", uid: "g-1", role: "guest")
    with_google = booked_trip(google, 90)

    described_class.call

    expect(Trip.all).to contain_exactly(with_password, with_google)
  end

  it "waits while a booking of the trip hasn't settled" do
    trip = booked_trip(guest, 61, status: "confirmed")

    described_class.call

    expect(Trip.exists?(trip.id)).to be(true)
  end

  it "deletes guests left with no trips once the account has been idle for 60 days" do
    stale = User.create!(role: "guest")
    stale.update_columns(updated_at: 61.days.ago)
    fresh = User.create!(role: "guest")
    registered = create(:user)
    registered.update_columns(updated_at: 90.days.ago)

    described_class.call

    expect(User.all).to contain_exactly(fresh, registered)
  end

  it "reminds the guest once, 7 days before the trip is deleted" do
    due_in_week = booked_trip(guest, Trip::PURGE_DAYS - described_class::REMIND_DAYS)
    booked_trip(guest, Trip::PURGE_DAYS - described_class::REMIND_DAYS - 1)

    described_class.call
    described_class.call

    expect(ActionMailer::MailDeliveryJob).to have_been_enqueued.exactly(:once)
      .with("GuestMailer", "trip_deletion_reminder", "deliver_now", a_hash_including(args: [ due_in_week ]))
    expect(due_in_week.reload.purge_reminded_at).to be_present
  end

  it "sends no reminder to a guest with no email" do
    anonymous = User.create!(role: "guest")
    trip = create(:trip, :undated, user: anonymous)
    trip.update_columns(updated_at: (Trip::PURGE_DAYS - 3).days.ago)

    described_class.call

    expect(ActionMailer::MailDeliveryJob).not_to have_been_enqueued
  end
end
