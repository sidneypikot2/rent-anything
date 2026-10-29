require "rails_helper"

RSpec.describe Users::DeleteAccount do
  let(:guest) { create(:user, :profile_complete, email: "ana@example.com") }

  # A trip with one item, booked at `status`, as checkout leaves it.
  def booked_trip(user, status:)
    trip = create(:trip, user:)
    item = create(:trip_item, trip:)
    checkout = create(:checkout, user:, trip:)
    booking = create(:booking, :checkout, user:, checkout:, trip_item: item, listing: item.listing, status:,
      guest_name: user.name, starts_on: 5.days.ago.to_date, ends_on: 4.days.ago.to_date)
    BookingEvent.create!(booking:, user:, actor: "guest", to_status: status)
    trip
  end

  it "deletes the guest, their trips, sign-ins and sessions, and keeps the partner's records" do
    trip = booked_trip(guest, status: "completed")
    create(:trip, user: guest)
    OauthIdentity.create!(user: guest, provider: "google", uid: "g-1", role: "guest")
    TripAccess.issue!(guest)
    SignInCode.issue!(guest)
    Auth::IssueTokens.call(guest)
    booking = Booking.last

    described_class.call(guest)

    expect(User.exists?(guest.id)).to be(false)
    expect(Trip.where(id: trip.id).or(Trip.where(user_id: guest.id))).to be_empty
    expect(TripItem.where(trip_id: trip.id)).to be_empty
    expect(OauthIdentity.count + TripAccess.count + SignInCode.count + RefreshToken.count).to eq(0)
    expect(booking.reload).to have_attributes(user_id: nil, guest_name: "Ana Reyes", guest_email: "ana@example.com",
      status: "completed")
    expect(booking.checkout).to have_attributes(user_id: nil, trip_id: nil)
    expect(booking.events.pluck(:user_id)).to eq([ nil ])
  end

  it "emails the guest once the account is gone" do
    expect { described_class.call(guest) }.to have_enqueued_mail(GuestMailer, :account_deleted).with("ana@example.com", "Ana Reyes")
  end

  it "leaves a partner account with the same email alone" do
    partner = create(:user, :partner, email: "ana@example.com")

    described_class.call(guest)

    expect(User.exists?(partner.id)).to be(true)
  end

  it "refuses while a booking is open, and deletes nothing" do
    booked_trip(guest, status: "confirmed")

    expect {
      expect { described_class.call(guest) }.to raise_error(OpenBookingsError, /1 open booking/)
    }.not_to have_enqueued_mail(GuestMailer, :account_deleted)
    expect(User.exists?(guest.id)).to be(true)
    expect(guest.trips.count).to eq(1)
  end

  it "refuses a partner" do
    partner = create(:user, :partner)

    expect { described_class.call(partner) }.to raise_error(NotAuthorizedError)
    expect(User.exists?(partner.id)).to be(true)
  end
end
